"use client";

// Standalone canvas overlay — useful when embedding over an external <img> or <video>
// The LiveFeed component manages its own overlay; this is for standalone use.

import { useEffect, useRef } from "react";
import type { Detection } from "../lib/api";

const CLASS_COLOR: Record<string, string> = {};

function getColor(cls: string): string {
  const lc = cls.toLowerCase();
  if (lc === "person")                          return "#6c63ff";
  if (["truck","car","bus","van"].includes(lc)) return "#f59e0b";
  if (["drum","chemical_drum","barrel"].includes(lc)) return "#ef4444";
  if (["box","frp","frp_sheet","carton"].includes(lc)) return "#22c55e";
  return "#8b84ff";
}

interface Props {
  detections: Detection[];
  /** Natural width of the source image/video (pixels) */
  sourceWidth: number;
  /** Natural height of the source image/video (pixels) */
  sourceHeight: number;
  className?: string;
}

export default function DetectionOverlay({
  detections,
  sourceWidth,
  sourceHeight,
  className = "",
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width  / (sourceWidth  || 1);
    const scaleY = canvas.height / (sourceHeight || 1);

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

      const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 12px Inter, sans-serif";
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = color + "cc";
      ctx.fillRect(bx, by - 20, tw, 20);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, bx + 4, by - 5);
    }
  }, [detections, sourceWidth, sourceHeight]);

  return (
    <canvas
      ref={ref}
      width={sourceWidth}
      height={sourceHeight}
      className={`pointer-events-none ${className}`}
    />
  );
}
