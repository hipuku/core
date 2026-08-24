import { and, asc, count, desc, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  decisionDrafts,
  decisionReferences,
  decisions,
  decisionTransitions,
  memberships,
  workspaceRepos,
  workspaces,
} from "@/lib/db/schema";
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

/** jsonb comes back as `unknown`; the draft's shape is asserted at this edge. */
function toDraft(row: typeof decisionDrafts.$inferSelect): DraftRecord {
  return {
    ...row,
    body: row.body as DraftRecord["body"],
    refs: row.refs as DraftRecord["refs"],
  };
}

/**
 * The production DecisionStore, backed by Postgres. Same interface the in-memory
 * store implements and the service tests pin. The two multi-row writes run in a
 * transaction so a decision never exists without its opening transition, and a
 * status change never lands without its audit row.
 */
export class DrizzleDecisionStore implements DecisionStore {
  async createWorkspace(input: {
    id: string;
    name: string;
    key: string;
    ownerId: string;
    createdAt: Date;
  }): Promise<WorkspaceRecord> {
    const [row] = await db.insert(workspaces).values(input).returning();
    return row;
  }

  async addMember(input: MembershipRecord): Promise<MembershipRecord> {
    const [row] = await db
      .insert(memberships)
      .values(input)
      .onConflictDoUpdate({
        target: [memberships.workspaceId, memberships.userId],
        set: { role: input.role },
      })
      .returning();
    return row;
  }

