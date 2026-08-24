"use client";

import { Check, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { listWorkspaceFiles, type WorkspaceFile } from "@/app/app/actions";
// Imported from the module, not the `@/lib/decisions` barrel: the barrel also
// exports the Drizzle store, and pulling it into a client component drags
// `postgres` — and its `fs` import — into the browser bundle.
import { FileRow } from "@/components/FileToken";
import { parseRange } from "@/lib/decisions/snippet";
import styles from "./FileBrowser.module.css";

/**
 * Search every connected repo at once and hand the picked file — optionally a
 * line range within it — back to the caller.
 *
 * The repo is a filter on the results, not a gate in front of them: an author
 * citing a file almost always knows the filename and often not the repo, so
 * asking which repo first put a wait in front of the only step they cared
 * about. Trees are fetched once, in parallel, and filtered in memory.
 *
 * Deliberately owns no form — the compose editor nests it inside its own
 * <form>, where a nested form would be invalid HTML.
 */
export function FileBrowser({
  workspaceId,
  onPick,
}: {
  workspaceId: string;
  onPick: (file: WorkspaceFile, lines: string | null) => void | Promise<void>;
}) {
  const [files, setFiles] = useState<WorkspaceFile[] | null>(null);
  const [partial, setPartial] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** The file awaiting a line range, if the author asked to narrow one. */
  const [narrowing, setNarrowing] = useState<WorkspaceFile | null>(null);
  const [lines, setLines] = useState("");
  const rangeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    listWorkspaceFiles(workspaceId)
      .then((result) => {
        if (!live) return;
        setFiles(result.files);
        setPartial(result.truncated);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Could not load files.");
      });
    return () => {
      live = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (narrowing) rangeRef.current?.focus();
  }, [narrowing]);

  const LIMIT = 30;
  const matched = useMemo(() => {
    if (!files) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return files.filter(
      (f) =>
        f.path.toLowerCase().includes(needle) ||
        f.repo.toLowerCase().includes(needle),
    );
  }, [files, query]);

  const shown = matched.slice(0, LIMIT);
  const hidden = matched.length - shown.length;
  const range = parseRange(lines);
  const rangeInvalid = lines.trim() !== "" && range === null;

  function commit(file: WorkspaceFile, withLines: string | null) {
    void onPick(file, withLines);
    setNarrowing(null);
    setLines("");
    setQuery("");
  }

  if (error) {
    return (
      <p className={styles.status} data-tone="error">
        {error}
      </p>
    );
  }

  return (
    <div className={styles.browse}>
      <div className={styles.searchRow}>
        <Search size={15} className={styles.searchIcon} />
        <input
          className={styles.search}
          placeholder={
            files ? "Search files across connected repositories…" : "Loading files…"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!files}
          aria-label="Search files"
        />
        {!files && <Loader2 size={15} className={styles.spinner} />}
      </div>

      {partial.length > 0 && (
        <p className={styles.status}>
          Partial file list for {partial.join(", ")} — very large or unreachable.
        </p>
      )}

      {/* Narrowing to a range: the file is chosen, only the span is left. */}
      {narrowing ? (
        <div className={styles.narrow}>
          <span className={styles.narrowPath}>
            <FileRow repo={narrowing.repo} path={narrowing.path} />
          </span>
          <input
            ref={rangeRef}
            className={styles.rangeInput}
            placeholder="L47-L120"
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && range) {
                e.preventDefault();
                commit(narrowing, lines);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setNarrowing(null);
                setLines("");
              }
            }}
            aria-label="Line range"
            aria-invalid={rangeInvalid}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!range}
            onClick={() => commit(narrowing, lines)}
          >
            <Check size={15} />
            Cite lines
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setNarrowing(null);
              setLines("");
            }}
          >
            Cancel
          </button>
          {rangeInvalid && (
            <p className={styles.status} data-tone="error">
              Use a range like <code>L47-L120</code>, or a single line: <code>L47</code>.
            </p>
          )}
        </div>
      ) : (
        <>
          {query.trim() !== "" && matched.length === 0 && files && (
            <p className={styles.status}>No file matches that search.</p>
          )}

          {shown.length > 0 && (
            <ul className={styles.results}>
              {shown.map((file) => (
                <li key={`${file.repoId}:${file.path}`} className={styles.result}>
                  <FileRow
                    repo={file.repo}
                    path={file.path}
                    onClick={() => commit(file, null)}
                    title="Cite the whole file"
                  >
                    {/* A range is the better citation, so it gets its own
                        control rather than hiding behind the whole-file
                        default. */}
                    <button
                      type="button"
                      className={styles.lines}
                      onClick={() => {
                        setNarrowing(file);
                        setLines("");
                      }}
                      title="Cite specific lines"
                    >
                      lines…
                    </button>
                  </FileRow>
                </li>
              ))}
            </ul>
          )}

          {hidden > 0 && (
            <p className={styles.status}>
              Showing {shown.length} of {matched.length} — keep typing to narrow it down.
            </p>
          )}
        </>
      )}
    </div>
  );
}
