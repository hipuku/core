"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  compareSnippet,
  decisionService,
  DecisionError,
  extractRange,
  formatRange,
  parseRange,
} from "@/lib/decisions";
import type { LineRange } from "@/lib/decisions";
import type { DecisionStatus, Role } from "@/lib/decisions";
import {
  fileUrl,
  getFileContent,
  getFileSha,
  getGithubToken,
  getReadToken,
  listRepoFiles,
  listRepos,
} from "@/lib/github";
import type { ActionResult } from "@/lib/action-result";
import { DEMO_REFUSAL, githubDisabled, isDemoAccount } from "@/lib/demo";
import { requireUser } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

/**
 * Refuse a write from the read-only demo account.
 *
 * Called at the top of every action that changes the decision log — and
 * deliberately *not* by the draft actions, which the demo is allowed to use.
 * Returning rather than throwing means the existing toast path reports it as a
 * boundary rather than an error page.
 */
function refuseDemo(user: { email: string }): ActionResult | null {
  return isDemoAccount(user.email) ? { error: DEMO_REFUSAL } : null;
}

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
  const refused = refuseDemo(user);
  if (refused) return refused;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const workspace = await decisionService.createWorkspace(user.id, name);
  redirect(`/app/${workspace.id}`);
}

export async function updateWorkspaceGeneral(
  workspaceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const refused = refuseDemo(user);
  if (refused) return refused;
  const name = String(formData.get("name") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  if (!name) return { error: "A name is required." };
  return attempt(async () => {
    await decisionService.updateWorkspace(workspaceId, user.id, { name, key });
    revalidatePath(`/app/${workspaceId}`);
    revalidatePath(`/app/${workspaceId}/settings`);
  }, "Settings saved.");
}

export async function deleteWorkspace(
  workspaceId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const refused = refuseDemo(user);
  if (refused) return refused;
  return attempt(async () => {
    await decisionService.deleteWorkspace(workspaceId, user.id);
  }, "Workspace deleted.");
}

export async function inviteMember(
  workspaceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const refused = refuseDemo(user);
  if (refused) return refused;
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

export async function removeMember(
  workspaceId: string,
  targetUserId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const refused = refuseDemo(user);
  if (refused) return refused;
  return attempt(async () => {
    await decisionService.removeMember(workspaceId, user.id, targetUserId);
    revalidatePath(`/app/${workspaceId}/settings`);
  }, "Member removed.");
}

export async function addReference(
  workspaceId: string,
  decisionId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const refused = refuseDemo(user);
  if (refused) return refused;
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
  const refused = refuseDemo(user);
  if (refused) return refused;
  return attempt(async () => {
    await decisionService.removeReference(referenceId, user.id);
    revalidatePath(`/app/${workspaceId}/${decisionId}`);
  }, "Reference removed.");
}

/**
 * The current user's GitHub repos, for the connect picker.
 *
 * Deliberately *not* `getReadToken`: the deployment's fallback token belongs to
 * the owner, and using it here would list the owner's repositories to whoever
 * happened to be signed in. Connecting a repository is an act of your own
 * access, so it requires your own account.
 */
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
  const refused = refuseDemo(user);
  if (refused) return refused;
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
  const refused = refuseDemo(user);
  if (refused) return refused;
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
  const token = await getReadToken(user.id);
  if (!token) throw new DecisionError("connect your GitHub account first");
  return listRepoFiles(token, repo.owner, repo.name, repo.defaultBranch);
}

export interface WorkspaceFile {
  repoId: string;
  repo: string;
  path: string;
}

/**
 * Every file across every repo connected to a workspace, in one list.
 *
 * An author citing a file knows the filename far more often than they know
 * which repo it is in, so making them pick a repo first is a gate in front of
 * the thing they came to do. The trees are fetched in parallel and merged; a
 * few hundred paths per repo is nothing to filter client-side.
 */
export async function listWorkspaceFiles(workspaceId: string): Promise<{
  files: WorkspaceFile[];
  /** Repos whose tree GitHub returned only part of. */
  truncated: string[];
  /** Repos this token could not read at all — private, or gone. */
  unreachable: string[];
  /** Set when browsing is not possible here — a state, not a failure. */
  unavailable?: string;
}> {
  /**
   * This action never throws.
   *
   * A server action that rejects reaches the browser as React error #441 — the
   * real message stripped out of the production build — which the picker then
   * displays as though it were an explanation. Every way this can fail is
   * something a person can act on, so each one is returned as words.
   */
  try {
    const user = await requireUser();
    const role = await decisionService.roleOf(workspaceId, user.id);
    if (!role) {
      return { files: [], truncated: [], unreachable: [], unavailable: "You are not a member of this workspace." };
    }

    // Browsing and linking are separate concerns. `DISABLE_GITHUB` stops the
    // app storing *other people's* tokens; it does not stop it reading public
    // code through the deployment's own read-only one.
    const token = await getReadToken(user.id);
    if (!token) {
      return {
        files: [],
        truncated: [],
        unreachable: [],
        unavailable: githubDisabled()
          ? "GitHub is switched off on this deployment, so files cannot be browsed here."
          : "Connect your GitHub account in workspace settings to cite files.",
      };
    }

    const repos = await decisionService.listWorkspaceRepos(workspaceId);
    if (repos.length === 0) {
      return {
        files: [],
        truncated: [],
        unreachable: [],
        unavailable: "No repositories are connected to this workspace yet.",
      };
    }

    const results = await Promise.all(
      repos.map(async (repo) => {
        try {
          const { paths, truncated } = await listRepoFiles(
            token,
            repo.owner,
            repo.name,
            repo.defaultBranch,
          );
          return { repo, paths, truncated, failed: false };
        } catch {
          // One unreachable repo must not empty the whole picker — a private
          // repo, or one the user has lost access to, is common and not worth
          // failing the search over.
          return { repo, paths: [] as string[], truncated: false, failed: true };
        }
      }),
    );

    return {
      files: results.flatMap((r) =>
        r.paths.map((path) => ({
          repoId: r.repo.id,
          repo: `${r.repo.owner}/${r.repo.name}`,
          path,
        })),
      ),
      truncated: results
        .filter((r) => r.truncated)
        .map((r) => `${r.repo.owner}/${r.repo.name}`),
      // Told apart from truncation on purpose: a repo the deployment's public
      // token cannot see is a *private* one, and "showing part of it" would be
      // the wrong story.
      unreachable: results
        .filter((r) => r.failed)
        .map((r) => `${r.repo.owner}/${r.repo.name}`),
    };
  } catch (error) {
    return {
      files: [],
      truncated: [],
      unreachable: [],
      unavailable:
        error instanceof DecisionError
          ? error.message
          : "Could not load files from GitHub just now.",
    };
  }
}

function referenceLabel(
  owner: string,
  name: string,
  path: string,
  range: LineRange | null,
): string {
  const suffix = range ? ` · ${formatRange(range)}` : "";
  return `${owner}/${name} · ${path}${suffix}`;
}

/**
 * Snapshot what a citation points at, right now: the file's blob SHA, and — when
 * a line range was given — the cited text itself. The snippet is what later lets
 * a moved block be told apart from a changed one.
 *
 * A range that does not land on any lines is dropped rather than stored: a
 * citation of nothing is worse than a citation of the whole file, because it
 * would silently never drift.
 */
async function snapshotFile(
  token: string,
  repo: { owner: string; name: string; defaultBranch: string },
  path: string,
  range: LineRange | null,
): Promise<{
  baselineSha: string | null;
  baselineSnippet: string | null;
  range: LineRange | null;
}> {
  if (!range) {
    const baselineSha = await getFileSha(
      token,
      repo.owner,
      repo.name,
      path,
      repo.defaultBranch,
    );
    return { baselineSha, baselineSnippet: null, range: null };
  }

  const file = await getFileContent(
    token,
    repo.owner,
    repo.name,
    path,
    repo.defaultBranch,
  );
  // Missing, or too large to inline — fall back to whole-file citation.
  if (!file) {
    return { baselineSha: null, baselineSnippet: null, range: null };
  }

  const snippet = extractRange(file.content, range);
  if (snippet === "") {
    return { baselineSha: file.sha, baselineSnippet: null, range: null };
  }
  return { baselineSha: file.sha, baselineSnippet: snippet, range };
}

export async function addFileReference(
  workspaceId: string,
  decisionId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const refused = refuseDemo(user);
  if (refused) return refused;
  const repoId = String(formData.get("repoId") ?? "");
  const path = String(formData.get("path") ?? "").trim();
  const range = parseRange(String(formData.get("lines") ?? ""));
  if (!repoId || !path) return { error: "Pick a file." };

  return attempt(async () => {
    const repo = await decisionService.getWorkspaceRepo(repoId);
    if (!repo || repo.workspaceId !== workspaceId) {
      throw new DecisionError("repository not found");
    }
    const token = await getReadToken(user.id);
    const snapshot = token
      ? await snapshotFile(token, repo, path, range)
      : { baselineSha: null, baselineSnippet: null, range: null };

    await decisionService.addReference(decisionId, user.id, {
      kind: "file",
      label: referenceLabel(repo.owner, repo.name, path, snapshot.range),
      url: fileUrl(
        repo.owner,
        repo.name,
        repo.defaultBranch,
        path,
        snapshot.range && formatRange(snapshot.range),
      ),
      repo: `${repo.owner}/${repo.name}`,
      path,
      startLine: snapshot.range?.start ?? null,
      endLine: snapshot.range?.end ?? null,
      baselineSnippet: snapshot.baselineSnippet,
      baselineSha: snapshot.baselineSha,
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
  const token = await getReadToken(user.id);
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
    let moved = 0;

    for (const ref of references) {
      if (ref.kind !== "file" || !ref.repo || !ref.path) continue;
      const [owner, name] = ref.repo.split("/");
      const repo = repos.find((r) => r.owner === owner && r.name === name);
      if (!repo || !owner || !name) continue;
      checked += 1;

      const ranged =
        ref.startLine !== null && ref.endLine !== null && ref.baselineSnippet !== null;

      // A whole-file reference only needs the SHA — no reason to pull contents.
      if (!ranged) {
        const sha = await getFileSha(token, owner, name, ref.path, repo.defaultBranch);
        await decisionService.recordReferenceState(ref.id, user.id, sha);
        if (sha === null) missing += 1;
        else if (ref.baselineSha && sha !== ref.baselineSha) changed += 1;
        continue;
      }

      const file = await getFileContent(token, owner, name, ref.path, repo.defaultBranch);
      if (!file) {
        // Gone, or too large to inline. Either way there is nothing to compare.
        await decisionService.recordReferenceState(ref.id, user.id, null);
        missing += 1;
        continue;
      }

      const verdict = compareSnippet({
        baseline: ref.baselineSnippet!,
        content: file.content,
        range: { start: ref.startLine!, end: ref.endLine! },
      });

      if (verdict.status === "changed") {
        await decisionService.recordReferenceState(ref.id, user.id, file.sha);
        changed += 1;
        continue;
      }

      // Synced or moved: the cited code is intact, so the reference stays in
      // sync regardless of what the rest of the file did. Recording the
      // baseline SHA rather than the file's current one is what keeps
      // `referenceDrift` — a pure read of stored state — telling the truth.
      await decisionService.recordReferenceState(
        ref.id,
        user.id,
        ref.baselineSha,
        verdict.status === "moved" ? verdict.range : undefined,
      );
      if (verdict.status === "moved") moved += 1;
    }

    revalidatePath(`/app/${workspaceId}/${decisionId}`);
    if (checked === 0) return { ok: "No file references to check." };

    const parts = [`Checked ${checked} file ${checked === 1 ? "reference" : "references"}`];
    if (changed) parts.push(`${changed} changed`);
    if (missing) parts.push(`${missing} missing`);
    if (moved) parts.push(`${moved} moved but unchanged`);
    if (!changed && !missing) parts.push("all in sync");
    return { ok: parts.join(" — ") };
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }
}

/** Files cited while composing, as buffered by the editor's hidden inputs. */
function citedRefs(formData: FormData) {
  const repoIds = formData.getAll("refRepoId").map(String);
  const repos = formData.getAll("refRepoLabel").map(String);
  const paths = formData.getAll("refPath").map(String);
  const lines = formData.getAll("refLines").map(String);
  return repoIds.map((repoId, i) => ({
    repoId,
    repo: repos[i] ?? "",
    path: paths[i] ?? "",
    lines: lines[i] || null,
  }));
}

/**
 * Park an unsent decision. Nothing is validated — an empty draft is legitimate,
 * which is precisely what distinguishes a draft from a proposal.
 */
export async function saveDraft(
  workspaceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = String(formData.get("draftId") ?? "") || undefined;

  return attempt(async () => {
    await decisionService.saveDraft(workspaceId, user.id, {
      id,
      title: String(formData.get("title") ?? "").trim(),
      body: adrBody(formData),
      refs: citedRefs(formData),
    });
    revalidatePath(`/app/${workspaceId}`);
  }, "Saved as a draft.");
}

export async function discardDraft(workspaceId: string, draftId: string) {
  const user = await requireUser();
  await decisionService.deleteDraft(draftId, user.id);
  revalidatePath(`/app/${workspaceId}`);
}

export async function propose(workspaceId: string, formData: FormData) {
  const user = await requireUser();
  const refused = refuseDemo(user);
  if (refused) return refused;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const decision = await decisionService.propose(workspaceId, user.id, {
    title,
    body: adrBody(formData),
  });
  // Files cited while composing are buffered client-side; attach them now so the
  // baseline SHA is the one the author was actually looking at when deciding.
  await attachCitedFiles(workspaceId, decision.id, user.id, formData);

  // The draft became a decision — it has no reason to keep existing. Deleted
  // last, so a failure anywhere above leaves the author's text recoverable.
  const draftId = String(formData.get("draftId") ?? "");
  if (draftId) {
    try {
      await decisionService.deleteDraft(draftId, user.id);
    } catch {
      // A stale draft is untidy, never harmful. The proposal already landed.
    }
  }

  redirect(`/app/${workspaceId}/${decision.id}`);
}

async function attachCitedFiles(
  workspaceId: string,
  decisionId: string,
  userId: string,
  formData: FormData,
) {
  const repoIds = formData.getAll("refRepoId").map(String);
  const paths = formData.getAll("refPath").map(String);
  const lines = formData.getAll("refLines").map(String);
  if (repoIds.length === 0) return;

  const token = await getReadToken(userId);
  for (let i = 0; i < repoIds.length; i++) {
    const path = paths[i];
    const repoId = repoIds[i];
    if (!path || !repoId) continue;
    try {
      const repo = await decisionService.getWorkspaceRepo(repoId);
      if (!repo || repo.workspaceId !== workspaceId) continue;
      const snapshot = token
        ? await snapshotFile(token, repo, path, parseRange(lines[i] ?? ""))
        : { baselineSha: null, baselineSnippet: null, range: null };
      await decisionService.addReference(decisionId, userId, {
        kind: "file",
        label: referenceLabel(repo.owner, repo.name, path, snapshot.range),
        url: fileUrl(
          repo.owner,
          repo.name,
          repo.defaultBranch,
          path,
          snapshot.range && formatRange(snapshot.range),
        ),
        repo: `${repo.owner}/${repo.name}`,
        path,
        startLine: snapshot.range?.start ?? null,
        endLine: snapshot.range?.end ?? null,
        baselineSnippet: snapshot.baselineSnippet,
        baselineSha: snapshot.baselineSha,
      });
    } catch {
      // The decision itself is already recorded — a failed citation must not
      // discard it. The author can re-add the file from the decision page.
    }
  }
}

export async function revise(
  workspaceId: string,
  decisionId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const refused = refuseDemo(user);
  if (refused) return refused;
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
  const refused = refuseDemo(user);
  if (refused) return refused;
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
    // Accepting fixes the decision's reference point: from here, "drifted"
    // means the code moved away from what the team agreed to.
    if (toStatus === "accepted") {
      await rebaselineOnAccept(workspaceId, decisionId, user.id);
    }
    revalidatePath(`/app/${workspaceId}/${decisionId}`);
  }, `Decision ${label}.`);
}

/**
 * Re-snapshot every file this decision cites, at the moment it is accepted.
 *
 * Best-effort by design: the decision has already been accepted, and a GitHub
 * outage must not undo an audited state transition. A reference that cannot be
 * re-read keeps its drafting baseline, which is the old behaviour rather than a
 * broken one.
 */
async function rebaselineOnAccept(
  workspaceId: string,
  decisionId: string,
  userId: string,
): Promise<void> {
  try {
    const token = await getReadToken(userId);
    if (!token) return;

    const [references, repos] = await Promise.all([
      decisionService.listReferences(decisionId),
      decisionService.listWorkspaceRepos(workspaceId),
    ]);

    const snapshots = [];
    for (const ref of references) {
      if (ref.kind !== "file" || !ref.repo || !ref.path) continue;
      const [owner, name] = ref.repo.split("/");
      const repo = repos.find((r) => r.owner === owner && r.name === name);
      if (!repo) continue;

      const range =
        ref.startLine !== null && ref.endLine !== null
          ? { start: ref.startLine, end: ref.endLine }
          : null;

      // A cited block may have moved while the proposal sat in review. Follow
      // it rather than re-pinning the old line numbers to different code.
      let following = range;
      if (range && ref.baselineSnippet) {
        const current = await getFileContent(
          token,
          repo.owner,
          repo.name,
          ref.path,
          repo.defaultBranch,
        );
        if (current) {
          const verdict = compareSnippet({
            baseline: ref.baselineSnippet,
            content: current.content,
            range,
          });
          if (verdict.status === "moved") following = verdict.range;
        }
      }

      const snapshot = await snapshotFile(token, repo, ref.path, following);
      snapshots.push({
        referenceId: ref.id,
        baselineSha: snapshot.baselineSha,
        baselineSnippet: snapshot.baselineSnippet,
        startLine: snapshot.range?.start ?? null,
        endLine: snapshot.range?.end ?? null,
      });
    }

    await decisionService.rebaselineReferences(decisionId, snapshots);
  } catch {
    // See the doc comment: the acceptance stands regardless.
  }
}

export async function supersede(
  workspaceId: string,
  supersedingId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const refused = refuseDemo(user);
  if (refused) return refused;
  const supersededId = String(formData.get("supersededId") ?? "");
  if (!supersededId) return;
  await decisionService.supersede(supersedingId, supersededId, user.id);
  revalidatePath(`/app/${workspaceId}`);
  redirect(`/app/${workspaceId}/${supersedingId}`);
}
