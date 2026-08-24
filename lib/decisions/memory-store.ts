import type {
  DecisionRecord,
  DecisionStore,
  DraftRecord,
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
    key: string;
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

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    this.members.delete(this.memberKey(workspaceId, userId));
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

  private drafts = new Map<string, DraftRecord>();

  async upsertDraft(draft: DraftRecord): Promise<DraftRecord> {
    const existing = this.drafts.get(draft.id);
    const record: DraftRecord = {
      ...draft,
      createdAt: existing?.createdAt ?? draft.createdAt,
    };
    this.drafts.set(record.id, { ...record });
    return { ...record };
  }

  async getDraft(id: string): Promise<DraftRecord | null> {
    const record = this.drafts.get(id);
    return record ? { ...record } : null;
  }

  async listDrafts(workspaceId: string, authorId: string): Promise<DraftRecord[]> {
    return [...this.drafts.values()]
      .filter((d) => d.workspaceId === workspaceId && d.authorId === authorId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((d) => ({ ...d }));
  }

  async deleteDraft(id: string): Promise<void> {
    this.drafts.delete(id);
  }

  async peekNextNumber(workspaceId: string): Promise<number> {
    return (this.counters.get(workspaceId) ?? 0) + 1;
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

  async countDecisions(workspaceId: string): Promise<number> {
    return [...this.decisions.values()].filter(
      (d) => d.workspaceId === workspaceId,
    ).length;
  }

  async countProposed(workspaceId: string): Promise<number> {
    return [...this.decisions.values()].filter(
      (d) => d.workspaceId === workspaceId && d.status === "proposed",
    ).length;
  }

  async updateWorkspace(
    id: string,
    patch: { name: string; key: string },
  ): Promise<void> {
    const ws = this.workspaces.get(id);
    if (ws) {
      ws.name = patch.name;
      ws.key = patch.key;
    }
  }

  async deleteWorkspace(id: string): Promise<void> {
    this.workspaces.delete(id);
    for (const [key, m] of this.members) {
      if (m.workspaceId === id) this.members.delete(key);
    }
    for (const [key, d] of this.decisions) {
      if (d.workspaceId === id) this.decisions.delete(key);
    }
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

  async rebaselineReference(
    id: string,
    state: {
      baselineSha: string | null;
      baselineSnippet: string | null;
      startLine: number | null;
      endLine: number | null;
      checkedAt: Date;
    },
  ): Promise<void> {
    const record = this.references.get(id);
    if (!record) return;
    record.baselineSha = state.baselineSha;
    record.baselineSnippet = state.baselineSnippet;
    record.startLine = state.startLine;
    record.endLine = state.endLine;
    // A freshly baselined reference is in sync with itself by definition.
    record.currentSha = state.baselineSha;
    record.checkedAt = state.checkedAt;
  }

  async updateReferenceState(
    id: string,
    state: {
      currentSha: string | null;
      checkedAt: Date;
      startLine?: number;
      endLine?: number;
    },
  ): Promise<void> {
    const record = this.references.get(id);
    if (!record) return;
    record.currentSha = state.currentSha;
    record.checkedAt = state.checkedAt;
    if (state.startLine !== undefined) record.startLine = state.startLine;
    if (state.endLine !== undefined) record.endLine = state.endLine;
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
