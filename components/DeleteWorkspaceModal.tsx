"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "haus-components";
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
      <Button
        type="button"
        variant="secondary"
        tone="error"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} />
        Delete workspace
      </Button>

      {open && (
        <ModalShell title="Delete workspace" onClose={() => setOpen(false)}>
          <p style={{ color: "var(--text-dim)", lineHeight: 1.6, marginBottom: "1.4rem" }}>
            <strong style={{ color: "var(--text)" }}>{name}</strong> and all its
            decisions, history and references will be permanently deleted. This
            cannot be undone.
          </p>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              tone="error"
              onClick={onDelete}
              loading={pending}
            >
              <Trash2 size={15} />
              {pending ? "Deleting…" : "Delete workspace"}
            </Button>
          </div>
        </ModalShell>
      )}
    </>
  );
}
