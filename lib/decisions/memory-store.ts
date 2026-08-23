import type {
  DecisionRecord,
  DecisionStore,
  MembershipRecord,
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
}
