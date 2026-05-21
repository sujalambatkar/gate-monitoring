"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SeverityBadge, TypeBadge } from "../components/AlertBadge";
import Sidebar from "../components/Sidebar";
import type { Alert } from "../lib/api";
import { fetchAlerts, resolveAlert } from "../lib/api";

const SEV_BORDER: Record<string, string> = {
  high:   "severity-high",
  medium: "severity-medium",
  low:    "severity-low",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

interface Filters {
  severity: string;
  type: string;
  resolved: string;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts]   = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    severity: "",
    type: "",
    resolved: "false",
  });
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (!window.localStorage?.getItem("token")) { router.push("/"); return; }
  }, [router]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function load() {
    setLoading(true);
    try {
      const params: Parameters<typeof fetchAlerts>[0] = {};
      if (filters.severity) params.severity = filters.severity;
      if (filters.type)     params.type     = filters.type;
      if (filters.resolved !== "") params.resolved = filters.resolved === "true";
      setAlerts(await fetchAlerts(params));
    } catch {
      /* fail silently */
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(id: string) {
    setResolving(id);
    try {
      await resolveAlert(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolved: true } : a))
      );
    } catch { /* */ } finally {
      setResolving(null);
    }
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />

      <main className="flex-1 ml-56 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Anomaly Alerts</h1>
            <p className="text-xs text-muted mt-0.5">
              Claude-powered anomaly detection · refreshes every 30 s
            </p>
          </div>
          <button
            onClick={load}
            className="px-3 py-1.5 bg-border text-muted rounded-lg text-xs
                       hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={filters.severity}
            onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs
                       text-white focus:outline-none focus:border-accent"
          >
            <option value="">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs
                       text-white focus:outline-none focus:border-accent"
          >
            <option value="">All Types</option>
            <option value="safety">Safety</option>
            <option value="operational">Operational</option>
            <option value="security">Security</option>
          </select>

          <select
            value={filters.resolved}
            onChange={(e) => setFilters((f) => ({ ...f, resolved: e.target.value }))}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs
                       text-white focus:outline-none focus:border-accent"
          >
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
            <option value="">All</option>
          </select>
        </div>

        {/* Alert feed */}
        {loading && alerts.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted text-sm">
            Loading…
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted gap-3">
            <p className="text-sm">No alerts matching your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-surface border border-border rounded-xl p-5
                            ${SEV_BORDER[alert.severity] ?? ""}
                            ${alert.resolved ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <SeverityBadge severity={alert.severity} />
                      <TypeBadge type={alert.type} />
                      {alert.resolved && (
                        <span className="text-xs text-ok bg-ok/10 border border-ok/20
                                         px-2 py-0.5 rounded-full">
                          Resolved
                        </span>
                      )}
                      <span className="text-xs text-muted ml-auto">{fmt(alert.timestamp)}</span>
                    </div>

                    <h3 className="text-sm font-semibold mb-1">{alert.title}</h3>
                    <p className="text-xs text-white/70 leading-relaxed mb-2">
                      {alert.description}
                    </p>

                    <div className="bg-bg rounded-lg px-3 py-2 text-xs text-accent-light
                                    border border-accent/20">
                      <span className="text-muted font-medium">Action: </span>
                      {alert.recommended_action}
                    </div>
                  </div>

                  {!alert.resolved && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      disabled={resolving === alert.id}
                      className="flex-shrink-0 px-3 py-1.5 bg-ok/20 text-ok border
                                 border-ok/30 rounded-lg text-xs hover:bg-ok/30
                                 disabled:opacity-60 transition-colors"
                    >
                      {resolving === alert.id ? "…" : "Resolve"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
