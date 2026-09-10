"use client";

import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { Button, Select } from "haus-components";
import { ModalShell } from "@/components/ModalShell";
import { ToastForm } from "@/components/ToastForm";
import type { ActionResult } from "@/lib/action-result";
import styles from "./SupersedeModal.module.css";

/**
 * Supersede, behind a modal, like every other choose-a-thing action in this
 * app (adding a member, connecting a repo, deleting a workspace).
 *
 * It used to be a bare `<select>` sitting in a banner, which made it the only
 * control on the page that needed a decision made *before* it could be pressed.
 * Superseding is also permanent and names a second decision, so it deserves the
 * deliberate step a modal gives it.
 */
export function SupersedeModal({
  action,
  candidates,
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  candidates: { id: string; label: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState("");

  if (candidates.length === 0) return null;

  function close() {
    setOpen(false);
    setChosen("");
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <ArrowLeftRight size={15} />
        Supersede
      </Button>

      {open && (
        <ModalShell title="Supersede this decision" onClose={close}>
          <p className={styles.text}>
            Pick the decision that replaces this one. This decision stays in the
            log, marked superseded and linked to its replacement.
          </p>
          <ToastForm action={action}>
            {/* The key leads and the title is the hint: a reader scans for
                VAU-014, and a title long enough to matter would otherwise be
                truncated into uselessness on one line. */}
            <Select
              portal
              label="Decision to supersede"
              name="supersededId"
              value={chosen}
              onChange={setChosen}
              placeholder="Choose a decision…"
              options={candidates.map((c) => ({
                value: c.id,
                label: c.label,
                hint: c.title,
              }))}
            />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!chosen}>
                <ArrowLeftRight size={15} />
                Supersede
              </Button>
            </div>
          </ToastForm>
        </ModalShell>
      )}
    </>
  );
}
