import Link from "next/link";
import { draftLabel } from "@/lib/decisions/draft-label";
import { timeAgo } from "@/lib/time-ago";
import styles from "./DraftList.module.css";

export interface DraftSummary {
  id: string;
  title: string;
  /** The draft's body, used to name it when it has no title yet. */
  body: { context: string; decision: string; consequences: string };
  updatedAt: string;
}

/**
 * The author's own unsent drafts, at the head of the decisions list.
 *
 * They take the same card as a decision — a draft is the same *kind of thing*,
 * just earlier — and are told apart by the tag rather than by the container.
 * What they cannot take is a number: an ADR number is assigned on proposal, so
 * the key slot is a dashed placeholder that keeps the rows aligned without
 * claiming an identifier the draft does not have.
 *
 * There is deliberately no delete control on the row. Discarding happens inside
 * the draft, where you can read what you are about to throw away — a one-click
 * bin next to a title you can barely see is how work gets lost. This component
 * needs no client JavaScript as a result.
 */
export function DraftList({
  workspaceId,
  workspaceKey,
  drafts,
}: {
  workspaceId: string;
  /** The workspace's key, so a draft's slot reads `VAU-•••` and not a bare dash. */
  workspaceKey: string;
  drafts: DraftSummary[];
}) {
  if (drafts.length === 0) return null;

  return (
    <ul className={styles.list}>
      {drafts.map((draft) => {
        const label = draftLabel(draft.title, draft.body);
        return (
        <li key={draft.id}>
          <Link
            href={`/app/${workspaceId}/new?draft=${draft.id}`}
            className={styles.card}
          >
            <span className={styles.cardNum}>
              <span
                className="key-chip key-chip--pending"
                title="Your draft — numbered when you propose it"
              >
                {workspaceKey}-&bull;&bull;&bull;
              </span>
            </span>
            <span className={label.derived ? styles.derived : styles.cardTitle}>
              {label.text}
            </span>
            <span className={styles.when}>
              edited {timeAgo(new Date(draft.updatedAt).getTime())}
            </span>
            {/* The tag sits where every other row carries its status, so the
                column scans top to bottom without a gap. */}
            <span className="pill pill--draft" title="Only you can see this">
              Draft
            </span>
          </Link>
        </li>
        );
      })}
    </ul>
  );
}
