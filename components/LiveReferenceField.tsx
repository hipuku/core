"use client";

import { toast } from "sonner";
import {
  addFileReference,
  removeReference,
  type WorkspaceFile,
} from "@/app/app/actions";
import { ReferenceField, type ReferenceChip } from "@/components/ReferenceField";

/**
 * The reference field for a decision that already exists.
 *
 * Identical to composing, by construction — it renders the same
 * `ReferenceField`. The only difference is where a citation goes when you pick
 * it: straight to the server rather than into the form, because a decision that
 * exists has somewhere to put it. That difference is invisible, which is the
 * point.
 *
 * Checking for drift is deliberately *not* here. It is the question you ask
 * before deciding to edit, so it belongs on the document, and by the time you
 * are in this view you have already asked it.
 */
export function LiveReferenceField({
  workspaceId,
  decisionId,
  chips,
}: {
  workspaceId: string;
  decisionId: string;
  chips: ReferenceChip[];
}) {
  async function add(file: WorkspaceFile, lines: string | null) {
    const formData = new FormData();
    formData.set("repoId", file.repoId);
    formData.set("path", file.path);
    if (lines) formData.set("lines", lines);
    const result = await addFileReference(workspaceId, decisionId, formData);
    if (result?.error) toast.error(result.error);
    else if (result?.ok) toast.success(result.ok);
  }

  async function remove(chip: ReferenceChip) {
    const result = await removeReference(workspaceId, decisionId, chip.key);
    if (result?.error) toast.error(result.error);
    else if (result?.ok) toast.success(result.ok);
  }

  return (
    <ReferenceField
      workspaceId={workspaceId}
      chips={chips}
      onAdd={add}
      onRemove={remove}
    />
  );
}
