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
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

/** Run a mutation, turning a DecisionError into a toastable result. */
async function attempt(
  run: () => Promise<void>,
  ok: string,
): Promise<ActionResult> {
  try {
    await run();
  } catch (e) {
    if (e instanceof DecisionError) return { error: e.message };
    if (e instanceof Error && e.message.startsWith("GitHub")) {
      return { error: e.message };
    }
    throw e;
  }
  return { ok };
}

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

export async function renameWorkspace(
  workspaceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "A name is required." };
  return attempt(async () => {
    await decisionService.renameWorkspace(workspaceId, user.id, name);
    revalidatePath(`/app/${workspaceId}`);
  }, "Workspace renamed.");
}

export async function deleteWorkspace(workspaceId: string) {
  const user = await requireUser();
  await decisionService.deleteWorkspace(workspaceId, user.id);
  redirect("/app");
}

export async function inviteMember(
  workspaceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = (String(formData.get("role") ?? "author") as Role) ?? "author";
  if (!email) return { error: "An email is required." };
  return attempt(async () => {
    const target = await findUserByEmail(email);
    if (!target) {
      throw new DecisionError(
        `No account with the email ${email}. They need to sign up first.`,
      );
    }
    await decisionService.inviteMember(workspaceId, user.id, target.id, role);
    revalidatePath(`/app/${workspaceId}`);
  }, "Member added.");
}

export async function addReference(
  workspaceId: string,
  decisionId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "A URL is required." };
  const label = String(formData.get("label") ?? "").trim() || null;
  return attempt(async () => {
    await decisionService.addReference(decisionId, user.id, {
      kind: "link",
      label,
      url,
    });
    revalidatePath(`/app/${workspaceId}/${decisionId}`);
  }, "Reference added.");
}

export async function removeReference(
  workspaceId: string,
  decisionId: string,
  referenceId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return attempt(async () => {
    await decisionService.removeReference(referenceId, user.id);
    revalidatePath(`/app/${workspaceId}/${decisionId}`);
  }, "Reference removed.");
}

/** The current user's GitHub repos, for the connect picker. */
export async function listMyGithubRepos() {
  const user = await requireUser();
  const token = await getGithubToken(user.id);
  if (!token) throw new DecisionError("connect your GitHub account first");
  return listRepos(token);
}

export async function connectRepo(
  workspaceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const raw = String(formData.get("repo") ?? "");
  let parsed: { owner?: string; name?: string; defaultBranch?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Pick a repository." };
  }
  if (!parsed.owner || !parsed.name || !parsed.defaultBranch) {
    return { error: "Pick a repository." };
  }
  return attempt(async () => {
    await decisionService.connectRepo(workspaceId, user.id, {
      owner: parsed.owner!,
      name: parsed.name!,
      defaultBranch: parsed.defaultBranch!,
    });
    revalidatePath(`/app/${workspaceId}`);
  }, `Connected ${parsed.owner}/${parsed.name}.`);
}

export async function disconnectRepo(
  workspaceId: string,
  repoId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return attempt(async () => {
    await decisionService.disconnectRepo(repoId, user.id);
    revalidatePath(`/app/${workspaceId}`);
  }, "Repository disconnected.");
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
): Promise<ActionResult> {
  const user = await requireUser();
  const repoId = String(formData.get("repoId") ?? "");
  const path = String(formData.get("path") ?? "").trim();
  if (!repoId || !path) return { error: "Pick a file." };
  return attempt(async () => {
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
  }, `Added ${path}.`);
}

/** Re-check every file reference on a decision against the repo's current state. */
export async function checkReferenceDrift(
  workspaceId: string,
  decisionId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const token = await getGithubToken(user.id);
  if (!token) {
    return { error: "Connect your GitHub account to check for drift." };
  }
  try {
    const [references, repos] = await Promise.all([
      decisionService.listReferences(decisionId),
      decisionService.listWorkspaceRepos(workspaceId),
    ]);
    let checked = 0;
    let changed = 0;
    let missing = 0;
    for (const ref of references) {
      if (ref.kind !== "file" || !ref.repo || !ref.path) continue;
      const [owner, name] = ref.repo.split("/");
      const repo = repos.find((r) => r.owner === owner && r.name === name);
      if (!repo) continue;
      const sha = await getFileSha(token, owner, name, ref.path, repo.defaultBranch);
      await decisionService.recordReferenceState(ref.id, user.id, sha);
      checked += 1;
      if (sha === null) missing += 1;
      else if (ref.baselineSha && sha !== ref.baselineSha) changed += 1;
    }
    revalidatePath(`/app/${workspaceId}/${decisionId}`);
    if (checked === 0) return { ok: "No file references to check." };
    const parts = [`Checked ${checked} file ${checked === 1 ? "reference" : "references"}`];
    if (changed) parts.push(`${changed} changed`);
    if (missing) parts.push(`${missing} missing`);
    if (!changed && !missing) parts.push("all in sync");
    return { ok: parts.join(" — ") };
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }
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
): Promise<ActionResult> {
  const user = await requireUser();
  return attempt(async () => {
    await decisionService.revise(decisionId, user.id, adrBody(formData));
    revalidatePath(`/app/${workspaceId}/${decisionId}`);
  }, "Revision saved.");
}

export async function changeStatus(
  workspaceId: string,
  decisionId: string,
  toStatus: DecisionStatus,
): Promise<ActionResult> {
  const user = await requireUser();
  const label =
    toStatus === "accepted"
      ? "accepted"
      : toStatus === "rejected"
        ? "rejected"
        : toStatus === "deprecated"
          ? "deprecated"
          : "updated";
  return attempt(async () => {
    await decisionService.changeStatus(decisionId, user.id, toStatus);
    revalidatePath(`/app/${workspaceId}/${decisionId}`);
  }, `Decision ${label}.`);
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
