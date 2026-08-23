import type { DecisionStatus } from "@/lib/decisions";
import styles from "@/app/app/app.module.css";

export function StatusBadge({ status }: { status: DecisionStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>{status}</span>;
}