  async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const [row] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listMembers(workspaceId: string): Promise<MembershipRecord[]> {
    return db
      .select()
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId))
      .orderBy(asc(memberships.createdAt));
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await db
      .delete(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, userId),
        ),
      );
  }

  async insertDecision(input: {
    decision: Omit<DecisionRecord, "number">;
    transition: TransitionRecord;
  }): Promise<DecisionRecord> {
    return db.transaction(async (tx) => {
      const [{ current }] = await tx
        .select({ current: max(decisions.number) })
        .from(decisions)
        .where(eq(decisions.workspaceId, input.decision.workspaceId));
      const number = (current ?? 0) + 1;

      const [row] = await tx
        .insert(decisions)
        .values({ ...input.decision, number })
        .returning();
      await tx.insert(decisionTransitions).values(input.transition);
      return toDecision(row);
    });
  }

  async upsertDraft(draft: DraftRecord): Promise<DraftRecord> {
    const [row] = await db
      .insert(decisionDrafts)
      .values(draft)
      .onConflictDoUpdate({
        target: decisionDrafts.id,
        // `createdAt` stays put: re-saving a draft is an edit, not a new draft.
        set: {
          title: draft.title,
          body: draft.body,
          refs: draft.refs,
          updatedAt: draft.updatedAt,
        },
      })
      .returning();
    return toDraft(row!);
  }

  async getDraft(id: string): Promise<DraftRecord | null> {
    const [row] = await db
      .select()
      .from(decisionDrafts)
      .where(eq(decisionDrafts.id, id))
      .limit(1);
    return row ? toDraft(row) : null;
  }

  async listDrafts(workspaceId: string, authorId: string): Promise<DraftRecord[]> {
    const rows = await db
      .select()
      .from(decisionDrafts)
      .where(
        and(
          eq(decisionDrafts.workspaceId, workspaceId),
          eq(decisionDrafts.authorId, authorId),
        ),
      )
      .orderBy(desc(decisionDrafts.updatedAt));
    return rows.map(toDraft);
  }

  async deleteDraft(id: string): Promise<void> {
    await db.delete(decisionDrafts).where(eq(decisionDrafts.id, id));
  }

  async peekNextNumber(workspaceId: string): Promise<number> {
    const [row] = await db
      .select({ current: max(decisions.number) })
      .from(decisions)
      .where(eq(decisions.workspaceId, workspaceId));
    return (row?.current ?? 0) + 1;
  }

  async getWorkspace(id: string): Promise<WorkspaceRecord | null> {
    const [row] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    return row ?? null;
  }

  async listWorkspacesForUser(userId: string): Promise<WorkspaceRecord[]> {
    return db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        key: workspaces.key,
        ownerId: workspaces.ownerId,
        createdAt: workspaces.createdAt,
      })
      .from(workspaces)
      .innerJoin(memberships, eq(memberships.workspaceId, workspaces.id))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(workspaces.createdAt));
  }

  async getDecision(id: string): Promise<DecisionRecord | null> {
    const [row] = await db
      .select()
      .from(decisions)
      .where(eq(decisions.id, id))
      .limit(1);
    return row ? toDecision(row) : null;
  }

  async listDecisions(workspaceId: string): Promise<DecisionRecord[]> {
    const rows = await db
      .select()
      .from(decisions)
      .where(eq(decisions.workspaceId, workspaceId))
      .orderBy(asc(decisions.number));
    return rows.map(toDecision);
  }

  async countDecisions(workspaceId: string): Promise<number> {
    const [row] = await db
      .select({ c: count() })
      .from(decisions)
      .where(eq(decisions.workspaceId, workspaceId));
    return row?.c ?? 0;
  }

  async countProposed(workspaceId: string): Promise<number> {
    const [row] = await db
      .select({ c: count() })
      .from(decisions)
      .where(
        and(
          eq(decisions.workspaceId, workspaceId),
          eq(decisions.status, "proposed"),
        ),
      );
    return row?.c ?? 0;
  }

  async updateWorkspace(
    id: string,
    patch: { name: string; key: string },
  ): Promise<void> {
    await db.update(workspaces).set(patch).where(eq(workspaces.id, id));
  }

  async deleteWorkspace(id: string): Promise<void> {
    await db.delete(workspaces).where(eq(workspaces.id, id));
  }

  async applyStatusChange(input: {
    decisionId: string;
    toStatus: DecisionRecord["status"];
    supersededById?: string | null;
    updatedAt: Date;
    transition: TransitionRecord;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(decisions)
        .set({
          status: input.toStatus,
          updatedAt: input.updatedAt,
          ...(input.supersededById !== undefined
            ? { supersededById: input.supersededById }
            : {}),
        })
        .where(eq(decisions.id, input.decisionId));
      await tx.insert(decisionTransitions).values(input.transition);
    });
  }

  async listTransitions(decisionId: string): Promise<TransitionRecord[]> {
    return db
      .select()
      .from(decisionTransitions)
      .where(eq(decisionTransitions.decisionId, decisionId))
      .orderBy(asc(decisionTransitions.createdAt));
  }

  async addReference(reference: ReferenceRecord): Promise<void> {
    await db.insert(decisionReferences).values(reference);
  }

  async getReference(id: string): Promise<ReferenceRecord | null> {
    const [row] = await db
      .select()
      .from(decisionReferences)
      .where(eq(decisionReferences.id, id))
      .limit(1);
    return row ?? null;
  }

  async listReferences(decisionId: string): Promise<ReferenceRecord[]> {
    return db
      .select()
      .from(decisionReferences)
      .where(eq(decisionReferences.decisionId, decisionId))
      .orderBy(asc(decisionReferences.createdAt));
  }

  async deleteReference(id: string): Promise<void> {
    await db.delete(decisionReferences).where(eq(decisionReferences.id, id));
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
    await db
      .update(decisionReferences)
      .set({
        baselineSha: state.baselineSha,
        baselineSnippet: state.baselineSnippet,
        startLine: state.startLine,
        endLine: state.endLine,
        // A freshly baselined reference is in sync with itself by definition.
        currentSha: state.baselineSha,
        checkedAt: state.checkedAt,
      })
      .where(eq(decisionReferences.id, id));
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
    await db
      .update(decisionReferences)
      .set({
        currentSha: state.currentSha,
        checkedAt: state.checkedAt,
        // Only written when the block moved; otherwise the range is untouched.
        ...(state.startLine !== undefined ? { startLine: state.startLine } : {}),
        ...(state.endLine !== undefined ? { endLine: state.endLine } : {}),
      })
      .where(eq(decisionReferences.id, id));
  }

  async addWorkspaceRepo(repo: RepoRecord): Promise<void> {
    await db.insert(workspaceRepos).values(repo);
  }

  async listWorkspaceRepos(workspaceId: string): Promise<RepoRecord[]> {
    return db
      .select()
      .from(workspaceRepos)
      .where(eq(workspaceRepos.workspaceId, workspaceId))
      .orderBy(asc(workspaceRepos.createdAt));
  }

  async getWorkspaceRepo(id: string): Promise<RepoRecord | null> {
    const [row] = await db
      .select()
      .from(workspaceRepos)
      .where(eq(workspaceRepos.id, id))
      .limit(1);
    return row ?? null;
  }

  async deleteWorkspaceRepo(id: string): Promise<void> {
    await db.delete(workspaceRepos).where(eq(workspaceRepos.id, id));
  }
}

function toDecision(row: typeof decisions.$inferSelect): DecisionRecord {
  return row;
}
