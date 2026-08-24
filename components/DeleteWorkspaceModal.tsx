"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteWorkspace } from "@/app/app/actions";
import { ModalShell } from "./ModalShell";
import styles from "./Modal.module.css";

export function DeleteWorkspaceModal({
  workspaceId,
  name,
}: {
  workspaceId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onDelete() {
    setPending(true);
    const result = await deleteWorkspace(workspaceId);
    if (result.error) {
      toast.error(result.error);
      setPending(false);
      return;
    }
    toast.success(result.ok ?? "Workspace deleted.");
    router.push("/app");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--danger"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} />
        Delete workspace
      </button>

      {open && (
        <ModalShell title="Delete workspace" onClose={() => setOpen(false)}>
          <p style={{ color: "var(--text-dim)", lineHeight: 1.6, marginBottom: "1.4rem" }}>
            <strong style={{ color: "var(--text)" }}>{name}</strong> and all its
            decisions, history and references will be permanently deleted. This
            cannot be undone.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--destructive"
              onClick={onDelete}
              disabled={pending}
            >
              <Trash2 size={15} />
              {pending ? "Deleting…" : "Delete workspace"}
            </button>
          </div>
        </ModalShell>
      )}
    </>
  );
}
