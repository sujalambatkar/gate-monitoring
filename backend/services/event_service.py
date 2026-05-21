from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

WORKER_CLASSES   = {"person"}
VEHICLE_CLASSES  = {"truck", "car", "bus", "van", "motorcycle"}
BOX_CLASSES      = {"box", "frp", "frp_sheet", "carton", "crate"}
DRUM_CLASSES     = {"barrel", "drum", "chemical_drum", "container"}  # "barrel" = your trained class name

WORKER_CONSEC_THRESHOLD = 3    # frames before firing "worker_entered"
ZONE_CLEAR_SECONDS      = 30   # seconds of no detection before "zone_cleared"


def _avg_conf(dets: List[Dict]) -> float:
    if not dets:
        return 0.0
    return sum(d["confidence"] for d in dets) / len(dets)


class EventService:
    def __init__(self) -> None:
        self._consec: Dict[str, int] = defaultdict(int)
        self._last_activity: Optional[datetime] = None
        self._pending_zone_clear = False

    def process_detections(
        self, detections: List[Dict], timestamp: datetime
    ) -> List[Dict]:
        events: List[Dict] = []

        names = {d["class_name"].lower() for d in detections}
        has_worker   = bool(names & WORKER_CLASSES)
        has_vehicle  = bool(names & VEHICLE_CLASSES)
        has_boxes    = bool(names & BOX_CLASSES)
        has_drums    = bool(names & DRUM_CLASSES)

        # ── Workers ──────────────────────────────────────────────────────────
        if has_worker:
            self._consec["person"] += 1
            if self._consec["person"] == WORKER_CONSEC_THRESHOLD:
                wdets = [d for d in detections if d["class_name"].lower() in WORKER_CLASSES]
                events.append(
                    {
                        "type": "worker_entered",
                        "timestamp": timestamp,
                        "confidence": _avg_conf(wdets),
                        "metadata": {
                            "worker_count": len(wdets),
                            "vehicle_nearby": has_vehicle,
                        },
                    }
                )
        else:
            self._consec["person"] = 0

        # ── Vehicles ─────────────────────────────────────────────────────────
        if has_vehicle:
            vdets = [d for d in detections if d["class_name"].lower() in VEHICLE_CLASSES]
            if self._consec["vehicle"] == 0:
                events.append(
                    {
                        "type": "vehicle_arrived",
                        "timestamp": timestamp,
                        "confidence": _avg_conf(vdets),
                        "metadata": {
                            "vehicle_count": len(vdets),
                            "trucks": sum(1 for d in vdets if "truck" in d["class_name"].lower()),
                            "cars": sum(1 for d in vdets if d["class_name"].lower() == "car"),
                        },
                    }
                )
            self._consec["vehicle"] += 1
        else:
            self._consec["vehicle"] = 0

        # ── Shipments (boxes + drums) ─────────────────────────────────────────
        if has_boxes or has_drums:
            bdets = [d for d in detections if d["class_name"].lower() in BOX_CLASSES]
            ddets = [d for d in detections if d["class_name"].lower() in DRUM_CLASSES]
            all_ship = bdets + ddets
            if self._consec["shipment"] == 0:
                events.append(
                    {
                        "type": "shipment_detected",
                        "timestamp": timestamp,
                        "confidence": _avg_conf(all_ship),
                        "metadata": {
                            "boxes": len(bdets),
                            "drums": len(ddets),
                            "supervised": has_worker,
                        },
                    }
                )
            self._consec["shipment"] += 1
        else:
            self._consec["shipment"] = 0

        # ── Zone cleared ─────────────────────────────────────────────────────
        if detections:
            self._last_activity = timestamp
            self._pending_zone_clear = True
        elif self._pending_zone_clear and self._last_activity:
            idle = (timestamp - self._last_activity).total_seconds()
            if idle >= ZONE_CLEAR_SECONDS:
                events.append(
                    {
                        "type": "zone_cleared",
                        "timestamp": timestamp,
                        "confidence": 1.0,
                        "metadata": {"inactive_seconds": idle},
                    }
                )
                self._pending_zone_clear = False

        return events


event_service = EventService()
