import type { DecisionStatus } from "@/lib/decisions";

export function StatusBadge({ status }: { status: DecisionStatus }) {
  return <span className={`pill pill--${status}`}>{status}</span>;
}
