from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Dict, List

import anthropic

logger = logging.getLogger(__name__)

_ANOMALY_PROMPT = """\
You are a factory safety and operations AI. Analyze these gate events from \
the last 5 minutes and identify any anomalies or safety concerns.

Events: {events_json}

Return ONLY valid JSON:
{{
  "anomalies": [
    {{
      "type": "safety" | "operational" | "security",
      "severity": "low" | "medium" | "high",
      "title": "<short title>",
      "description": "<2 sentences explaining what happened and why it matters>",
      "recommended_action": "<specific action for the site manager>"
    }}
  ],
  "summary": "<1 sentence overall status for this 5-minute window>"
}}

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

Return ONLY valid JSON:
{{
  "executive_summary": "<3-4 sentences: what happened this shift, any concerns>",
  "peak_activity_period": "<time window with explanation>",
  "worker_traffic": {{ "total_entries": 0, "peak_hour": "", "notes": "" }},
  "vehicle_traffic": {{ "total": 0, "trucks": 0, "cars": 0, "notes": "" }},
  "shipments": {{ "total_detected": 0, "boxes": 0, "drums": 0, "notes": "" }},
  "safety_flags": ["<specific concern>"],
  "recommendations": ["<actionable recommendation>"],
  "efficiency_score": 75,
  "efficiency_rationale": "<1 sentence explaining the score>"
}}\
"""


def _extract_json(text: str) -> str:
    if "```json" in text:
        return text.split("```json", 1)[1].split("```", 1)[0].strip()
    if "```" in text:
        return text.split("```", 1)[1].split("```", 1)[0].strip()
    return text.strip()


class ClaudeService:
    def __init__(self) -> None:
        self.client = anthropic.AsyncAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY", "")
        )
        self.model = "claude-sonnet-4-20250514"

    async def analyze_anomalies(self, events: List[Dict]) -> Dict:
        events_json = json.dumps(events, default=str, indent=2)
        prompt = _ANOMALY_PROMPT.format(events_json=events_json)
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            return json.loads(_extract_json(response.content[0].text))
        except Exception as exc:
            logger.error("Claude anomaly analysis failed: %s", exc)
            return {"anomalies": [], "summary": "Analysis unavailable"}

    async def generate_shift_report(
        self,
        shift_start: datetime,
        shift_end: datetime,
        events: List[Dict],
    ) -> Dict:
        events_json = json.dumps(events, default=str, indent=2)
        prompt = _SHIFT_PROMPT.format(
            shift_start=shift_start.isoformat(),
            shift_end=shift_end.isoformat(),
            count=len(events),
            events_json=events_json,
        )
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            return json.loads(_extract_json(response.content[0].text))
        except Exception as exc:
            logger.error("Claude shift report failed: %s", exc)
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


claude_service = ClaudeService()
