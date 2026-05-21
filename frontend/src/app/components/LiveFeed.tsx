"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Detection } from "../lib/api";
import { WS_URL } from "../lib/api";

type InputMode = "webcam" | "video";

const WORKER_CLASSES   = new Set(["person"]);
const VEHICLE_CLASSES  = new Set(["truck", "car", "bus", "van", "motorcycle"]);
const BOX_CLASSES      = new Set(["box", "frp", "frp_sheet", "carton", "crate"]);
const DRUM_CLASSES     = new Set(["drum", "chemical_drum", "barrel", "container"]);

const CLASS_COLOR: Record<string, string> = {
  person:         "#6c63ff",
  truck:          "#f59e0b",
  car:            "#f59e0b",
  bus:            "#f59e0b",
  drum:           "#ef4444",
  chemical_drum:  "#ef4444",
  barrel:         "#ef4444",
  box:            "#22c55e",
  frp:            "#22c55e",
  frp_sheet:      "#22c55e",
};

function getColor(cls: string): string {
  if (WORKER_CLASSES.has(cls))  return "#6c63ff";
  if (VEHICLE_CLASSES.has(cls)) return "#f59e0b";
  if (DRUM_CLASSES.has(cls))    return "#ef4444";
  if (BOX_CLASSES.has(cls))     return "#22c55e";
  return CLASS_COLOR[cls] ?? "#8b84ff";
}

interface Props {
  onDetections: (
    detections: Detection[],
    frameCounts: Record<string, number>,
    cumulative: Record<string, number>,
  ) => void;
  onEvent?: (type: string) => void;
}

const FRAME_INTERVAL_MS = 200; // ~5 fps sent to server

interface CameraDevice {
  deviceId: string;
  label: string;
}

