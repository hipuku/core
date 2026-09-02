import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { documents, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/pg";
import { DrizzleDecisionStore } from "./drizzle-store";
import { MemoryDecisionStore } from "./memory-store";
import type {
  DecisionRecord,
  DecisionStore,
  DraftRecord,
  ReferenceRecord,
  RepoRecord,
  TransitionRecord,
} from "./store";

/**
 * One suite, both stores.
 *
 * Every other domain test in this repo constructs `MemoryDecisionStore`, so
 * what they prove about the permission model, which is the product, they prove
 * about a double. `DrizzleDecisionStore` is the class that enforces those rules
 * in production and it ran no test at all. `store-parity.test.ts` holds the two
 * to the same method set, which catches a method added to one side and
 * forgotten on the other and catches nothing about behaviour.
 *
 * This is the behavioural half. Each case runs twice against the same
 * assertions, so a difference between the double and the real thing is a
 * failure rather than a surprise in production: an ordering that only holds
 * because a Map preserves insertion order, a null the SQL side stores
 * differently, a count that includes a row the other excludes.
 *
 * The Postgres is PGlite, the real engine compiled to WebAssembly, so no
 * database has to be reachable for the suite to run. See `test/pg.ts`.
 */

const AUTHOR = "user_author";
const OTHER = "user_other";

interface Harness {
  store: DecisionStore;
  /** Satisfy the foreign keys the SQL schema declares and the Map does not. */
  seed(ids: { users: string[]; documents: string[] }): Promise<void>;
}

let pg: TestDb | null = null;

const HARNESSES: [string, () => Promise<Harness>][] = [
  [
    "MemoryDecisionStore",
    async () => ({ store: new MemoryDecisionStore(), seed: async () => {} }),
  ],
  [
    "DrizzleDecisionStore",
    async () => {
      pg ??= await createTestDb();
      await pg.reset();
      const db = pg.db;
      return {
        store: new DrizzleDecisionStore(db),
        async seed({ users, documents: docs }) {
          await db.insert(user).values(
            users.map((id) => ({ id, name: id, email: `${id}@example.test` })),
          );
          await db
            .insert(documents)
            .values(docs.map((id) => ({ id, ownerId: users[0]!, name: id })));
        },
      };
    },
  ],
];

afterAll(async () => {
  await pg?.close();
});

describe.each(HARNESSES)("%s", (_name, makeHarness) => {
  let store: DecisionStore;
  let workspaceId: string;
  let documentIds: string[];

  const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 0, minutes, 0));

  function decision(over: Partial<DecisionRecord> & { documentId: string }) {
    return {
      id: randomUUID(),
      workspaceId,
      title: "A decision",
      status: "proposed" as const,
      authorId: AUTHOR,
      supersededById: null,
      createdAt: at(0),
      updatedAt: at(0),
      ...over,
    };
  }

  function transition(
    decisionId: string,
    over: Partial<TransitionRecord> = {},
  ): TransitionRecord {
    return {
      id: randomUUID(),
      decisionId,
      fromStatus: null,
      toStatus: "proposed",
      actorId: AUTHOR,
      reason: null,
      createdAt: at(0),
      ...over,
    };
  }

  async function insert(over: Partial<DecisionRecord> = {}, index = 0) {
    const d = decision({ documentId: documentIds[index]!, ...over });
    return store.insertDecision({ decision: d, transition: transition(d.id) });
  }

  beforeEach(async () => {
    const harness = await makeHarness();
    store = harness.store;
    workspaceId = randomUUID();
    documentIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await harness.seed({ users: [AUTHOR, OTHER], documents: documentIds });
    await store.createWorkspace({
      id: workspaceId,
      name: "Platform",
      key: "PLAT",
      ownerId: AUTHOR,
      createdAt: at(0),
    });
  });

  describe("workspaces and membership", () => {
    it("reads back a workspace it created", async () => {
      const w = await store.getWorkspace(workspaceId);
      expect(w).toMatchObject({ name: "Platform", key: "PLAT", ownerId: AUTHOR });
    });

    it("returns null for a workspace that does not exist", async () => {
      expect(await store.getWorkspace(randomUUID())).toBeNull();
    });

    it("upserts a membership rather than duplicating it", async () => {
      await store.addMember({ workspaceId, userId: OTHER, role: "author", createdAt: at(1) });
      await store.addMember({ workspaceId, userId: OTHER, role: "maintainer", createdAt: at(2) });
      const members = await store.listMembers(workspaceId);
      expect(members).toHaveLength(1);
      expect(members[0]!.role).toBe("maintainer");
    });

    it("lists members oldest first", async () => {
      await store.addMember({ workspaceId, userId: OTHER, role: "author", createdAt: at(5) });
      await store.addMember({ workspaceId, userId: AUTHOR, role: "maintainer", createdAt: at(1) });
      expect((await store.listMembers(workspaceId)).map((m) => m.userId)).toEqual([
        AUTHOR,
        OTHER,
      ]);
    });

    it("scopes membership lookup to the workspace", async () => {
      await store.addMember({ workspaceId, userId: OTHER, role: "author", createdAt: at(1) });
      expect(await store.getMembership(randomUUID(), OTHER)).toBeNull();
      expect(await store.getMembership(workspaceId, OTHER)).not.toBeNull();
    });

    it("removes a member without touching the other", async () => {
      await store.addMember({ workspaceId, userId: AUTHOR, role: "maintainer", createdAt: at(1) });
      await store.addMember({ workspaceId, userId: OTHER, role: "author", createdAt: at(2) });
      await store.removeMember(workspaceId, OTHER);
      expect((await store.listMembers(workspaceId)).map((m) => m.userId)).toEqual([AUTHOR]);
    });

    it("lists a user's workspaces through membership", async () => {
      await store.addMember({ workspaceId, userId: OTHER, role: "author", createdAt: at(1) });
      expect((await store.listWorkspacesForUser(OTHER)).map((w) => w.id)).toEqual([workspaceId]);
      expect(await store.listWorkspacesForUser("user_nobody")).toEqual([]);
    });

    it("lists a user's workspaces oldest first", async () => {
      const older = randomUUID();
      await store.createWorkspace({
        id: older,
        name: "Older",
        key: "OLD",
        ownerId: AUTHOR,
        createdAt: at(-10),
      });
      await store.addMember({ workspaceId: older, userId: OTHER, role: "author", createdAt: at(2) });
      await store.addMember({ workspaceId, userId: OTHER, role: "author", createdAt: at(1) });
      // The membership rows are added in the opposite order to the workspaces,
      // so a store returning insertion order gets this backwards.
      expect((await store.listWorkspacesForUser(OTHER)).map((w) => w.id)).toEqual([
        older,
        workspaceId,
      ]);
    });

    it("updates a workspace's name and key", async () => {
      await store.updateWorkspace(workspaceId, { name: "Design", key: "DSGN" });
      expect(await store.getWorkspace(workspaceId)).toMatchObject({
        name: "Design",
        key: "DSGN",
      });
    });
  });

  describe("decision numbering", () => {
    it("assigns 1 to the first decision in a workspace", async () => {
      expect((await insert()).number).toBe(1);
    });

    it("increments per workspace, not globally", async () => {
      await insert({}, 0);
      await insert({}, 1);
      expect((await insert({}, 2)).number).toBe(3);
    });

    it("previews the next number without reserving it", async () => {
      await insert();
      // Two calls in a row must agree: peek is a preview for the compose
      // screen, and a reservation would leave gaps in the ADR sequence.
      expect(await store.peekNextNumber(workspaceId)).toBe(2);
      expect(await store.peekNextNumber(workspaceId)).toBe(2);
    });

    it("previews 1 for a workspace with no decisions", async () => {
      expect(await store.peekNextNumber(workspaceId)).toBe(1);
    });

    it("writes the opening transition with the decision", async () => {
      const d = await insert();
      const transitions = await store.listTransitions(d.id);
      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toMatchObject({ fromStatus: null, toStatus: "proposed" });
    });
  });

  describe("decision reads", () => {
    it("returns null for a decision that does not exist", async () => {
      expect(await store.getDecision(randomUUID())).toBeNull();
    });

    it("lists decisions in ADR number order, not in insertion order", async () => {
      // Ascending number rather than newest first: the list is a register, and
      // a register reads in the order its entries were numbered.
      const first = await insert({ createdAt: at(9) }, 0);
      const second = await insert({ createdAt: at(1) }, 1);
      expect((await store.listDecisions(workspaceId)).map((d) => d.id)).toEqual([
        first.id,
        second.id,
      ]);
    });

    it("counts decisions in the workspace", async () => {
      await insert({}, 0);
      await insert({}, 1);
      expect(await store.countDecisions(workspaceId)).toBe(2);
      expect(await store.countDecisions(randomUUID())).toBe(0);
    });

    it("counts only the proposed ones", async () => {
      const a = await insert({}, 0);
      await insert({}, 1);
      await store.applyStatusChange({
        decisionId: a.id,
        toStatus: "accepted",
        updatedAt: at(3),
        transition: transition(a.id, { fromStatus: "proposed", toStatus: "accepted" }),
      });
      expect(await store.countProposed(workspaceId)).toBe(1);
      expect(await store.countDecisions(workspaceId)).toBe(2);
    });
  });

  describe("status changes", () => {
    it("moves the status and appends the transition together", async () => {
      const d = await insert();
      await store.applyStatusChange({
        decisionId: d.id,
        toStatus: "accepted",
        updatedAt: at(5),
        transition: transition(d.id, {
          fromStatus: "proposed",
          toStatus: "accepted",
          createdAt: at(5),
        }),
      });
      expect((await store.getDecision(d.id))!.status).toBe("accepted");
      expect(await store.listTransitions(d.id)).toHaveLength(2);
    });

    it("records the superseding decision", async () => {
      const old = await insert({}, 0);
      const replacement = await insert({}, 1);
      await store.applyStatusChange({
        decisionId: old.id,
        toStatus: "superseded",
        supersededById: replacement.id,
        updatedAt: at(6),
        transition: transition(old.id, {
          fromStatus: "proposed",
          toStatus: "superseded",
        }),
      });
      expect((await store.getDecision(old.id))!.supersededById).toBe(replacement.id);
    });

    it("leaves supersededById alone when the field is omitted", async () => {
      // Omitted and explicitly null are different instructions. A plain accept
      // must not clear a supersession that a previous change recorded.
      const old = await insert({}, 0);
      const replacement = await insert({}, 1);
      await store.applyStatusChange({
        decisionId: old.id,
        toStatus: "superseded",
        supersededById: replacement.id,
        updatedAt: at(6),
        transition: transition(old.id),
      });
      await store.applyStatusChange({
        decisionId: old.id,
        toStatus: "deprecated",
        updatedAt: at(7),
        transition: transition(old.id),
      });
      expect((await store.getDecision(old.id))!.supersededById).toBe(replacement.id);
    });

    it("lists transitions oldest first", async () => {
      const d = await insert();
      await store.applyStatusChange({
        decisionId: d.id,
        toStatus: "accepted",
        updatedAt: at(5),
        transition: transition(d.id, {
          fromStatus: "proposed",
          toStatus: "accepted",
          createdAt: at(5),
        }),
      });
      expect((await store.listTransitions(d.id)).map((t) => t.toStatus)).toEqual([
        "proposed",
        "accepted",
      ]);
    });
  });

  describe("references", () => {
    function reference(decisionId: string, over: Partial<ReferenceRecord> = {}): ReferenceRecord {
      return {
        id: randomUUID(),
        decisionId,
        kind: "file",
        label: null,
        url: null,
        repo: "acme/app",
        path: "src/index.ts",
        startLine: 10,
        endLine: 20,
        baselineSnippet: "before",
        baselineSha: "sha-old",
        currentSha: null,
        checkedAt: null,
        addedBy: AUTHOR,
        createdAt: at(1),
        ...over,
      };
    }

    it("round-trips a file reference including its null columns", async () => {
      const d = await insert();
      const ref = reference(d.id);
      await store.addReference(ref);
      expect(await store.getReference(ref.id)).toEqual(ref);
    });

    it("round-trips a link reference, where the file columns are null", async () => {
      const d = await insert();
      const ref = reference(d.id, {
        kind: "link",
        label: "RFC 9110",
        url: "https://example.test/rfc",
        repo: null,
        path: null,
        startLine: null,
        endLine: null,
        baselineSnippet: null,
        baselineSha: null,
      });
      await store.addReference(ref);
      expect(await store.getReference(ref.id)).toEqual(ref);
    });

    it("returns null for a reference that does not exist", async () => {
      expect(await store.getReference(randomUUID())).toBeNull();
    });

    it("lists a decision's references and no other decision's", async () => {
      const a = await insert({}, 0);
      const b = await insert({}, 1);
      const mine = reference(a.id);
      await store.addReference(mine);
      await store.addReference(reference(b.id));
      expect((await store.listReferences(a.id)).map((r) => r.id)).toEqual([mine.id]);
    });

    it("rebaselines to the state the code is in now", async () => {
      const d = await insert();
      const ref = reference(d.id);
      await store.addReference(ref);
      await store.rebaselineReference(ref.id, {
        baselineSha: "sha-new",
        baselineSnippet: "after",
        startLine: 30,
        endLine: 44,
        checkedAt: at(8),
      });
      expect(await store.getReference(ref.id)).toMatchObject({
        baselineSha: "sha-new",
        baselineSnippet: "after",
        startLine: 30,
        endLine: 44,
        checkedAt: at(8),
      });
    });

    it("updates the current sha without moving the range", async () => {
      const d = await insert();
      const ref = reference(d.id);
      await store.addReference(ref);
      await store.updateReferenceState(ref.id, { currentSha: "sha-head", checkedAt: at(9) });
      expect(await store.getReference(ref.id)).toMatchObject({
        currentSha: "sha-head",
        checkedAt: at(9),
        startLine: 10,
        endLine: 20,
        baselineSha: "sha-old",
      });
    });

    it("moves the range when the cited block was found to have moved", async () => {
      const d = await insert();
      const ref = reference(d.id);
      await store.addReference(ref);
      await store.updateReferenceState(ref.id, {
        currentSha: "sha-head",
        checkedAt: at(9),
        startLine: 12,
        endLine: 22,
      });
      expect(await store.getReference(ref.id)).toMatchObject({ startLine: 12, endLine: 22 });
    });

    it("deletes one reference and leaves the rest", async () => {
      const d = await insert();
      const gone = reference(d.id);
      const kept = reference(d.id);
      await store.addReference(gone);
      await store.addReference(kept);
      await store.deleteReference(gone.id);
      expect((await store.listReferences(d.id)).map((r) => r.id)).toEqual([kept.id]);
    });
  });

  describe("drafts", () => {
    function draft(over: Partial<DraftRecord> = {}): DraftRecord {
      return {
        id: randomUUID(),
        workspaceId,
        authorId: AUTHOR,
        title: "Untitled",
        body: { context: "", decision: "", consequences: "" },
        refs: [],
        createdAt: at(1),
        updatedAt: at(1),
        ...over,
      };
    }

    it("round-trips the jsonb body and refs", async () => {
      const d = draft({
        body: { context: "why", decision: "what", consequences: "cost" },
        refs: [{ repoId: "r1", repo: "acme/app", path: "src/a.ts", lines: "1-4" }],
      });
      await store.upsertDraft(d);
      expect(await store.getDraft(d.id)).toEqual(d);
    });

    it("keeps an empty body an empty body rather than a null", async () => {
      const d = draft();
      await store.upsertDraft(d);
      expect((await store.getDraft(d.id))!.body).toEqual({
        context: "",
        decision: "",
        consequences: "",
      });
    });

    it("updates in place on a second upsert", async () => {
      const d = draft();
      await store.upsertDraft(d);
      await store.upsertDraft({ ...d, title: "Named", updatedAt: at(4) });
      expect(await store.listDrafts(workspaceId, AUTHOR)).toHaveLength(1);
      expect((await store.getDraft(d.id))!.title).toBe("Named");
    });

    it("returns the upserted row", async () => {
      const d = draft({ title: "Returned" });
      expect(await store.upsertDraft(d)).toEqual(d);
    });

    it("lists an author's own drafts, newest first", async () => {
      const older = draft({ updatedAt: at(1) });
      const newer = draft({ updatedAt: at(9) });
      await store.upsertDraft(older);
      await store.upsertDraft(newer);
      await store.upsertDraft(draft({ authorId: OTHER }));
      expect((await store.listDrafts(workspaceId, AUTHOR)).map((d) => d.id)).toEqual([
        newer.id,
        older.id,
      ]);
    });

    it("returns null for a draft that does not exist", async () => {
      expect(await store.getDraft(randomUUID())).toBeNull();
    });

    it("deletes one draft", async () => {
      const d = draft();
      await store.upsertDraft(d);
      await store.deleteDraft(d.id);
      expect(await store.getDraft(d.id)).toBeNull();
    });

    it("discards an author's drafts older than a cutoff and reports how many", async () => {
      await store.upsertDraft(draft({ updatedAt: at(1) }));
      await store.upsertDraft(draft({ updatedAt: at(2) }));
      const kept = draft({ updatedAt: at(30) });
      await store.upsertDraft(kept);
      await store.upsertDraft(draft({ authorId: OTHER, updatedAt: at(1) }));

      expect(await store.deleteDraftsBefore(AUTHOR, at(10))).toBe(2);
      expect((await store.listDrafts(workspaceId, AUTHOR)).map((d) => d.id)).toEqual([kept.id]);
    });

    it("counts nothing when no draft is old enough", async () => {
      await store.upsertDraft(draft({ updatedAt: at(30) }));
      expect(await store.deleteDraftsBefore(AUTHOR, at(10))).toBe(0);
    });
  });

  describe("connected repositories", () => {
    function repo(over: Partial<RepoRecord> = {}): RepoRecord {
      return {
        id: randomUUID(),
        workspaceId,
        owner: "acme",
        name: "app",
        defaultBranch: "main",
        connectedBy: AUTHOR,
        createdAt: at(1),
        ...over,
      };
    }

    it("round-trips a connected repository", async () => {
      const r = repo();
      await store.addWorkspaceRepo(r);
      expect(await store.getWorkspaceRepo(r.id)).toEqual(r);
    });

    it("returns null for a repository that does not exist", async () => {
      expect(await store.getWorkspaceRepo(randomUUID())).toBeNull();
    });

    it("lists only this workspace's repositories", async () => {
      const mine = repo();
      await store.addWorkspaceRepo(mine);
      expect((await store.listWorkspaceRepos(workspaceId)).map((r) => r.id)).toEqual([mine.id]);
      expect(await store.listWorkspaceRepos(randomUUID())).toEqual([]);
    });

    it("deletes one repository", async () => {
      const r = repo();
      await store.addWorkspaceRepo(r);
      await store.deleteWorkspaceRepo(r.id);
      expect(await store.getWorkspaceRepo(r.id)).toBeNull();
    });
  });
});
