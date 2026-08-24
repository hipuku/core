import { randomUUID } from "node:crypto";
import { Versioning } from "@/lib/versioning/engine";
import type { HistoryEntry } from "@/lib/versioning/engine";
import type { Json } from "@/lib/versioning/types";
import {
  canEditContent,
  capabilitiesFor,
  checkSupersede,
  checkTransition,
} from "./lifecycle";
import type {
  DecisionRecord,
  DecisionStore,
  ReferenceKind,
  ReferenceRecord,
  RepoRecord,
  TransitionRecord,
} from "./store";
import type { Actor, DecisionStatus, Role } from "./types";

export interface Clock {
  now(): Date;
}
export interface IdGenerator {
  next(): string;
}

const systemClock: Clock = { now: () => new Date() };
const uuidGenerator: IdGenerator = { next: () => randomUUID() };

export class DecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionError";
  }
}

/**
 * The decision domain's orchestration layer. It composes three things it does not
 * itself own: the pure lifecycle rules (lib/decisions/lifecycle), the versioning
 * engine (lib/versioning, which holds each ADR's editable body), and a DecisionStore
 * (persistence). Every guard is a pure check from the lifecycle module; the service's
 * job is to resolve the acting user's capabilities, run the right guard, and persist
 * the result across both the versioning store and the decision store.
 */
export class DecisionService {
  constructor(
    private readonly store: DecisionStore,
    private readonly versioning: Versioning,
    private readonly clock: Clock = systemClock,
    private readonly ids: IdGenerator = uuidGenerator,
  ) {}

  async createWorkspace(ownerId: string, name: string) {
    const now = this.clock.now();
    const workspace = await this.store.createWorkspace({
      id: this.ids.next(),
      name,
      ownerId,
      createdAt: now,
    });
    // The creator is a maintainer of their own workspace.
    await this.store.addMember({
      workspaceId: workspace.id,
      userId: ownerId,
      role: "maintainer",
      createdAt: now,
    });
    return workspace;
  }

  async addMember(workspaceId: string, userId: string, role: Role) {
    return this.store.addMember({
      workspaceId,
      userId,
      role,
      createdAt: this.clock.now(),
    });
  }

