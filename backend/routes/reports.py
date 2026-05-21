from __future__ import annotations

import logging
import os
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def get_db(request: Request):
    return request.app.state.mongodb


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def list_reports(db=Depends(get_db)):
    cursor = db["reports"].find(
        {},
        {
            "shift_start": 1,
            "shift_end": 1,
            "efficiency_score": 1,
            "created_at": 1,
            "result.worker_traffic.total_entries": 1,
        },
    ).sort("created_at", -1).limit(100)
    docs = await cursor.to_list(length=100)
    return [_serialize(d) for d in docs]


@router.get("/{report_id}")
async def get_report(report_id: str, db=Depends(get_db)):
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report ID")

    doc = await db["reports"].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return _serialize(doc)


@router.get("/{report_id}/pdf")
async def download_pdf(report_id: str, db=Depends(get_db)):
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report ID")

    doc = await db["reports"].find_one({"_id": oid}, {"pdf_path": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    pdf_path: str | None = doc.get("pdf_path")
    if not pdf_path or not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF not yet generated")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"shift_report_{report_id}.pdf",
    )


@router.delete("/{report_id}")
async def delete_report(report_id: str, db=Depends(get_db)):
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report ID")

    result = await db["reports"].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"deleted": True}
