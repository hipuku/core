"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { inviteMember } from "@/app/app/actions";
import { Button, Input, Listbox } from "haus-components";
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
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <UserPlus size={16} />
        Add member
      </Button>

      {open && (
        <ModalShell title="Add member" onClose={() => setOpen(false)}>
          <ToastForm
            action={inviteMember.bind(null, workspaceId)}
            onSuccess={() => setOpen(false)}
            className={styles.form}
          >
            <Input
              label="Email"
              type="email"
              name="email"
              required
              autoFocus
              placeholder="teammate@example.com"
            />
            <Listbox
              label="Role"
              name="role"
              value={role}
              onChange={setRole}
              options={ROLE_OPTIONS}
            />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="primary">
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
