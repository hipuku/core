"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { connectRepo, listMyGithubRepos } from "@/app/app/actions";
import type { GithubRepo } from "@/lib/github";
import { ModalShell } from "./ModalShell";
import { ToastForm } from "./ToastForm";
import styles from "./Modal.module.css";

export function AddRepoModal({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setRepos(null);
    try {
      setRepos(await listMyGithubRepos());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load repositories.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn" onClick={openModal}>
        <Plus size={16} />
        Connect a repository
      </button>

      {open && (
        <ModalShell title="Connect a repository" onClose={() => setOpen(false)}>
          {loading && (
            <p style={{ color: "var(--text-faint)", fontSize: "0.9rem" }}>
              Loading your repositories…
            </p>
          )}
          {error && <p style={{ color: "var(--danger)", fontSize: "0.9rem" }}>{error}</p>}
          {repos && (
            <ToastForm
              action={connectRepo.bind(null, workspaceId)}
              onSuccess={() => setOpen(false)}
              className={styles.form}
            >
              <label className="field">
                <span>Repository</span>
                <select className="select" name="repo" required defaultValue="">
                  <option value="" disabled>
                    Choose a repository
                  </option>
                  {repos.map((repo) => (
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
              </label>
              <div className={styles.actions}>
                <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  <Plus size={16} />
                  Connect
                </button>
              </div>
            </ToastForm>
          )}
        </ModalShell>
      )}
    </>
  );
}
