"use client";

import { AtSign, Plus, X } from "lucide-react";
import { FileBrowser } from "@/components/FileBrowser";
import { FileRow } from "@/components/FileToken";
import type { WorkspaceFile } from "@/app/app/actions";
import styles from "./ReferenceField.module.css";

export interface ReferenceChip {
  /** Stable per row: the reference id when live, repo:path:lines when buffered. */
  key: string;
  repo: string;
  path: string;
  /** `L47-L120`, or null for the whole file. */
  lines: string | null;
}

/**
 * Citing code. One interface, used by both composing and revising.
 *
 * These were two different screens for the same task. Whether the write lands
 * now or on submit is a persistence detail, and it had been allowed to leak all
 * the way out into the layout. The parent supplies the handlers; this owns how
 * citing a file looks and feels, so the two views cannot drift apart again.
 *
 * Deliberately shows **no drift status**. A file cited moments ago is in sync by
 * construction, since a badge that can only ever say one thing states nothing, and
 * auditing what moved underneath a decision is a thing you do while reading it,
 * not while writing it.
 */
export function ReferenceField({
  workspaceId,
  chips,
  onAdd,
  onRemove,
  onInsert,
  /** Compose buffers its citations in the form until the decision exists. */
  withHiddenInputs = false,
  repoIdOf,
  untracked = [],
  onTrack,
}: {
  workspaceId: string;
  chips: ReferenceChip[];
  onAdd: (file: WorkspaceFile, lines: string | null) => void | Promise<void>;
  onRemove: (chip: ReferenceChip) => void | Promise<void>;
  /** Drop a citation into the prose. Only offered while the text is editable. */
  onInsert?: (chip: ReferenceChip) => void;
  withHiddenInputs?: boolean;
  /** The repo id behind a row, needed only for the buffered hidden inputs. */
  repoIdOf?: (chip: ReferenceChip) => string;
  /** Files cited in the prose that nothing is watching yet. */
  untracked?: { repo: string; path: string; lines: string | null; repoId: string }[];
  onTrack?: (file: WorkspaceFile, lines: string | null) => void | Promise<void>;
}) {
  return (
    <>
      {chips.length > 0 && (
        <ul className={styles.list}>
          {chips.map((chip) => (
            <li key={chip.key} className={styles.item}>
              {withHiddenInputs && repoIdOf && (
                <>
                  {/* Read by `propose`, which snapshots each file's SHA. */}
                  <input type="hidden" name="refRepoId" value={repoIdOf(chip)} />
                  <input type="hidden" name="refRepoLabel" value={chip.repo} />
                  <input type="hidden" name="refPath" value={chip.path} />
                  <input type="hidden" name="refLines" value={chip.lines ?? ""} />
                </>
              )}
              <FileRow repo={chip.repo} path={chip.path} lines={chip.lines}>
                {onInsert && (
                  <button
                    type="button"
                    className="iconbtn iconbtn--sm iconbtn--accent"
                    aria-label={`Cite ${chip.path} in the text`}
                    title="Insert into the document"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onInsert(chip)}
                  >
                    <AtSign size={13} />
                  </button>
                )}
                <button
                  type="button"
                  className="iconbtn iconbtn--sm iconbtn--danger"
                  aria-label={`Remove ${chip.path}`}
                  onClick={() => void onRemove(chip)}
                >
                  <X size={13} />
                </button>
              </FileRow>
            </li>
          ))}
        </ul>
      )}

      {/* Cited in the argument, but not being watched. Offered rather than
          done silently: citing a file while reasoning is not the same as
          declaring that this decision governs it, and only the author knows
          which one they meant. */}
      {untracked.length > 0 && onTrack && (
        <div className={styles.untracked}>
          <p className={styles.untrackedLead}>
            {untracked.length === 1
              ? "One file is cited in the text but not tracked for changes."
              : `${untracked.length} files are cited in the text but not tracked for changes.`}
          </p>
          <ul className={styles.untrackedList}>
            {untracked.map((file) => (
              <li key={`${file.repo}:${file.path}`}>
                <FileRow repo={file.repo} path={file.path} lines={file.lines}>
                  <button
                    type="button"
                    className={styles.track}
                    onClick={() =>
                      void onTrack(
                        { repoId: file.repoId, repo: file.repo, path: file.path },
                        file.lines,
                      )
                    }
                  >
                    <Plus size={13} />
                    Track
                  </button>
                </FileRow>
              </li>
            ))}
          </ul>
        </div>
      )}

      <FileBrowser workspaceId={workspaceId} onPick={onAdd} />
    </>
  );
}
