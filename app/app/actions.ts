"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decisionService, DecisionError } from "@/lib/decisions";
import type { DecisionStatus, Role } from "@/lib/decisions";
import {
  fileUrl,
  getFileSha,
  getGithubToken,
  listRepoFiles,
  listRepos,
} from "@/lib/github";
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

export async function addReference(
  workspaceId: string,
  decisionId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return;
  const label = String(formData.get("label") ?? "").trim() || null;
  await decisionService.addReference(decisionId, user.id, {
    kind: "link",
    label,
    url,
  });
  revalidatePath(`/app/${workspaceId}/${decisionId}`);
}

export async function removeReference(
  workspaceId: string,
  decisionId: string,
  referenceId: string,
) {
  const user = await requireUser();
  await decisionService.removeReference(referenceId, user.id);
  revalidatePath(`/app/${workspaceId}/${decisionId}`);
}

/** The current user's GitHub repos, for the connect picker. */
export async function listMyGithubRepos() {
  const user = await requireUser();
  const token = await getGithubToken(user.id);
  if (!token) throw new DecisionError("connect your GitHub account first");
  return listRepos(token);
}

export async function connectRepo(workspaceId: string, formData: FormData) {
  const user = await requireUser();
  const raw = String(formData.get("repo") ?? "");
  let parsed: { owner?: string; name?: string; defaultBranch?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!parsed.owner || !parsed.name || !parsed.defaultBranch) return;
  await decisionService.connectRepo(workspaceId, user.id, {
    owner: parsed.owner,
    name: parsed.name,
    defaultBranch: parsed.defaultBranch,
  });
  revalidatePath(`/app/${workspaceId}`);
}

export async function disconnectRepo(workspaceId: string, repoId: string) {
  const user = await requireUser();
  await decisionService.disconnectRepo(repoId, user.id);
  revalidatePath(`/app/${workspaceId}`);
}

/** Every file path in a connected repo, for the file picker. */
export async function listConnectedRepoFiles(repoId: string) {
  const user = await requireUser();
  const repo = await decisionService.getWorkspaceRepo(repoId);
  if (!repo) throw new DecisionError("repository not found");
  const role = await decisionService.roleOf(repo.workspaceId, user.id);
  if (!role) throw new DecisionError("you are not a member of this workspace");
  const token = await getGithubToken(user.id);
  if (!token) throw new DecisionError("connect your GitHub account first");
  return listRepoFiles(token, repo.owner, repo.name, repo.defaultBranch);
}

export async function addFileReference(
  workspaceId: string,
  decisionId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const repoId = String(formData.get("repoId") ?? "");
  const path = String(formData.get("path") ?? "").trim();
  if (!repoId || !path) return;
  const repo = await decisionService.getWorkspaceRepo(repoId);
  if (!repo || repo.workspaceId !== workspaceId) {
    throw new DecisionError("repository not found");
  }
  const token = await getGithubToken(user.id);
  // Snapshot the file's current SHA as the baseline this decision cites.
  const baselineSha = token
    ? await getFileSha(token, repo.owner, repo.name, path, repo.defaultBranch)
    : null;
  await decisionService.addReference(decisionId, user.id, {
    kind: "file",
    label: `${repo.owner}/${repo.name} · ${path}`,
    url: fileUrl(repo.owner, repo.name, repo.defaultBranch, path),
    repo: `${repo.owner}/${repo.name}`,
    path,
    baselineSha,
  });
  revalidatePath(`/app/${workspaceId}/${decisionId}`);
}

/** Re-check every file reference on a decision against the repo's current state. */
export async function checkReferenceDrift(
  workspaceId: string,
  decisionId: string,
) {
  const user = await requireUser();
  const token = await getGithubToken(user.id);
  if (!token) {
    throw new DecisionError("connect your GitHub account to check for drift");
  }
  const [references, repos] = await Promise.all([
    decisionService.listReferences(decisionId),
    decisionService.listWorkspaceRepos(workspaceId),
  ]);
  for (const ref of references) {
    if (ref.kind !== "file" || !ref.repo || !ref.path) continue;
    const [owner, name] = ref.repo.split("/");
    const repo = repos.find((r) => r.owner === owner && r.name === name);
    if (!repo) continue;
    const sha = await getFileSha(token, owner, name, ref.path, repo.defaultBranch);
    await decisionService.recordReferenceState(ref.id, user.id, sha);
  }
  revalidatePath(`/app/${workspaceId}/${decisionId}`);
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
