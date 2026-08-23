import { and, asc, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  decisions,
  decisionTransitions,
  memberships,
  workspaces,
} from "@/lib/db/schema";
import type {
  DecisionRecord,
  DecisionStore,
  MembershipRecord,
  TransitionRecord,
  WorkspaceRecord,
} from "./store";

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
}

function toDecision(row: typeof decisions.$inferSelect): DecisionRecord {
  return row;
}
