"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { inviteMember } from "@/app/app/actions";
import { Dropdown } from "./Dropdown";
import { ModalShell } from "./ModalShell";
import { ToastForm } from "./ToastForm";
import styles from "./Modal.module.css";
import { SubmitButton } from "@/components/SubmitButton";

const ROLE_OPTIONS = [
  { value: "author", label: "Author", hint: "Can propose and revise" },
  {
    value: "maintainer",
    label: "Maintainer",
    hint: "Can also accept, reject, supersede",
  },
];

export function AddMemberModal({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("author");

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
              <Dropdown
                label="Role"
                name="role"
                value={role}
                onChange={setRole}
                options={ROLE_OPTIONS}
              />
            </label>
            <div className={styles.actions}>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <SubmitButton className="btn btn--primary">
                <UserPlus size={16} />
                Add member
              </SubmitButton>
            </div>
          </ToastForm>
        </ModalShell>
      )}
    </>
  );
}
