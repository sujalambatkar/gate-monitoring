from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────────────

class EventType(str, Enum):
    WORKER_ENTERED    = "worker_entered"
    VEHICLE_ARRIVED   = "vehicle_arrived"
    SHIPMENT_DETECTED = "shipment_detected"
    ZONE_CLEARED      = "zone_cleared"


class AlertSeverity(str, Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"


class AlertType(str, Enum):
    SAFETY      = "safety"
    OPERATIONAL = "operational"
    SECURITY    = "security"


# ── Detection ────────────────────────────────────────────────────────────────

class Detection(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2]


# ── Events ───────────────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    type: EventType
    timestamp: datetime
    confidence: float
    frame_snapshot: Optional[str] = None  # base64
    metadata: Dict[str, Any] = Field(default_factory=dict)
    shift_id: Optional[str] = None


class EventOut(EventCreate):
    id: str


# ── Alerts ───────────────────────────────────────────────────────────────────

class AlertCreate(BaseModel):
    type: AlertType
    severity: AlertSeverity
    title: str
    description: str
    recommended_action: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    resolved: bool = False


class AlertOut(AlertCreate):
    id: str


# ── Reports ──────────────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    shift_start: datetime
    shift_end: datetime
    result: Dict[str, Any]
    pdf_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    efficiency_score: int = 0


class ReportOut(ReportCreate):
    id: str


# ── Request / Response bodies ─────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ShiftRequest(BaseModel):
    shift_start: datetime
    shift_end: datetime


class FrameRequest(BaseModel):
    frame_data: str  # base64 encoded image


class WebSocketMessage(BaseModel):
    frame: str  # base64 encoded image
