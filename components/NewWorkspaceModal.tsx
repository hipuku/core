"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { createWorkspace } from "@/app/app/actions";
import styles from "./NewWorkspaceModal.module.css";

export function NewWorkspaceModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => setOpen(true)}
      >
        <Plus size={16} />
        New workspace
      </button>

      {open && (
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="New workspace"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.panelTitle}>New workspace</h2>
            <form action={createWorkspace} className={styles.form}>
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  name="name"
                  required
                  autoFocus
                  placeholder="Platform team"
                />
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  <Plus size={16} />
                  Create workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
