"use client";

interface Props {
  cumulative: Record<string, number>;
  frameCounts: Record<string, number>;
}

const CARDS = [
  {
    key:     "workers",
    label:   "Workers",
    classes: ["person"],
    color:   "text-accent",
    border:  "border-accent/30",
    bg:      "bg-accent/10",
  },
  {
    key:     "vehicles",
    label:   "Vehicles",
    classes: ["truck", "car", "bus", "van", "motorcycle"],
    color:   "text-warn",
    border:  "border-warn/30",
    bg:      "bg-warn/10",
  },
  {
    key:     "boxes",
    label:   "Boxes / FRP",
    classes: ["box", "frp", "frp_sheet", "carton", "crate"],
    color:   "text-ok",
    border:  "border-ok/30",
    bg:      "bg-ok/10",
  },
  {
    key:     "drums",
    label:   "Barrels",
    classes: ["barrel", "drum", "chemical_drum", "container"],
    color:   "text-danger",
    border:  "border-danger/30",
    bg:      "bg-danger/10",
  },
];

function sum(counts: Record<string, number>, classes: string[]): number {
  return classes.reduce((n, c) => n + (counts[c] ?? 0), 0);
}

export default function StatCards({ cumulative, frameCounts }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CARDS.map(({ key, label, classes, color, border, bg }) => {
        const total   = sum(cumulative, classes);
        const current = sum(frameCounts, classes);
        return (
          <div
            key={key}
            className={`${bg} border ${border} rounded-xl p-4 flex flex-col gap-1`}
          >
            <span className="text-xs text-muted font-medium uppercase tracking-wide">
              {label}
            </span>
            <span className={`text-3xl font-bold ${color}`}>{total}</span>
            <span className="text-xs text-muted">
              {current > 0 ? `${current} visible now` : "none visible"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
