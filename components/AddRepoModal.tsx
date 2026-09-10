"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, Select } from "haus-components";
import { connectRepo, listMyGithubRepos } from "@/app/app/actions";
import type { GithubRepo } from "@/lib/github";
import { ModalShell } from "./ModalShell";
import { ToastForm } from "./ToastForm";
import styles from "./Modal.module.css";
import { SubmitButton } from "@/components/SubmitButton";

export function AddRepoModal({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState("");
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
      <Button type="button" variant="secondary" onClick={openModal}>
        <Plus size={16} />
        Connect a repository
      </Button>

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
              {/* haus Select, like every other choose-a-thing in this app:
                  "private" reads better as a hint than as parenthetical text
                  appended to the name, and Select carries that hint under each
                  option where a raw native <select> could not. */}
              <Select
                portal
                label="Repository"
                name="repo"
                value={chosen}
                onChange={setChosen}
                placeholder="Choose a repository"
                options={repos.map((repo) => ({
                  value: JSON.stringify({
                    owner: repo.owner,
                    name: repo.name,
                    defaultBranch: repo.defaultBranch,
                  }),
                  label: repo.fullName,
                  hint: repo.private ? "Private" : undefined,
                }))}
              />
              <div className={styles.actions}>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="primary" disabled={!chosen}>
                  <Plus size={16} />
                  Connect
                </SubmitButton>
              </div>
            </ToastForm>
          )}
        </ModalShell>
      )}
    </>
  );
}
