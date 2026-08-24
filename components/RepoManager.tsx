"use client";

import { useState } from "react";
import { connectRepo, disconnectRepo, listMyGithubRepos } from "@/app/app/actions";
import type { RepoRecord } from "@/lib/decisions";
import type { GithubRepo } from "@/lib/github";
import { ConnectGithubButton } from "./ConnectGithubButton";
import styles from "@/app/app/app.module.css";

export function RepoManager({
  workspaceId,
  githubLinked,
  canManage,
  repos,
}: {
  workspaceId: string;
  githubLinked: boolean;
  canManage: boolean;
  repos: RepoRecord[];
}) {
  const [available, setAvailable] = useState<GithubRepo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRepos() {
    setLoading(true);
    setError(null);
    try {
      setAvailable(await listMyGithubRepos());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load repositories.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {repos.length > 0 && (
        <ul className={styles.list} style={{ marginBottom: "0.85rem" }}>
          {repos.map((repo) => (
            <li key={repo.id} className={styles.memberRow}>
              <span className={styles.memberName}>
                {repo.owner}/{repo.name}
                <span className={styles.memberEmail}>{repo.defaultBranch}</span>
              </span>
              {canManage && (
                <form action={disconnectRepo.bind(null, workspaceId, repo.id)}>
                  <button type="submit" className={styles.refRemove} aria-label="Disconnect repository">
                    ×
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        (!githubLinked ? (
          <div className={styles.actions}>
            <ConnectGithubButton />
            <span className={styles.hint}>Connect GitHub to link repositories.</span>
          </div>
        ) : available === null ? (
          <button type="button" className="btn" onClick={loadRepos} disabled={loading}>
            {loading ? "Loading…" : "Connect a repository"}
          </button>
        ) : (
          <form action={connectRepo.bind(null, workspaceId)} className={styles.refForm}>
            <select className="select" name="repo" required defaultValue="">
              <option value="" disabled>
                Choose a repository
              </option>
              {available.map((repo) => (
                <option
                  key={repo.fullName}
                  value={JSON.stringify({
                    owner: repo.owner,
                    name: repo.name,
                    defaultBranch: repo.defaultBranch,
                  })}
                >
                  {repo.fullName}
                  {repo.private ? " (private)" : ""}
                </option>
              ))}
            </select>
            <button type="submit" className="btn">
              Connect
            </button>
          </form>
        ))}

      {error && (
        <p className={styles.hint} style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
