"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TimelinePoint {
  time: string;
  workers: number;
  vehicles: number;
  shipments: number;
}

interface Props {
  data: TimelinePoint[];
  height?: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: "#13131f",
  border: "1px solid #1e1e30",
  borderRadius: 8,
  color: "#e2e2f0",
  fontSize: 12,
};

export default function TimelineChart({ data, height = 160 }: Props) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted text-sm"
        style={{ height }}
      >
        No timeline data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gWorkers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6c63ff" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gVehicles" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gShipments" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
        <XAxis
          dataKey="time"
          tick={{ fill: "#4a4a6a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#4a4a6a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />

        <Area
          type="monotone"
          dataKey="workers"
          stroke="#6c63ff"
          strokeWidth={2}
          fill="url(#gWorkers)"
          name="Workers"
        />
        <Area
          type="monotone"
          dataKey="vehicles"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#gVehicles)"
          name="Vehicles"
        />
        <Area
          type="monotone"
          dataKey="shipments"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#gShipments)"
          name="Shipments"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
