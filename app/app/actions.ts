"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decisionService, DecisionError } from "@/lib/decisions";
import type { DecisionStatus, Role } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

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

export async function inviteMember(workspaceId: string, formData: FormData) {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = (String(formData.get("role") ?? "author") as Role) ?? "author";
  if (!email) return;
  const target = await findUserByEmail(email);
  if (!target) {
    throw new DecisionError(
      `No account with the email ${email}. They need to sign up first.`,
    );
  }
  await decisionService.inviteMember(workspaceId, user.id, target.id, role);
  revalidatePath(`/app/${workspaceId}`);
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
