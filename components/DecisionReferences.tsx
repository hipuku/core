import { Badge, type BadgeTone } from "haus-components";
import { FileRow } from "@/components/FileToken";
import { referenceDrift, type DriftStatus } from "@/lib/decisions/drift";
import styles from "./DecisionReferences.module.css";

/**
 * Drift is its own vocabulary, not a decision state, so it maps to tones
 * directly rather than borrowing `StatusBadge`. It used to spend `pill--accepted`
 * and `pill--superseded`, which read as decision states on something that is a
 * property of a citation.
 */
const DRIFT_BADGE: Record<DriftStatus, { tone: BadgeTone; label: string } | null> = {
  synced: { tone: "success", label: "in sync" },
  drifted: { tone: "warning", label: "changed" },
  missing: { tone: "error", label: "missing" },
  unknown: null,
};

export interface ReferenceView {
  id: string;
  kind: "link" | "file";
  label: string | null;
  url: string | null;
  repo: string | null;
  path: string | null;
  lines: string | null;
  baselineSha?: string | null;
  currentSha?: string | null;
  startLine?: number | null;
}

/**
 * The code and links a decision cites, as the document shows them.
 *
 * Read-only by design, and the only place drift is reported. Reading a decision
 * is when you want to know whether the code moved underneath it; writing one is
 * when you decide what to cite. Citing happens on the edit page, through the
 * same field used when the decision was first written.
 */
export function DecisionReferences({ references }: { references: ReferenceView[] }) {
  if (references.length === 0) {
    return <p className={styles.empty}>No code or links cited.</p>;
  }

  return (
    <ul className={styles.list}>
      {references.map((ref) => {
        const badge = DRIFT_BADGE[
          referenceDrift({
            kind: ref.kind,
            baselineSha: ref.baselineSha ?? null,
            currentSha: ref.currentSha ?? null,
            startLine: ref.startLine ?? null,
            baselineSnippet: null,
          })
        ];

        // A link reference has no repo or path to render as a file.
        if (ref.kind !== "file" || !ref.repo || !ref.path) {
          return (
            <li key={ref.id}>
              <a
                className={styles.link}
                href={ref.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {ref.label || ref.url}
              </a>
            </li>
          );
        }

        return (
          <li key={ref.id}>
            <FileRow
              repo={ref.repo}
              path={ref.path}
              lines={ref.lines}
              href={ref.url ?? undefined}
            >
              {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
            </FileRow>
          </li>
        );
      })}
    </ul>
  );
}
