import type {
  DecisionRecord,
  DecisionStore,
  MembershipRecord,
  ReferenceRecord,
  RepoRecord,
  TransitionRecord,
  WorkspaceRecord,
} from "./store";

/**
 * In-memory DecisionStore. Satisfies the exact contract the Drizzle store does, so
 * the service tests that run against it are statements about real orchestration, not
 * about a mock. Per-workspace ADR numbering is a counter here; the Drizzle store
 * derives it inside the insert transaction.
 */
export class MemoryDecisionStore implements DecisionStore {
  private workspaces = new Map<string, WorkspaceRecord>();
  private members = new Map<string, MembershipRecord>();
  private decisions = new Map<string, DecisionRecord>();
  private transitions: TransitionRecord[] = [];
  private references = new Map<string, ReferenceRecord>();
  private repos = new Map<string, RepoRecord>();
  private counters = new Map<string, number>();

  private memberKey(workspaceId: string, userId: string): string {
    return `${workspaceId}:${userId}`;
  }

  async createWorkspace(input: {
    id: string;
    name: string;
    ownerId: string;
    createdAt: Date;
  }): Promise<WorkspaceRecord> {
    const record: WorkspaceRecord = { ...input };
    this.workspaces.set(record.id, { ...record });
    return { ...record };
  }

  async addMember(input: MembershipRecord): Promise<MembershipRecord> {
    this.members.set(this.memberKey(input.workspaceId, input.userId), {
      ...input,
    });
    return { ...input };
  }

  async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const record = this.members.get(this.memberKey(workspaceId, userId));
    return record ? { ...record } : null;
  }

  async listMembers(workspaceId: string): Promise<MembershipRecord[]> {
    return [...this.members.values()]
      .filter((m) => m.workspaceId === workspaceId)
      .map((m) => ({ ...m }));
  }

  async insertDecision(input: {
    decision: Omit<DecisionRecord, "number">;
    transition: TransitionRecord;
  }): Promise<DecisionRecord> {
    const next = (this.counters.get(input.decision.workspaceId) ?? 0) + 1;
    this.counters.set(input.decision.workspaceId, next);
    const record: DecisionRecord = { ...input.decision, number: next };
    this.decisions.set(record.id, { ...record });
    this.transitions.push({ ...input.transition });
    return { ...record };
  }

  async getWorkspace(id: string): Promise<WorkspaceRecord | null> {
    const record = this.workspaces.get(id);
    return record ? { ...record } : null;
  }

  async listWorkspacesForUser(userId: string): Promise<WorkspaceRecord[]> {
    const workspaceIds = new Set(
      [...this.members.values()]
        .filter((m) => m.userId === userId)
        .map((m) => m.workspaceId),
    );
    return [...this.workspaces.values()]
      .filter((w) => workspaceIds.has(w.id))
      .map((w) => ({ ...w }));
  }

  async getDecision(id: string): Promise<DecisionRecord | null> {
    const record = this.decisions.get(id);
    return record ? { ...record } : null;
  }

  async listDecisions(workspaceId: string): Promise<DecisionRecord[]> {
    return [...this.decisions.values()]
      .filter((d) => d.workspaceId === workspaceId)
      .sort((a, b) => a.number - b.number)
      .map((d) => ({ ...d }));
  }

  async applyStatusChange(input: {
    decisionId: string;
    toStatus: DecisionRecord["status"];
    supersededById?: string | null;
    updatedAt: Date;
    transition: TransitionRecord;
  }): Promise<void> {
    const record = this.decisions.get(input.decisionId);
    if (!record) throw new Error("decision not found");
    record.status = input.toStatus;
    record.updatedAt = input.updatedAt;
    if (input.supersededById !== undefined) {
      record.supersededById = input.supersededById;
    }
    this.transitions.push({ ...input.transition });
  }

  async listTransitions(decisionId: string): Promise<TransitionRecord[]> {
    return this.transitions
      .filter((t) => t.decisionId === decisionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((t) => ({ ...t }));
  }

  async addReference(reference: ReferenceRecord): Promise<void> {
    this.references.set(reference.id, { ...reference });
  }

  async getReference(id: string): Promise<ReferenceRecord | null> {
    const record = this.references.get(id);
    return record ? { ...record } : null;
  }

  async listReferences(decisionId: string): Promise<ReferenceRecord[]> {
    return [...this.references.values()]
      .filter((r) => r.decisionId === decisionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => ({ ...r }));
  }

  async deleteReference(id: string): Promise<void> {
    this.references.delete(id);
  }

  async addWorkspaceRepo(repo: RepoRecord): Promise<void> {
    this.repos.set(repo.id, { ...repo });
  }

  async listWorkspaceRepos(workspaceId: string): Promise<RepoRecord[]> {
    return [...this.repos.values()]
      .filter((r) => r.workspaceId === workspaceId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => ({ ...r }));
  }

  async getWorkspaceRepo(id: string): Promise<RepoRecord | null> {
    const record = this.repos.get(id);
    return record ? { ...record } : null;
  }

  async deleteWorkspaceRepo(id: string): Promise<void> {
    this.repos.delete(id);
  }
}
