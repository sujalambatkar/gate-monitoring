from __future__ import annotations

import logging
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request

logger = logging.getLogger(__name__)
router = APIRouter()


def get_db(request: Request):
    return request.app.state.mongodb


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def list_alerts(
    db=Depends(get_db),
    severity: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    limit: int = Query(50, le=200),
):
    query: dict = {}
    if severity:
        query["severity"] = severity
    if type:
        query["type"] = type
    if resolved is not None:
        query["resolved"] = resolved

    cursor = db["alerts"].find(query).sort("timestamp", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_serialize(d) for d in docs]


@router.get("/{alert_id}")
async def get_alert(alert_id: str, db=Depends(get_db)):
    try:
        oid = ObjectId(alert_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid alert ID")

    doc = await db["alerts"].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _serialize(doc)


@router.patch("/{alert_id}/resolve")
async def resolve_alert(alert_id: str, db=Depends(get_db)):
    try:
        oid = ObjectId(alert_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid alert ID")

    result = await db["alerts"].update_one(
        {"_id": oid}, {"$set": {"resolved": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"resolved": True}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, db=Depends(get_db)):
    try:
        oid = ObjectId(alert_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid alert ID")

    result = await db["alerts"].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"deleted": True}
