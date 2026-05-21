from __future__ import annotations

import base64
import logging
import os
from collections import defaultdict
from typing import Dict, List, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

PERSON_CLASS    = 0
VEHICLE_CLASSES = {2, 3, 5, 7}   # car, motorcycle, bus, truck

# Per-model confidence thresholds
CONF_BASE   = 0.50
CONF_BOX    = 0.50
CONF_BARREL = 0.65   # higher to suppress square-object false positives


class YOLOService:
    def __init__(self) -> None:
        self.base_model   = None
        self.box_model    = None
        self.barrel_model = None

        # Cumulative unique-object tracking
        self._seen_ids: set[str]       = set()
        self._cumulative: dict[str, int] = defaultdict(int)

        self._load_models()

    # ── Model loading ─────────────────────────────────────────────────────────

    def _load_models(self) -> None:
        from ultralytics import YOLO

        paths = {
            "base_model":   os.path.expanduser(os.getenv("MODEL_BASE",   "~/gate-monitor/yolov8n.pt")),
            "box_model":    os.path.expanduser(os.getenv("MODEL_BOX",    "~/gate-monitor/runs/detect/gate1_box/weights/best.pt")),
            "barrel_model": os.path.expanduser(os.getenv("MODEL_BARREL", "~/gate-monitor/runs/detect/gate3_barrel4/weights/best.pt")),
        }
        for attr, path in paths.items():
            try:
                setattr(self, attr, YOLO(path))
                logger.info("Loaded %s from %s", attr, path)
            except Exception as exc:
                logger.error("Failed to load %s (%s): %s", attr, path, exc)

    # ── Internal helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _decode_frame(frame_data: str) -> np.ndarray | None:
        if "," in frame_data:
            frame_data = frame_data.split(",", 1)[1]
        try:
            arr = np.frombuffer(base64.b64decode(frame_data), np.uint8)
            return cv2.imdecode(arr, cv2.IMREAD_COLOR)
        except Exception as exc:
            logger.error("Frame decode error: %s", exc)
            return None

    def _run_tracked(
        self,
        model,
        frame: np.ndarray,
        detections: List[Dict],
        conf: float,
        model_key: str,
        filter_classes: set[int] | None = None,
    ) -> None:
        if model is None:
            return
        try:
            results = model.track(frame, conf=conf, persist=True, verbose=False)
            for result in results:
                has_ids = result.boxes.id is not None
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    if filter_classes and cls_id not in filter_classes:
                        continue

                    cls_name = result.names[cls_id]
                    det: Dict = {
                        "class_name": cls_name,
                        "confidence": float(box.conf[0]),
                        "bbox":       box.xyxy[0].tolist(),
                    }

                    if has_ids:
                        tid = int(box.id)
                        det["tracker_id"] = tid
                        uid = f"{model_key}_{cls_name}_{tid}"
                        if uid not in self._seen_ids:
                            self._seen_ids.add(uid)
                            self._cumulative[cls_name] += 1

                    detections.append(det)
        except Exception as exc:
            logger.error("%s model error: %s", model_key, exc)

    # ── Public API ────────────────────────────────────────────────────────────

    def run_inference(self, frame_data: str) -> Tuple[List[Dict], Dict[str, int]]:
        """Return (detections, cumulative_counts)."""
        frame = self._decode_frame(frame_data)
        if frame is None:
            return [], dict(self._cumulative)

        detections: List[Dict] = []

        self._run_tracked(
            self.base_model, frame, detections,
            conf=CONF_BASE, model_key="base",
            filter_classes={PERSON_CLASS} | VEHICLE_CLASSES,
        )
        self._run_tracked(
            self.box_model, frame, detections,
            conf=CONF_BOX, model_key="box",
        )
        self._run_tracked(
            self.barrel_model, frame, detections,
            conf=CONF_BARREL, model_key="barrel",
        )

        return detections, dict(self._cumulative)

    def reset_counts(self) -> None:
        """Clear cumulative counts and tracker state for a new session/shift."""
        self._seen_ids.clear()
        self._cumulative.clear()
        for model in (self.base_model, self.box_model, self.barrel_model):
            if model is None:
                continue
            try:
                if hasattr(model, "predictor") and model.predictor and \
                        hasattr(model.predictor, "trackers"):
                    for t in model.predictor.trackers:
                        t.reset()
            except Exception:
                pass
        logger.info("Counts and tracker state reset")


yolo_service = YOLOService()
