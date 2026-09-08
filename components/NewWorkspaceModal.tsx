"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "haus-components";
import { createWorkspace } from "@/app/app/actions";
import { ModalShell } from "./ModalShell";
import styles from "./Modal.module.css";
import { ToastForm } from "@/components/ToastForm";
import { SubmitButton } from "@/components/SubmitButton";

export function NewWorkspaceModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        <Plus size={16} />
        New workspace
      </Button>

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
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <SubmitButton variant="primary">
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
