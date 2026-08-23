"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decisionService } from "@/lib/decisions";
import type { DecisionStatus } from "@/lib/decisions";
import { requireUser } from "@/lib/session";

function adrBody(formData: FormData) {
  return {
    context: String(formData.get("context") ?? "").trim(),
    decision: String(formData.get("decision") ?? "").trim(),
    consequences: String(formData.get("consequences") ?? "").trim(),
  };
}

export async function createWorkspace(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const workspace = await decisionService.createWorkspace(user.id, name);
  redirect(`/app/${workspace.id}`);
}

export async function propose(workspaceId: string, formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const decision = await decisionService.propose(workspaceId, user.id, {
    title,
    body: adrBody(formData),
  });
  redirect(`/app/${workspaceId}/${decision.id}`);
}

export async function revise(
  workspaceId: string,
  decisionId: string,
  formData: FormData,
) {
  const user = await requireUser();
  await decisionService.revise(decisionId, user.id, adrBody(formData));
  revalidatePath(`/app/${workspaceId}/${decisionId}`);
}

export async function changeStatus(
  workspaceId: string,
  decisionId: string,
  toStatus: DecisionStatus,
) {
  const user = await requireUser();
  await decisionService.changeStatus(decisionId, user.id, toStatus);
  revalidatePath(`/app/${workspaceId}/${decisionId}`);
}

export async function supersede(
  workspaceId: string,
  supersedingId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const supersededId = String(formData.get("supersededId") ?? "");
  if (!supersededId) return;
  await decisionService.supersede(supersedingId, supersededId, user.id);
  revalidatePath(`/app/${workspaceId}`);
  redirect(`/app/${workspaceId}/${supersedingId}`);
}
