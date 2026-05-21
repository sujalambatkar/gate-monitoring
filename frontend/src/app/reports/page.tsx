"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReportCard from "../components/ReportCard";
import Sidebar from "../components/Sidebar";
import type { Report } from "../lib/api";
import { fetchReports, generateShiftReport } from "../lib/api";

function ShiftModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (id: string) => void;
}) {
  const now   = new Date();
  const eight = new Date(now);
  eight.setHours(8, 0, 0, 0);

  const [start, setStart] = useState(eight.toISOString().slice(0, 16));
  const [end,   setEnd]   = useState(now.toISOString().slice(0, 16));
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const res = await generateShiftReport(
        new Date(start).toISOString(),
        new Date(end).toISOString()
      );
      onGenerated(res.report_id);
    } catch {
      setErr("Failed to generate report. Make sure the backend is running.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold mb-4">Generate Shift Report</h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-muted mb-1">Shift Start</label>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Shift End</label>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {err && (
          <p className="text-danger text-xs mb-3 bg-danger/10 border border-danger/20
                        rounded-lg px-3 py-2">
            {err}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 bg-accent text-white rounded-lg py-2 text-sm
                       hover:bg-accent-light disabled:opacity-60 transition-colors"
          >
            {busy ? "Generating…" : "Generate Report"}
          </button>
          <button
            onClick={onClose}
            className="px-4 bg-border text-muted rounded-lg text-sm hover:text-white
                       transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!window.localStorage?.getItem("token")) { router.push("/"); return; }
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    try {
      setReports(await fetchReports());
    } catch {
      /* fail silently */
    } finally {
      setLoading(false);
    }
  }

  function handleGenerated(id: string) {
    setShowModal(false);
    router.push(`/reports/${id}`);
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      {showModal && (
        <ShiftModal onClose={() => setShowModal(false)} onGenerated={handleGenerated} />
      )}

      <main className="flex-1 ml-56 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Shift Reports</h1>
            <p className="text-xs text-muted mt-0.5">
              AI-generated analysis from gate event data
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm
                       hover:bg-accent-light transition-colors"
          >
            + New Report
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted text-sm">
            Loading…
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted gap-3">
            <p className="text-sm">No reports yet. Generate one from the dashboard or here.</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 bg-accent/20 text-accent-light rounded-lg text-sm
                         hover:bg-accent/30 transition-colors"
            >
              Generate First Report
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reports.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
