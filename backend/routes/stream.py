from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.event_service import event_service
from services.yolo_service import yolo_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("WebSocket client connected from %s", websocket.client)
    db = websocket.app.state.mongodb

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            frame_data: str | None = msg.get("frame")
            if not frame_data:
                continue

            # Inference returns detections + cumulative unique-object counts
            detections, cumulative = await asyncio.to_thread(
                yolo_service.run_inference, frame_data
            )
            timestamp = datetime.utcnow()

            events = event_service.process_detections(detections, timestamp)

            if events:
                await db["events"].insert_many(
                    [{**e, "frame_snapshot": None, "shift_id": None} for e in events]
                )

            # Per-frame counts (how many visible right now)
            frame_counts: dict[str, int] = {}
            for d in detections:
                frame_counts[d["class_name"]] = frame_counts.get(d["class_name"], 0) + 1

            await websocket.send_text(
                json.dumps(
                    {
                        "detections":  detections,
                        "counts":      frame_counts,   # current frame
                        "cumulative":  cumulative,     # session totals (only goes up)
                        "events":      [e["type"] for e in events],
                        "timestamp":   timestamp.isoformat(),
                    }
                )
            )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
        try:
            await websocket.close()
        except Exception:
            pass