  /**
   * Add someone to a workspace with a role. Managing membership is a maintainer-only
   * act — distinct from the decision capabilities, which is why it is a direct role
   * check rather than one of the lifecycle guards.
   */
  async inviteMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    role: Role,
  ) {
    const actorRole = await this.roleOf(workspaceId, actorId);
    if (actorRole !== "maintainer") {
      throw new DecisionError("only a maintainer can manage members");
    }
    return this.addMember(workspaceId, targetUserId, role);
  }

  listMembers(workspaceId: string) {
    return this.store.listMembers(workspaceId);
  }

  /** Connect a GitHub repo to a workspace. Maintainer-only, like membership. */
  async connectRepo(
    workspaceId: string,
    userId: string,
    input: { owner: string; name: string; defaultBranch: string },
  ): Promise<RepoRecord> {
    const role = await this.roleOf(workspaceId, userId);
    if (role !== "maintainer") {
      throw new DecisionError("only a maintainer can connect a repository");
    }
    const repo: RepoRecord = {
      id: this.ids.next(),
      workspaceId,
      owner: input.owner,
      name: input.name,
      defaultBranch: input.defaultBranch,
      connectedBy: userId,
      createdAt: this.clock.now(),
    };
    await this.store.addWorkspaceRepo(repo);
    return repo;
  }

  listWorkspaceRepos(workspaceId: string): Promise<RepoRecord[]> {
    return this.store.listWorkspaceRepos(workspaceId);
  }

  getWorkspaceRepo(id: string): Promise<RepoRecord | null> {
    return this.store.getWorkspaceRepo(id);
  }

  async disconnectRepo(repoId: string, userId: string): Promise<void> {
    const repo = await this.store.getWorkspaceRepo(repoId);
    if (!repo) throw new DecisionError("repository not found");
    const role = await this.roleOf(repo.workspaceId, userId);
    if (role !== "maintainer") {
      throw new DecisionError("only a maintainer can disconnect a repository");
    }
    await this.store.deleteWorkspaceRepo(repoId);
  }

  /** Open a new ADR as a proposal, seeding its body into a versioned document. */
  async propose(
    workspaceId: string,
    userId: string,
    input: { title: string; body: Json },
  ): Promise<DecisionRecord> {
    const actor = await this.actor(workspaceId, userId);
    if (!actor.capabilities.includes("propose")) {
      throw new DecisionError("you do not have permission to propose decisions");
    }

    const { document } = await this.versioning.create(
      userId,
      input.title,
      input.body,
    );
    const now = this.clock.now();
    const decisionId = this.ids.next();

    return this.store.insertDecision({
      decision: {
        id: decisionId,
        workspaceId,
        title: input.title,
        status: "proposed",
        authorId: userId,
        documentId: document.id,
        supersededById: null,
        createdAt: now,
        updatedAt: now,
      },
      transition: this.transition(decisionId, null, "proposed", userId, null, now),
    });
  }

  /** Revise a proposal's body. Refused once the decision is no longer editable. */
  async revise(decisionId: string, userId: string, body: Json): Promise<void> {
    const decision = await this.requireDecision(decisionId);
    const actor = await this.actor(decision.workspaceId, userId);
    const guard = canEditContent(
      decision.status,
      actor,
      decision.authorId === userId,
    );
    if (!guard.ok) throw new DecisionError(guard.reason);
    await this.versioning.commit(decision.documentId, body, userId, "Revised");
  }

  /** Move a decision along the lifecycle (accept, reject, deprecate). */
  async changeStatus(
    decisionId: string,
    userId: string,
    toStatus: DecisionStatus,
    reason?: string,
  ): Promise<void> {
    const decision = await this.requireDecision(decisionId);
    const actor = await this.actor(decision.workspaceId, userId);
    const guard = checkTransition(decision.status, toStatus, actor);
    if (!guard.ok) throw new DecisionError(guard.reason);

    const now = this.clock.now();
    await this.store.applyStatusChange({
      decisionId,
      toStatus,
      updatedAt: now,
      transition: this.transition(
        decisionId,
        decision.status,
        toStatus,
        userId,
        reason ?? null,
        now,
      ),
    });
  }

  /** Replace one accepted decision with another, linking and superseding the old. */
  async supersede(
    supersedingId: string,
    supersededId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    const superseding = await this.requireDecision(supersedingId);
    const superseded = await this.requireDecision(supersededId);
    if (superseding.workspaceId !== superseded.workspaceId) {
      throw new DecisionError("decisions belong to different workspaces");
    }
    const actor = await this.actor(superseded.workspaceId, userId);
    const guard = checkSupersede({
      superseding: { id: superseding.id, status: superseding.status },
      superseded: { id: superseded.id, status: superseded.status },
      actor,
    });
    if (!guard.ok) throw new DecisionError(guard.reason);

    const now = this.clock.now();
    await this.store.applyStatusChange({
      decisionId: supersededId,
      toStatus: "superseded",
      supersededById: supersedingId,
      updatedAt: now,
      transition: this.transition(
        supersededId,
        superseded.status,
        "superseded",
        userId,
        reason ?? null,
        now,
      ),
    });
  }

  listWorkspaces(userId: string) {
    return this.store.listWorkspacesForUser(userId);
  }

  getWorkspace(id: string) {
    return this.store.getWorkspace(id);
  }

  /** The acting user's role in a workspace, or null if they are not a member. */
  async roleOf(workspaceId: string, userId: string): Promise<Role | null> {
    const membership = await this.store.getMembership(workspaceId, userId);
    return membership?.role ?? null;
  }

  getDecision(id: string): Promise<DecisionRecord | null> {
    return this.store.getDecision(id);
  }

  listDecisions(workspaceId: string): Promise<DecisionRecord[]> {
    return this.store.listDecisions(workspaceId);
  }

  /**
   * Attach a reference (evidence) to a decision. Any workspace member may add one —
   * references augment a decision rather than change its prose, and adding a PR link
   * to an already-accepted decision is a legitimate thing to want to do.
   */
  async addReference(
    decisionId: string,
    userId: string,
    input: {
      kind: ReferenceKind;
      label?: string | null;
      url?: string | null;
      repo?: string | null;
      path?: string | null;
      baselineSha?: string | null;
    },
  ): Promise<ReferenceRecord> {
    const decision = await this.requireDecision(decisionId);
    const role = await this.roleOf(decision.workspaceId, userId);
    if (!role) throw new DecisionError("you are not a member of this workspace");

    const now = this.clock.now();
    const baselineSha = input.baselineSha ?? null;
    const reference: ReferenceRecord = {
      id: this.ids.next(),
      decisionId,
      kind: input.kind,
      label: input.label ?? null,
      url: input.url ?? null,
      repo: input.repo ?? null,
      path: input.path ?? null,
      baselineSha,
      // A freshly cited file starts in sync with its baseline.
      currentSha: baselineSha,
      checkedAt: baselineSha ? now : null,
      addedBy: userId,
      createdAt: now,
    };
    await this.store.addReference(reference);
    return reference;
  }

  /**
   * Record the latest observed SHA for a file reference (from a drift check).
   * The GitHub call happens in the action layer; the service just persists it,
   * gated on workspace membership.
   */
  async recordReferenceState(
    referenceId: string,
    userId: string,
    currentSha: string | null,
  ): Promise<void> {
    const reference = await this.store.getReference(referenceId);
    if (!reference) throw new DecisionError("reference not found");
    const decision = await this.requireDecision(reference.decisionId);
    const role = await this.roleOf(decision.workspaceId, userId);
    if (!role) throw new DecisionError("you are not a member of this workspace");
    await this.store.updateReferenceState(referenceId, {
      currentSha,
      checkedAt: this.clock.now(),
    });
  }

  listReferences(decisionId: string): Promise<ReferenceRecord[]> {
    return this.store.listReferences(decisionId);
  }

  /** Remove a reference — the person who added it, or any maintainer. */
  async removeReference(referenceId: string, userId: string): Promise<void> {
    const reference = await this.store.getReference(referenceId);
    if (!reference) throw new DecisionError("reference not found");
    const decision = await this.requireDecision(reference.decisionId);
    const role = await this.roleOf(decision.workspaceId, userId);
    if (!role) throw new DecisionError("you are not a member of this workspace");
    if (role !== "maintainer" && reference.addedBy !== userId) {
      throw new DecisionError(
        "only the person who added it or a maintainer can remove a reference",
      );
    }
    await this.store.deleteReference(referenceId);
  }

  /** The content trail: how the ADR's text changed, version by version. */
  async contentHistory(decisionId: string): Promise<HistoryEntry[]> {
    const decision = await this.requireDecision(decisionId);
    return this.versioning.history(decision.documentId);
  }

  /** The status trail: how the decision itself moved through the lifecycle. */
  statusHistory(decisionId: string): Promise<TransitionRecord[]> {
    return this.store.listTransitions(decisionId);
  }

  private transition(
    decisionId: string,
    fromStatus: DecisionStatus | null,
    toStatus: DecisionStatus,
    actorId: string,
    reason: string | null,
    createdAt: Date,
  ): TransitionRecord {
    return {
      id: this.ids.next(),
      decisionId,
      fromStatus,
      toStatus,
      actorId,
      reason,
      createdAt,
    };
  }

  private async actor(workspaceId: string, userId: string): Promise<Actor> {
    const membership = await this.store.getMembership(workspaceId, userId);
    if (!membership) {
      throw new DecisionError("you are not a member of this workspace");
    }
    return { id: userId, capabilities: capabilitiesFor(membership.role) };
  }

  private async requireDecision(id: string): Promise<DecisionRecord> {
    const decision = await this.store.getDecision(id);
    if (!decision) throw new DecisionError("decision not found");
    return decision;
  }
}
