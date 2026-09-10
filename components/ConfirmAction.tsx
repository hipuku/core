"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "haus-components";
import { toast } from "@/lib/toast";
import { ModalShell } from "./ModalShell";
import styles from "./Modal.module.css";

type Tone = "success" | "error" | "warning" | "info" | "neutral";
type ActionResult = { ok?: string; error?: string };

/**
 * A lifecycle action behind an "are you sure" step. Accept, reject and deprecate
 * each move a decision one way, and accepting makes it immutable, so a single
 * click is too little friction for what they do. Supersede is not here: it has
 * its own modal because it needs the replacement chosen, not just confirmed.
 *
 * The trigger keeps the button it used to be (Approve is the filled primary, the
 * others are secondary), and the confirm button repeats the tone so the modal's
 * primary action reads as the same decision.
 */
export function ConfirmAction({
  action,
  tone,
  triggerVariant = "secondary",
  icon,
  label,
  title,
  description,
  confirmLabel,
  pendingLabel,
}: {
  action: () => Promise<ActionResult>;
  tone?: Tone;
  triggerVariant?: "primary" | "secondary";
  icon: React.ReactNode;
  label: string;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function run() {
    setPending(true);
    const result = await action();
    if (result.error) {
      toast.error(result.error);
      setPending(false);
      return;
    }
    toast.success(result.ok ?? "Done.");
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant={triggerVariant} tone={tone} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>

      {open && (
        <ModalShell title={title} onClose={() => setOpen(false)}>
          <p className={styles.confirmBody}>{description}</p>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="primary" tone={tone} onClick={run} loading={pending}>
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </ModalShell>
      )}
    </>
  );
}
