"use client";

type Severity = "low" | "medium" | "high";
type AlertType = "safety" | "operational" | "security";

const SEV_STYLE: Record<Severity, string> = {
  high:   "bg-danger/20  text-danger  border-danger/40",
  medium: "bg-warn/20    text-warn    border-warn/40",
  low:    "bg-ok/20      text-ok      border-ok/40",
};

const TYPE_STYLE: Record<AlertType, string> = {
  safety:      "bg-accent/20 text-accent-light border-accent/30",
  operational: "bg-warn/15   text-warn         border-warn/30",
  security:    "bg-danger/15 text-danger        border-danger/30",
};

interface Props {
  severity?: Severity;
  type?: AlertType;
  children: React.ReactNode;
}

export function SeverityBadge({ severity, children }: { severity: Severity; children?: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                  border ${SEV_STYLE[severity]}`}
    >
      {children ?? severity.toUpperCase()}
    </span>
  );
}

export function TypeBadge({ type }: { type: AlertType }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  border ${TYPE_STYLE[type]}`}
    >
      {type}
    </span>
  );
}

export default function AlertBadge({ severity, type, children }: Props) {
  return (
    <div className="flex items-center gap-2">
      {severity && <SeverityBadge severity={severity} />}
      {type && <TypeBadge type={type} />}
      {children}
    </div>
  );
}
