"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import LiveFeed from "../components/LiveFeed";
import Sidebar from "../components/Sidebar";
import StatCards from "../components/StatCards";
import TimelineChart, { type TimelinePoint } from "../components/TimelineChart";
import type { Detection } from "../lib/api";
import { generateShiftReport } from "../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_TIMELINE = 30;

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sumClasses(counts: Record<string, number>, classes: string[]): number {
  return classes.reduce((n, c) => n + (counts[c] ?? 0), 0);
}

export default function DashboardPage() {
  const router = useRouter();

  const [frameCounts,  setFrameCounts]  = useState<Record<string, number>>({});
  const [cumulative,   setCumulative]   = useState<Record<string, number>>({});
  const [events,       setEvents]       = useState<string[]>([]);
  const [timeline,     setTimeline]     = useState<TimelinePoint[]>([]);
  const [shiftStart]                    = useState(() => new Date().toISOString());
  const [genLoading,   setGenLoading]   = useState(false);
  const [genMsg,       setGenMsg]       = useState("");
  const [resetting,    setResetting]    = useState(false);

  const cumulativeRef = useRef<Record<string, number>>({});
  cumulativeRef.current = cumulative;

  useEffect(() => {
    if (!window.localStorage?.getItem("token")) router.push("/");
  }, [router]);

  // Timeline snapshot every 30 s
  useEffect(() => {
    const id = setInterval(() => {
      const c = cumulativeRef.current;
      setTimeline((prev) => [
        ...prev.slice(-MAX_TIMELINE + 1),
        {
          time:      nowLabel(),
          workers:   sumClasses(c, ["person"]),
          vehicles:  sumClasses(c, ["truck", "car", "bus", "van", "motorcycle"]),
          shipments: sumClasses(c, ["box", "frp", "frp_sheet", "barrel", "drum"]),
        },
      ]);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const handleDetections = useCallback(
    (_: Detection[], fc: Record<string, number>, cum: Record<string, number>) => {
      setFrameCounts(fc);
      if (Object.keys(cum).length > 0) setCumulative(cum);
    },
    [],
  );

  const handleEvent = useCallback((type: string) => {
    setEvents((prev) => [
      `${nowLabel()} — ${type.replace(/_/g, " ")}`,
      ...prev.slice(0, 19),
    ]);
  }, []);

  async function handleGenerateReport() {
    setGenLoading(true);
    setGenMsg("");
    try {
      const res = await generateShiftReport(shiftStart, new Date().toISOString());
      setGenMsg(`Report generated — efficiency score: ${res.efficiency_score}`);
      router.push(`/reports/${res.report_id}`);
    } catch {
      setGenMsg("Failed to generate report. Make sure the backend is running.");
    } finally {
      setGenLoading(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      const token = window.localStorage?.getItem("token") ?? "";
      await fetch(`${API}/analyze/reset-counts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setCumulative({});
      setFrameCounts({});
      setEvents([]);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />

      <main className="flex-1 ml-56 p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Live Operations Dashboard</h1>
            <p className="text-xs text-muted mt-0.5">
              Real-time gate monitoring · YOLOv8 inference
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-3 py-2 bg-border text-muted rounded-lg text-sm
                         hover:text-white disabled:opacity-60 transition-colors"
            >
              {resetting ? "Resetting…" : "Reset Counts"}
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={genLoading}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm
                         hover:bg-accent-light disabled:opacity-60 transition-colors"
            >
              {genLoading ? "Generating…" : "Generate Shift Report"}
            </button>
          </div>
        </div>

        {genMsg && (
          <p className="text-xs text-ok bg-ok/10 border border-ok/20 rounded-lg px-3 py-2">
            {genMsg}
          </p>
        )}

        {/* Main split */}
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Left — live feed 60% */}
          <div className="flex-[3] bg-surface border border-border rounded-2xl p-4
                          flex flex-col min-h-[500px]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 bg-ok rounded-full live-dot" />
              <span className="text-xs font-medium text-ok uppercase tracking-wide">
                Live Feed
              </span>
            </div>
            <LiveFeed onDetections={handleDetections} onEvent={handleEvent} />
          </div>

          {/* Right — stats 40% */}
          <div className="flex-[2] flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-muted font-medium uppercase tracking-wide mb-1">
                Session Totals
              </p>
              <p className="text-[10px] text-muted mb-3">
                Counts accumulate — reset to start a new session
              </p>
              <StatCards cumulative={cumulative} frameCounts={frameCounts} />
            </div>

            <div className="bg-surface border border-border rounded-2xl p-4 flex-1">
              <p className="text-xs text-muted font-medium uppercase tracking-wide mb-3">
                Activity Timeline
              </p>
              <TimelineChart data={timeline} height={150} />
              <div className="flex items-center gap-4 mt-2">
                {[
                  { color: "#6c63ff", label: "Workers"   },
                  { color: "#f59e0b", label: "Vehicles"  },
                  { color: "#22c55e", label: "Shipments" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs text-muted">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-muted font-medium uppercase tracking-wide mb-2">
                Recent Events
              </p>
              {events.length === 0 ? (
                <p className="text-xs text-muted italic">No events yet</p>
              ) : (
                <ul className="space-y-1 max-h-36 overflow-y-auto">
                  {events.map((e, i) => (
                    <li key={i} className="text-xs text-white/80 font-mono">{e}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
