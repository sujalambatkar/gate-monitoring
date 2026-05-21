from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from datetime import datetime
from typing import Annotated

import cv2
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from models.schemas import FrameRequest, ShiftRequest
from services.event_service import event_service
from services.gemini_service import gemini_service as claude_service
from services.report_service import report_service
from services.yolo_service import yolo_service

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 MB


def get_db(request: Request):
    return request.app.state.mongodb


# ── Single-frame analysis ─────────────────────────────────────────────────────

@router.post("/frame")
async def analyze_frame(body: FrameRequest, db=Depends(get_db)):
    detections, cumulative = await asyncio.to_thread(
        yolo_service.run_inference, body.frame_data
    )
    timestamp = datetime.utcnow()
    events = event_service.process_detections(detections, timestamp)

    if events:
        await db["events"].insert_many(
            [{**e, "frame_snapshot": None, "shift_id": None} for e in events]
        )

    frame_counts: dict[str, int] = {}
    for d in detections:
        frame_counts[d["class_name"]] = frame_counts.get(d["class_name"], 0) + 1

    return {
        "detections": detections,
        "counts": frame_counts,
        "cumulative": cumulative,
        "events": [e["type"] for e in events],
        "timestamp": timestamp.isoformat(),
    }


# ── Reset cumulative counts ───────────────────────────────────────────────────

@router.post("/reset-counts")
async def reset_counts():
    await asyncio.to_thread(yolo_service.reset_counts)
    event_service.__init__()   # reset consecutive-frame state too
    return {"reset": True}


# ── Shift report ──────────────────────────────────────────────────────────────

@router.post("/shift")
async def analyze_shift(body: ShiftRequest, db=Depends(get_db)):
    cursor = db["events"].find(
        {"timestamp": {"$gte": body.shift_start, "$lte": body.shift_end}}
    )
    events = await cursor.to_list(length=2000)
    for e in events:
        e["_id"] = str(e["_id"])

    result = await claude_service.generate_shift_report(
        body.shift_start, body.shift_end, events
    )

    doc = {
        "shift_start":      body.shift_start,
        "shift_end":        body.shift_end,
        "result":           result,
        "pdf_path":         None,
        "created_at":       datetime.utcnow(),
        "efficiency_score": result.get("efficiency_score", 0),
    }
    inserted = await db["reports"].insert_one(doc)
    report_id = str(inserted.inserted_id)

    pdf_path = await asyncio.to_thread(
        report_service.generate_pdf,
        report_id, body.shift_start, body.shift_end, result,
    )
    if pdf_path:
        await db["reports"].update_one(
            {"_id": inserted.inserted_id}, {"$set": {"pdf_path": pdf_path}}
        )

    return {"report_id": report_id, "efficiency_score": result.get("efficiency_score", 0)}


# ── Server-side video upload ──────────────────────────────────────────────────

@router.post("/upload-video")
async def upload_video(
    file: Annotated[UploadFile, File(description="MP4 video <= 100 MB")],
    db=Depends(get_db),
):
    if file.content_type not in {"video/mp4", "video/quicktime", "video/x-msvideo"}:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use MP4.")

    content = await file.read()
    if len(content) > MAX_VIDEO_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit.")

    total_detections: list[dict] = []
    total_events: list[dict] = []

    def _process() -> None:
        import base64
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        interval = max(1, int(fps // 5))
        idx = 0
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                if idx % interval == 0:
                    ok, buf = cv2.imencode(".jpg", frame)
                    if ok:
                        b64 = base64.b64encode(buf).decode()
                        dets, _ = yolo_service.run_inference(b64)
                        total_detections.extend(dets)
                        evts = event_service.process_detections(dets, datetime.utcnow())
                        total_events.extend(evts)
                idx += 1
        finally:
            cap.release()
            os.unlink(tmp_path)

    await asyncio.to_thread(_process)

    if total_events:
        await db["events"].insert_many(
            [{**e, "frame_snapshot": None, "shift_id": None} for e in total_events]
        )

    counts: dict[str, int] = {}
    for d in total_detections:
        counts[d["class_name"]] = counts.get(d["class_name"], 0) + 1

    return {
        "frames_processed": len(total_detections),
        "events_generated":  len(total_events),
        "class_counts":      counts,
    }
