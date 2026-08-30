"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { timeAgo } from "@/lib/time-ago";
import styles from "./DecisionMeta.module.css";

/**
 * The decision's dossier: what is true of it now, and how it got that way.
 *
 * The properties and the audit trail were two things on the page, which is one
 * too many: a decision's status, owner and dates *are* the current state of its
 * history. So the history expands inside the card that summarises it, and the
 * page is left with two surfaces: this record, and the document it describes.
 *
 * The control lives in its own band along the bottom rather than inline with
 * the properties. Everything in that row is `label / value`; a button sharing
 * their baseline is a different grammar in the same sentence. In a band of its
 * own it reads as what it is, a handle on a drawer attached to the thing it
 * opens.
 *
 * The handle carries a summary rather than a count. "3 events" is a number;
 * "last activity 2 days ago" answers the question you were going to click to
 * find out, so the strip earns its space even when nothing is open.
 */
export function DecisionMeta({
  count,
  lastActivity,
  activity,
  children,
}: {
  /** Entries in the audit trail. */
  count: number;
  /** When the most recent of them happened, as epoch ms. */
  lastActivity: number | null;
  activity: React.ReactNode;
  /** The properties themselves. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`${styles.card} ${open ? styles.cardOpen : ""}`}>
      <div className={styles.head}>{children}</div>

      {count > 0 && (
        <>
          <button
            type="button"
            className={styles.handle}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={styles.summary}>
              {lastActivity !== null && (
                <>
                  <span className={styles.when}>
                    Last activity {timeAgo(lastActivity)}
                  </span>
                  <span className={styles.dot} aria-hidden="true">
                    ·
                  </span>
                </>
              )}
              <span className={styles.events}>
                {count} {count === 1 ? "event" : "events"}
              </span>
            </span>
            <span className={styles.affordance}>
              {open ? "Hide" : "Show"}
              <ChevronDown size={16} className={styles.chevron} />
            </span>
          </button>

          {open && (
            <div id={panelId} className={styles.panel}>
              {activity}
            </div>
          )}
        </>
      )}
    </div>
  );
}
