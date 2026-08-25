import Link from "next/link";
import { decisionLabel } from "@/lib/decisions/key";
import type { Lineal, LineageEntry } from "@/lib/decisions/lineage";
import styles from "./Lineage.module.css";

/**
 * The chain of decisions this one belongs to, oldest first.
 *
 * A single "superseded by" link tells you the next hop and nothing about the
 * conversation — and a decision three revisions deep is often best understood
 * as the latest answer to a question that has been answered before. Rendered
 * only where a chain exists, since a lineage of one is chrome around a single
 * item.
 *
 * Deliberately a row of links rather than a diagram: the shape is always a
 * line, and drawing a line as a graph adds nothing a reader cannot already see.
 */
export function Lineage({
  workspaceId,
  workspaceKey,
  chain,
}: {
  workspaceId: string;
  workspaceKey: string;
  chain: LineageEntry<Lineal>[];
}) {
  if (chain.length === 0) return null;

  return (
    <nav className={styles.wrap} aria-label="Supersession history">
      <span className={styles.label}>Lineage</span>
      <ol className={styles.chain}>
        {chain.map(({ decision, current }) => (
          <li key={decision.id} className={styles.step}>
            {current ? (
              <span className={`${styles.node} ${styles.here}`} aria-current="step">
                <span className="key-chip">
                  {decisionLabel(workspaceKey, decision.number)}
                </span>
                <span className={styles.title}>{decision.title}</span>
              </span>
            ) : (
              <Link
                href={`/app/${workspaceId}/${decision.id}`}
                className={styles.node}
                title={decision.title}
              >
                <span className="key-chip">
                  {decisionLabel(workspaceKey, decision.number)}
                </span>
                <span className={styles.title}>{decision.title}</span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
