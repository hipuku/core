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
