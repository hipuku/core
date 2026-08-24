"use client";

import { useState } from "react";
import { addFileReference, listConnectedRepoFiles } from "@/app/app/actions";
import type { RepoRecord } from "@/lib/decisions";
import styles from "@/app/app/app.module.css";

export function FileReferencePicker({
  workspaceId,
  decisionId,
  repos,
}: {
  workspaceId: string;
  decisionId: string;
  repos: RepoRecord[];
}) {
  const [repoId, setRepoId] = useState("");
  const [files, setFiles] = useState<string[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFiles(id: string) {
    setRepoId(id);
    setFiles(null);
    setFilter("");
    setError(null);
    if (!id) return;
    setLoading(true);
    try {
      const result = await listConnectedRepoFiles(id);
      setFiles(result.paths);
      setTruncated(result.truncated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files.");
    } finally {
      setLoading(false);
    }
  }

  if (repos.length === 0) {
    return (
      <p className={styles.hint}>
        Connect a repository in the workspace to reference files.
      </p>
    );
  }

  const shown =
    files
      ?.filter((p) => p.toLowerCase().includes(filter.toLowerCase()))
      .slice(0, 40) ?? [];

  return (
    <div className={styles.filePicker}>
      <select
        className="select"
        value={repoId}
        onChange={(e) => loadFiles(e.target.value)}
      >
        <option value="">Reference a file from…</option>
        {repos.map((repo) => (
          <option key={repo.id} value={repo.id}>
            {repo.owner}/{repo.name}
          </option>
        ))}
      </select>

      {loading && <p className={styles.hint}>Loading files…</p>}
      {error && (
        <p className={styles.hint} style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {files && (
        <>
          <input
            className="input"
            placeholder="Filter files…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {truncated && (
            <p className={styles.hint}>Large repo — showing a partial tree.</p>
          )}
          <ul className={styles.fileList}>
            {shown.map((path) => (
              <li key={path}>
                <form action={addFileReference.bind(null, workspaceId, decisionId)}>
                  <input type="hidden" name="repoId" value={repoId} />
                  <input type="hidden" name="path" value={path} />
                  <button type="submit" className={styles.fileItem}>
                    {path}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
