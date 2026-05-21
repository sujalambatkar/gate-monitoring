from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Dict, List

from dotenv import load_dotenv
from google import genai

logger = logging.getLogger(__name__)

# Load .env early so GEMINI_API_KEY is available when the singleton is created
_here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_here, "..", ".env"))          # backend/.env
load_dotenv(os.path.join(_here, "..", "..", ".env"))    # project root .env

_ANOMALY_PROMPT = """\
You are a factory safety and operations AI. Analyze these gate events from \
the last 5 minutes and identify any anomalies or safety concerns.

Events: {events_json}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "anomalies": [
    {{
      "type": "safety",
      "severity": "low",
      "title": "<short title>",
      "description": "<2 sentences explaining what happened and why it matters>",
      "recommended_action": "<specific action for the site manager>"
    }}
  ],
  "summary": "<1 sentence overall status for this 5-minute window>"
}}

type must be one of: safety, operational, security
severity must be one of: low, medium, high

Examples of anomalies to detect:
- Worker present without vehicle (unusual for gate entry protocol)
- Multiple vehicles queued (congestion)
- Drums detected without worker supervision
- Unusually high activity vs typical baseline
- Long gap in any detections (possible camera issue)\
"""

_SHIFT_PROMPT = """\
You are a factory operations analyst. Generate a professional end-of-shift \
report based on these gate monitoring events.

Shift: {shift_start} to {shift_end}
Total events: {count}
Events data: {events_json}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "executive_summary": "<3-4 sentences: what happened this shift, any concerns>",
  "peak_activity_period": "<time window with explanation>",
  "worker_traffic": {{ "total_entries": 0, "peak_hour": "09:00", "notes": "" }},
  "vehicle_traffic": {{ "total": 0, "trucks": 0, "cars": 0, "notes": "" }},
  "shipments": {{ "total_detected": 0, "boxes": 0, "drums": 0, "notes": "" }},
  "safety_flags": ["<specific concern>"],
  "recommendations": ["<actionable recommendation>"],
  "efficiency_score": 75,
  "efficiency_rationale": "<1 sentence explaining the score>"
}}\
"""

MODEL = "gemini-flash-latest"


def _extract_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner).strip()
    return text


class GeminiService:
    def __init__(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key:
            self.client: genai.Client | None = genai.Client(api_key=api_key)
        else:
            logger.warning("GEMINI_API_KEY not set — AI analysis will return stubs")
            self.client = None

    async def analyze_anomalies(self, events: List[Dict]) -> Dict:
        if self.client is None:
            return {"anomalies": [], "summary": "GEMINI_API_KEY not configured"}
        events_json = json.dumps(events, default=str, indent=2)
        prompt = _ANOMALY_PROMPT.format(events_json=events_json)
        try:
            response = await self.client.aio.models.generate_content(
                model=MODEL, contents=prompt
            )
            return json.loads(_extract_json(response.text))
        except Exception as exc:
            logger.error("Gemini anomaly analysis failed: %s", exc)
            return {"anomalies": [], "summary": "Analysis unavailable"}

    async def generate_shift_report(
        self,
        shift_start: datetime,
        shift_end: datetime,
        events: List[Dict],
    ) -> Dict:
        if self.client is None:
            return {
                "executive_summary": "GEMINI_API_KEY not configured.",
                "peak_activity_period": "Unknown",
                "worker_traffic": {"total_entries": 0, "peak_hour": "N/A", "notes": ""},
                "vehicle_traffic": {"total": 0, "trucks": 0, "cars": 0, "notes": ""},
                "shipments": {"total_detected": 0, "boxes": 0, "drums": 0, "notes": ""},
                "safety_flags": [],
                "recommendations": [],
                "efficiency_score": 0,
                "efficiency_rationale": "API key not set",
            }
        events_json = json.dumps(events, default=str, indent=2)
        prompt = _SHIFT_PROMPT.format(
            shift_start=shift_start.isoformat(),
            shift_end=shift_end.isoformat(),
            count=len(events),
            events_json=events_json,
        )
        try:
            response = await self.client.aio.models.generate_content(
                model=MODEL, contents=prompt
            )
            return json.loads(_extract_json(response.text))
        except Exception as exc:
            logger.error("Gemini shift report failed: %s", exc)
            return {
                "executive_summary": "Report generation unavailable due to an API error.",
                "peak_activity_period": "Unknown",
                "worker_traffic": {"total_entries": 0, "peak_hour": "N/A", "notes": ""},
                "vehicle_traffic": {"total": 0, "trucks": 0, "cars": 0, "notes": ""},
                "shipments": {"total_detected": 0, "boxes": 0, "drums": 0, "notes": ""},
                "safety_flags": [],
                "recommendations": [],
                "efficiency_score": 0,
                "efficiency_rationale": "Data unavailable",
            }


gemini_service = GeminiService()