export default function LiveFeed({ onDetections, onEvent }: Props) {
  const [mode, setMode] = useState<InputMode>("webcam");
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const overlayRef  = useRef<HTMLCanvasElement>(null);
  const wsRef       = useRef<WebSocket | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const detectionsRef = useRef<Detection[]>([]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
    ws.onopen    = () => setConnected(true);
    ws.onclose   = () => { setConnected(false); setStreaming(false); };
    ws.onerror   = () => setError("WebSocket connection failed");
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          detections: Detection[];
          counts: Record<string, number>;
          cumulative: Record<string, number>;
          events: string[];
        };
        detectionsRef.current = data.detections;
        onDetections(data.detections, data.counts, data.cumulative ?? {});
        data.events?.forEach((t) => onEvent?.(t));
        drawOverlay(data.detections);
      } catch { /* ignore parse errors */ }
    };
    wsRef.current = ws;
  }, [onDetections, onEvent]);

  // ── Frame capture & send ──────────────────────────────────────────────────
  function captureAndSend() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ws     = wsRef.current;
    if (!video || !canvas || ws?.readyState !== WebSocket.OPEN) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0);

    const frame = canvas.toDataURL("image/jpeg", 0.7);
    ws.send(JSON.stringify({ frame }));
  }

  // ── Overlay drawing ────────────────────────────────────────────────────────
  function drawOverlay(detections: Detection[]) {
    const overlay = overlayRef.current;
    const video   = videoRef.current;
    if (!overlay || !video) return;

    overlay.width  = video.clientWidth;
    overlay.height = video.clientHeight;

    const scaleX = video.clientWidth  / (video.videoWidth  || 640);
    const scaleY = video.clientHeight / (video.videoHeight || 480);

    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const det of detections) {
      const [x1, y1, x2, y2] = det.bbox;
      const color = getColor(det.class_name);
      const bx = x1 * scaleX;
      const by = y1 * scaleY;
      const bw = (x2 - x1) * scaleX;
      const bh = (y2 - y1) * scaleY;

      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Label background
      const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 12px Inter, sans-serif";
      const textW = ctx.measureText(label).width + 8;
      ctx.fillStyle = color + "cc";
      ctx.fillRect(bx, by - 20, textW, 20);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, bx + 4, by - 5);
    }
  }

  // ── Camera enumeration ────────────────────────────────────────────────────
  async function loadCameras() {
    try {
      // Brief permission request so labels are populated (they're empty before grant)
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
      tmp.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));
      setCameras(cams);
      // Auto-select iPhone if present, otherwise first camera
      const iphone = cams.find((c) =>
        c.label.toLowerCase().includes("iphone") ||
        c.label.toLowerCase().includes("continuity")
      );
      setSelectedCamera((iphone ?? cams[0])?.deviceId ?? "");
    } catch {
      setError("Could not enumerate cameras. Allow camera access first.");
    }
  }

  useEffect(() => {
    if (mode === "webcam") loadCameras();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Webcam mode ────────────────────────────────────────────────────────────
  async function startWebcam() {
    setError("");
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedCamera
          ? { deviceId: { exact: selectedCamera }, width: 1280, height: 720 }
          : { width: 1280, height: 720 },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      connectWS();
      timerRef.current = setInterval(captureAndSend, FRAME_INTERVAL_MS);
      setStreaming(true);
    } catch (e) {
      setError("Camera access denied or unavailable.");
    }
  }

  function stopWebcam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setStreaming(false);
  }

  // ── Video file mode ────────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setError("File exceeds 100 MB limit");
      return;
    }
    setError("");
    const url = URL.createObjectURL(file);
    const video = videoRef.current!;
    video.src = url;
    video.load();
    video.oncanplay = () => {
      video.play();
      connectWS();
      timerRef.current = setInterval(captureAndSend, FRAME_INTERVAL_MS);
      setStreaming(true);
    };
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wsRef.current?.close();
    };
  }, []);

  // ── Switch mode ────────────────────────────────────────────────────────────
  function switchMode(m: InputMode) {
    stopWebcam();
    wsRef.current?.close();
    setStreaming(false);
    setMode(m);
    setError("");
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Mode selector */}
      <div className="flex items-center gap-2">
        {(["webcam", "video"] as InputMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === m
                ? "bg-accent text-white"
                : "bg-border text-muted hover:text-white"
            }`}
          >
            {m === "webcam" ? "Live Camera" : "Video File"}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {connected && (
            <span className="flex items-center gap-1.5 text-xs text-ok">
              <span className="w-2 h-2 bg-ok rounded-full live-dot" />
              Connected
            </span>
          )}
          {streaming && (
            <span className="text-xs text-accent-light animate-pulse">
              Streaming
            </span>
          )}
        </div>
      </div>

      {/* Video container */}
      <div className="relative flex-1 bg-black rounded-xl overflow-hidden min-h-0">
        <video
          ref={videoRef}
          muted
          loop={mode === "video"}
          playsInline
          className="w-full h-full object-contain"
        />
        {/* Detection overlay canvas */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {/* Hidden capture canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* No-stream placeholder */}
        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center
                          text-muted text-sm gap-3 bg-surface/80">
            <span className="text-sm text-muted">
              {mode === "webcam"
                ? "Select a camera and click Start"
                : "Select a video file to process"}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {mode === "webcam" ? (
          <>
            {/* Camera selector */}
            {cameras.length > 0 && !streaming && (
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="bg-bg border border-border rounded-lg px-2 py-1.5 text-xs
                           text-white focus:outline-none focus:border-accent max-w-[200px] truncate"
              >
                {cameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label.length > 30 ? cam.label.slice(0, 28) + "…" : cam.label}
                  </option>
                ))}
              </select>
            )}

            {streaming ? (
              <button
                onClick={stopWebcam}
                className="px-4 py-2 bg-danger/20 text-danger border border-danger/30
                           rounded-lg text-sm hover:bg-danger/30 transition-colors"
              >
                Stop Stream
              </button>
            ) : (
              <button
                onClick={startWebcam}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm
                           hover:bg-accent-light transition-colors"
              >
                Start Stream
              </button>
            )}
          </>
        ) : (
          <label className="px-4 py-2 bg-accent text-white rounded-lg text-sm
                            hover:bg-accent-light transition-colors cursor-pointer">
            Choose Video
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        )}

        {error && (
          <p className="text-danger text-xs">{error}</p>
        )}
      </div>
    </div>
  );
}
