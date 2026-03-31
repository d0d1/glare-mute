import type { RuntimeEvent } from "../lib/contracts";

export type StatusTone = "available" | "experimental" | "planned" | "unsupported" | "neutral";

export function StatusChip({
  label,
  status,
}: {
  label?: string;
  status: StatusTone;
}) {
  return (
    <span className="status-chip" data-status={status}>
      {label ?? status}
    </span>
  );
}

export function levelToStatus(level: RuntimeEvent["level"]): StatusTone {
  switch (level) {
    case "error":
      return "unsupported";
    case "warn":
      return "experimental";
    case "trace":
    case "debug":
      return "planned";
    case "info":
      return "available";
  }
}
