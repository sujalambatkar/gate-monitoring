from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Dict

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger(__name__)

REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "reports_pdf")
ACCENT = "#6c63ff"


def _hex(c: colors.Color) -> str:
    return f"#{int(c.red*255):02x}{int(c.green*255):02x}{int(c.blue*255):02x}"


class ReportService:
    def __init__(self) -> None:
        os.makedirs(REPORTS_DIR, exist_ok=True)

    def generate_pdf(
        self,
        report_id: str,
        shift_start: datetime,
        shift_end: datetime,
        result: Dict,
    ) -> str:
        filename = os.path.join(REPORTS_DIR, f"report_{report_id}.pdf")
        try:
            doc = SimpleDocTemplate(
                filename,
                pagesize=A4,
                rightMargin=0.75 * inch,
                leftMargin=0.75 * inch,
                topMargin=0.75 * inch,
                bottomMargin=0.75 * inch,
            )

            base = getSampleStyleSheet()
            title_s = ParagraphStyle(
                "SITitle", parent=base["Title"],
                fontSize=20, textColor=colors.HexColor(ACCENT), spaceAfter=8,
            )
            h2_s = ParagraphStyle(
                "SIH2", parent=base["Heading2"],
                fontSize=13, textColor=colors.HexColor(ACCENT),
                spaceBefore=14, spaceAfter=6,
            )
            body_s = ParagraphStyle(
                "SIBody", parent=base["Normal"],
                fontSize=10, spaceAfter=4, leading=15,
            )
            sub_s = ParagraphStyle(
                "SISub", parent=base["Normal"],
                fontSize=9, textColor=colors.HexColor("#888888"), spaceAfter=8,
            )

            story = []

            # ── Header ─────────────────────────────────────────────────────
            story.append(Paragraph("Site Operations Intelligence", title_s))
            story.append(Paragraph("End-of-Shift Report", title_s))
            story.append(Paragraph(
                f"Shift: {shift_start.strftime('%Y-%m-%d  %H:%M')} → "
                f"{shift_end.strftime('%H:%M')}",
                sub_s,
            ))
            story.append(Paragraph(
                f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
                sub_s,
            ))
            story.append(HRFlowable(width="100%", thickness=1.5,
                                    color=colors.HexColor(ACCENT)))
            story.append(Spacer(1, 0.15 * inch))

            # ── Efficiency score ────────────────────────────────────────────
            score = result.get("efficiency_score", 0)
            sc = colors.green if score >= 70 else (colors.orange if score >= 40 else colors.red)
            story.append(Paragraph(
                f'Efficiency Score: <b><font color="{_hex(sc)}">{score} / 100</font></b>',
                h2_s,
            ))
            story.append(Paragraph(result.get("efficiency_rationale", ""), body_s))

            # ── Executive summary ───────────────────────────────────────────
            story.append(Paragraph("Executive Summary", h2_s))
            story.append(Paragraph(result.get("executive_summary", ""), body_s))

            # ── Peak activity ───────────────────────────────────────────────
            story.append(Paragraph("Peak Activity Period", h2_s))
            story.append(Paragraph(result.get("peak_activity_period", "N/A"), body_s))

            # ── Stats table ─────────────────────────────────────────────────
            story.append(Paragraph("Traffic Statistics", h2_s))
            wt = result.get("worker_traffic", {})
            vt = result.get("vehicle_traffic", {})
            sh = result.get("shipments", {})

            rows = [
                ["Category", "Metric", "Value"],
                ["Workers",   "Total Entries", str(wt.get("total_entries", 0))],
                ["Workers",   "Peak Hour",     str(wt.get("peak_hour", "N/A"))],
                ["Workers",   "Notes",         str(wt.get("notes", ""))],
                ["Vehicles",  "Total",         str(vt.get("total", 0))],
                ["Vehicles",  "Trucks",        str(vt.get("trucks", 0))],
                ["Vehicles",  "Cars",          str(vt.get("cars", 0))],
                ["Shipments", "Total",         str(sh.get("total_detected", 0))],
                ["Shipments", "Boxes",         str(sh.get("boxes", 0))],
                ["Shipments", "Drums",         str(sh.get("drums", 0))],
            ]
            tbl = Table(rows, colWidths=[1.8 * inch, 2.5 * inch, 2.2 * inch])
            tbl.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor(ACCENT)),
                        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
                        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE",      (0, 0), (-1, 0), 11),
                        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
                         [colors.HexColor("#f0efff"), colors.white]),
                        ("GRID",          (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
                        ("PADDING",       (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.append(tbl)
            story.append(Spacer(1, 0.2 * inch))

            # ── Safety flags ────────────────────────────────────────────────
            flags = result.get("safety_flags", [])
            if flags:
                story.append(Paragraph("Safety Flags", h2_s))
                for f in flags:
                    story.append(Paragraph(f"• {f}", body_s))

            # ── Recommendations ─────────────────────────────────────────────
            recs = result.get("recommendations", [])
            if recs:
                story.append(Paragraph("Recommendations", h2_s))
                for r in recs:
                    story.append(Paragraph(f"• {r}", body_s))

            doc.build(story)
            logger.info("PDF saved: %s", filename)
            return filename

        except Exception as exc:
            logger.error("PDF generation failed: %s", exc)
            return ""


report_service = ReportService()
