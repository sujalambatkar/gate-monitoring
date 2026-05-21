const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API.replace(/^http/, "ws");

export const WS_URL = `${WS_BASE}/ws/stream`;

function getToken(): string | null {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined" ||
    typeof window.localStorage.getItem !== "function"
  ) {
    return null;
  }
  try {
    return window.localStorage.getItem("token");
  } catch {
    return null;
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export async function login(username: string, password: string) {
  return request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// ── Reports ────────────────────────────────────────────────────────────────────
export async function fetchReports() {
  return request<Report[]>("/reports");
}

export async function fetchReport(id: string) {
  return request<Report>(`/reports/${id}`);
}

export async function generateShiftReport(shift_start: string, shift_end: string) {
  return request<{ report_id: string; efficiency_score: number }>("/analyze/shift", {
    method: "POST",
    body: JSON.stringify({ shift_start, shift_end }),
  });
}

export function pdfUrl(reportId: string) {
  return `${API}/reports/${reportId}/pdf?token=${getToken() ?? ""}`;
}

// ── Alerts ────────────────────────────────────────────────────────────────────
export async function fetchAlerts(params?: {
  severity?: string;
  type?: string;
  resolved?: boolean;
}) {
  const q = new URLSearchParams();
  if (params?.severity) q.set("severity", params.severity);
  if (params?.type) q.set("type", params.type);
  if (params?.resolved !== undefined) q.set("resolved", String(params.resolved));
  return request<Alert[]>(`/alerts?${q.toString()}`);
}

export async function resolveAlert(id: string) {
  return request<{ resolved: boolean }>(`/alerts/${id}/resolve`, {
    method: "PATCH",
  });
}

// ── Events (for timeline) ─────────────────────────────────────────────────────
export async function fetchEvents(since?: string) {
  const q = since ? `?since=${encodeURIComponent(since)}` : "";
  return request<EventDoc[]>(`/events${q}`);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Detection {
  class_name: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface Report {
  id: string;
  shift_start: string;
  shift_end: string;
  efficiency_score: number;
  created_at: string;
  pdf_path?: string;
  result: {
    executive_summary: string;
    peak_activity_period: string;
    worker_traffic: { total_entries: number; peak_hour: string; notes: string };
    vehicle_traffic: { total: number; trucks: number; cars: number; notes: string };
    shipments: { total_detected: number; boxes: number; drums: number; notes: string };
    safety_flags: string[];
    recommendations: string[];
    efficiency_score: number;
    efficiency_rationale: string;
  };
}

export interface Alert {
  id: string;
  type: "safety" | "operational" | "security";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  recommended_action: string;
  timestamp: string;
  resolved: boolean;
}

export interface EventDoc {
  id: string;
  type: string;
  timestamp: string;
  confidence: number;
  metadata: Record<string, unknown>;
}
