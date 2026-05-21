"use client";

import Link from "next/link";
import type { Report } from "../lib/api";
import { pdfUrl } from "../lib/api";

interface Props {
  report: Report;
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="flex-shrink-0">
      <circle
        cx="36" cy="36" r={r}
        fill="none" stroke="#1e1e30" strokeWidth={6}
      />
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text
        x="36" y="40"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill={color}
      >
        {score}
      </text>
    </svg>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportCard({ report }: Props) {
  const duration = Math.round(
    (new Date(report.shift_end).getTime() -
      new Date(report.shift_start).getTime()) /
      60000
  );
  const workers = report.result?.worker_traffic?.total_entries ?? "—";

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex gap-5
                    hover:border-accent/50 transition-colors">
      <ScoreRing score={report.efficiency_score} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <p className="text-sm font-semibold truncate">{fmt(report.shift_start)}</p>
            <p className="text-xs text-muted">{duration} min shift · {workers} workers</p>
          </div>
        </div>

        {report.result?.executive_summary && (
          <p className="text-xs text-muted line-clamp-2 mt-1">
            {report.result.executive_summary}
          </p>
        )}

        <div className="flex items-center gap-2 mt-3">
          <Link
            href={`/reports/${report.id}`}
            className="text-xs px-3 py-1.5 bg-accent/20 text-accent-light
                       rounded-lg hover:bg-accent/30 transition-colors"
          >
            View Report
          </Link>
          {report.pdf_path && (
            <a
              href={pdfUrl(report.id)}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1.5 bg-border text-muted
                         rounded-lg hover:bg-border/80 hover:text-white transition-colors"
            >
              Download PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
