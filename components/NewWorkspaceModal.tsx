"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { createWorkspace } from "@/app/app/actions";
import { ModalShell } from "./ModalShell";
import styles from "./Modal.module.css";
import { ToastForm } from "@/components/ToastForm";
import { SubmitButton } from "@/components/SubmitButton";

export function NewWorkspaceModal() {
  const [open, setOpen] = useState(false);

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
        <ModalShell title="New workspace" onClose={() => setOpen(false)}>
          <ToastForm action={createWorkspace} className={styles.form}>
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
                className="btn"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <SubmitButton className="btn btn--primary">
                <Plus size={16} />
                Create workspace
              </SubmitButton>
            </div>
          </ToastForm>
        </ModalShell>
      )}
    </>
  );
}
