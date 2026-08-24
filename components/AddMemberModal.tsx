"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { inviteMember } from "@/app/app/actions";
import { ModalShell } from "./ModalShell";
import { ToastForm } from "./ToastForm";
import styles from "./Modal.module.css";

export function AddMemberModal({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <UserPlus size={16} />
        Add member
      </button>

      {open && (
        <ModalShell title="Add member" onClose={() => setOpen(false)}>
          <ToastForm
            action={inviteMember.bind(null, workspaceId)}
            onSuccess={() => setOpen(false)}
            className={styles.form}
          >
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                name="email"
                required
                autoFocus
                placeholder="teammate@example.com"
              />
            </label>
            <label className="field">
              <span>Role</span>
              <select className="select" name="role" defaultValue="author">
                <option value="author">author — can propose and revise</option>
                <option value="maintainer">
                  maintainer — can also accept, reject, supersede
                </option>
              </select>
            </label>
            <div className={styles.actions}>
              <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                <UserPlus size={16} />
                Add member
              </button>
            </div>
          </ToastForm>
        </ModalShell>
      )}
    </>
  );
}
