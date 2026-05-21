from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Query, Request

logger = logging.getLogger(__name__)
router = APIRouter()


def get_db(request: Request):
    return request.app.state.mongodb


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def list_events(
    db=Depends(get_db),
    since: Optional[str] = Query(None, description="ISO timestamp"),
    limit: int = Query(100, le=500),
):
    query: dict = {}
    if since:
        try:
            query["timestamp"] = {"$gte": datetime.fromisoformat(since)}
        except ValueError:
            pass

    cursor = db["events"].find(query).sort("timestamp", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_serialize(d) for d in docs]
