"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import TimelineChart, { type TimelinePoint } from "../../components/TimelineChart";
import type { Report } from "../../lib/api";
import { fetchReport, pdfUrl } from "../../lib/api";

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r    = 48;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={120} height={120} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1e1e30" strokeWidth={10} />
      <circle
        cx="60" cy="60" r={r}
        fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x="60" y="65" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
        {score}
      </text>
      <text x="60" y="80" textAnchor="middle" fontSize="10" fill="#4a4a6a">
        / 100
      </text>
    </svg>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
  });
}

// Build a simple synthetic timeline from report data for visualisation
function buildTimeline(report: Report): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  const r = report.result;
  if (!r) return points;

  const totalWorkers  = r.worker_traffic?.total_entries  ?? 0;
  const totalVehicles = r.vehicle_traffic?.total         ?? 0;
  const totalShipments = r.shipments?.total_detected     ?? 0;

  const segments = 6;
  for (let i = 0; i < segments; i++) {
    const frac = (i + 1) / segments;
    const start = new Date(report.shift_start);
    const diff  = new Date(report.shift_end).getTime() - start.getTime();
    const t     = new Date(start.getTime() + diff * frac);
    const label = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    // Rough triangular distribution peaking at midpoint
    const peak = 1 - Math.abs(frac - 0.5) * 2;
    points.push({
      time:      label,
      workers:   Math.round(totalWorkers   * peak * 0.4),
      vehicles:  Math.round(totalVehicles  * peak * 0.35),
      shipments: Math.round(totalShipments * peak * 0.3),
    });
  }
  return points;
}

export default function ReportDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const router     = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!window.localStorage?.getItem("token")) { router.push("/"); return; }
    fetchReport(id)
      .then(setReport)
      .catch(() => setErr("Report not found"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 ml-56 flex items-center justify-center text-muted">
          Loading…
        </main>
      </div>
    );
  }

  if (err || !report) {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 ml-56 flex items-center justify-center text-danger">
          {err || "Report not found"}
        </main>
      </div>
    );
  }

  const r = report.result;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />

      <main className="flex-1 ml-56 p-6 max-w-5xl">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.back()}
              className="text-xs text-muted hover:text-white mb-2 flex items-center gap-1"
            >
              ← Reports
            </button>
            <h1 className="text-xl font-bold">Shift Report</h1>
            <p className="text-xs text-muted mt-0.5">
              {fmt(report.shift_start)} → {fmt(report.shift_end)}
            </p>
          </div>

          {report.pdf_path && (
            <a
              href={pdfUrl(report.id)}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm
                         hover:bg-accent-light transition-colors"
            >
              Download PDF
            </a>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Efficiency score card */}
          <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col
                          items-center justify-center gap-2">
            <ScoreRing score={report.efficiency_score} />
            <p className="text-xs text-muted text-center">Efficiency Score</p>
            <p className="text-xs text-center text-white/70">{r.efficiency_rationale}</p>
          </div>

          {/* Traffic stats */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <p className="text-xs text-muted font-medium uppercase tracking-wide mb-3">
              Traffic Stats
            </p>
            <StatRow label="Worker entries"   value={r.worker_traffic?.total_entries  ?? 0} />
            <StatRow label="Peak hour"        value={r.worker_traffic?.peak_hour       ?? "—"} />
            <StatRow label="Total vehicles"   value={r.vehicle_traffic?.total          ?? 0} />
            <StatRow label="Trucks"           value={r.vehicle_traffic?.trucks         ?? 0} />
            <StatRow label="Cars"             value={r.vehicle_traffic?.cars           ?? 0} />
            <StatRow label="Shipments"        value={r.shipments?.total_detected       ?? 0} />
          </div>

          {/* Shipments */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <p className="text-xs text-muted font-medium uppercase tracking-wide mb-3">
              Shipments
            </p>
            <StatRow label="Boxes / FRP"   value={r.shipments?.boxes ?? 0} />
            <StatRow label="Chemical drums" value={r.shipments?.drums ?? 0} />
            {r.shipments?.notes && (
              <p className="text-xs text-muted mt-3 italic">{r.shipments.notes}</p>
            )}
          </div>
        </div>

        {/* Executive summary */}
        <div className="mt-6 bg-surface border border-border rounded-2xl p-6">
          <p className="text-xs text-muted font-medium uppercase tracking-wide mb-2">
            Executive Summary
          </p>
          <p className="text-sm leading-relaxed">{r.executive_summary}</p>
          {r.peak_activity_period && (
            <p className="text-xs text-muted mt-2">
              <span className="text-white font-medium">Peak period:</span>{" "}
              {r.peak_activity_period}
            </p>
          )}
        </div>

        {/* Activity timeline chart */}
        <div className="mt-6 bg-surface border border-border rounded-2xl p-6">
          <p className="text-xs text-muted font-medium uppercase tracking-wide mb-4">
            Activity Distribution
          </p>
          <TimelineChart data={buildTimeline(report)} height={200} />
        </div>

        {/* Safety flags */}
        {r.safety_flags && r.safety_flags.length > 0 && (
          <div className="mt-6 bg-surface border border-danger/30 rounded-2xl p-5">
            <p className="text-xs text-danger font-medium uppercase tracking-wide mb-3">
              Safety Flags
            </p>
            <ul className="space-y-2">
              {r.safety_flags.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-white/80">
                  <span className="text-danger mt-0.5">!</span> {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {r.recommendations && r.recommendations.length > 0 && (
          <div className="mt-6 bg-surface border border-border rounded-2xl p-5">
            <p className="text-xs text-muted font-medium uppercase tracking-wide mb-3">
              Recommendations
            </p>
            <ul className="space-y-2">
              {r.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm text-white/80">
                  <span className="text-accent mt-0.5">→</span> {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
