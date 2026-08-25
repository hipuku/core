import { beforeEach, describe, expect, it } from "vitest";
import { Versioning } from "@/lib/versioning/engine";
import { MemoryVersionStore } from "@/lib/versioning/memory-store";
import { referenceDrift } from "./drift";
import { MemoryDecisionStore } from "./memory-store";
import {
  DecisionError,
  DecisionService,
  MAX_DRAFTS_PER_AUTHOR,
  type Clock,
  type IdGenerator,
} from "./service";

function makeService() {
  let tick = 0;
  const clock: Clock = { now: () => new Date(1_000 + tick++ * 1_000) };
  let seq = 0;
  const ids: IdGenerator = { next: () => `id_${String(++seq).padStart(4, "0")}` };
  return new DecisionService(
    new MemoryDecisionStore(),
    new Versioning(new MemoryVersionStore()),
    clock,
    ids,
  );
}

const MAINTAINER = "user_owner";
const AUTHOR = "user_author";
const STRANGER = "user_stranger";

const EMPTY = { context: "", decision: "", consequences: "" };

describe("drafts", () => {
  let service: DecisionService;

  beforeEach(() => {
    service = makeService();
  });

  async function workspace() {
    const ws = await service.createWorkspace(MAINTAINER, "Platform");
    await service.addMember(ws.id, AUTHOR, "author");
    return ws;
  }

  it("saves a draft that is entirely empty", async () => {
    const ws = await workspace();
    const draft = await service.saveDraft(ws.id, AUTHOR, {
      title: "",
      body: EMPTY,
      refs: [],
    });
    expect(draft.title).toBe("");
    expect(draft.body).toEqual(EMPTY);
  });

  it("updates in place rather than piling up duplicates", async () => {
    const ws = await workspace();
    const first = await service.saveDraft(ws.id, AUTHOR, {
      title: "Use Postgres",
      body: EMPTY,
      refs: [],
    });
    const second = await service.saveDraft(ws.id, AUTHOR, {
      id: first.id,
      title: "Use Postgres, not Mongo",
      body: { ...EMPTY, decision: "Postgres." },
      refs: [],
    });

    expect(second.id).toBe(first.id);
    expect(await service.listDrafts(ws.id, AUTHOR)).toHaveLength(1);
    expect(second.title).toBe("Use Postgres, not Mongo");
  });

  it("keeps createdAt across an update, so a draft does not look new", async () => {
    const ws = await workspace();
    const first = await service.saveDraft(ws.id, AUTHOR, { title: "a", body: EMPTY, refs: [] });
    const second = await service.saveDraft(ws.id, AUTHOR, {
      id: first.id,
      title: "b",
      body: EMPTY,
      refs: [],
    });
    expect(second.createdAt).toEqual(first.createdAt);
    expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
  });

  it("lists newest first", async () => {
    const ws = await workspace();
    await service.saveDraft(ws.id, AUTHOR, { title: "older", body: EMPTY, refs: [] });
    await service.saveDraft(ws.id, AUTHOR, { title: "newer", body: EMPTY, refs: [] });
    const drafts = await service.listDrafts(ws.id, AUTHOR);
    expect(drafts.map((d) => d.title)).toEqual(["newer", "older"]);
  });

  it("is private to its author — a maintainer cannot see or read it", async () => {
    const ws = await workspace();
    const draft = await service.saveDraft(ws.id, AUTHOR, {
      title: "half-formed",
      body: EMPTY,
      refs: [],
    });

    expect(await service.listDrafts(ws.id, MAINTAINER)).toEqual([]);
    expect(await service.getDraft(draft.id, MAINTAINER)).toBeNull();
  });

  it("refuses a non-member", async () => {
    const ws = await workspace();
    await expect(
      service.saveDraft(ws.id, STRANGER, { title: "x", body: EMPTY, refs: [] }),
    ).rejects.toThrow(DecisionError);
  });

  it("refuses to overwrite someone else's draft", async () => {
    const ws = await workspace();
    const draft = await service.saveDraft(ws.id, AUTHOR, {
      title: "mine",
      body: EMPTY,
      refs: [],
    });
    await expect(
      service.saveDraft(ws.id, MAINTAINER, {
        id: draft.id,
        title: "hijacked",
        body: EMPTY,
        refs: [],
      }),
    ).rejects.toThrow(DecisionError);
  });

  it("refuses to delete someone else's draft, and ignores a missing one", async () => {
    const ws = await workspace();
    const draft = await service.saveDraft(ws.id, AUTHOR, { title: "mine", body: EMPTY, refs: [] });

    await expect(service.deleteDraft(draft.id, MAINTAINER)).rejects.toThrow(DecisionError);
    await expect(service.deleteDraft("id_nope", AUTHOR)).resolves.toBeUndefined();

    await service.deleteDraft(draft.id, AUTHOR);
    expect(await service.listDrafts(ws.id, AUTHOR)).toEqual([]);
  });

  it("refuses a draft larger than the cap", async () => {
    const ws = await workspace();
    await expect(
      service.saveDraft(ws.id, AUTHOR, {
        title: "",
        body: { ...EMPTY, decision: "x".repeat(200_000) },
        refs: [],
      }),
    ).rejects.toThrow(/too large/);
  });

  it("counts the whole draft against the cap, not one field", async () => {
    const ws = await workspace();
    const third = "y".repeat(50_000);
    await expect(
      service.saveDraft(ws.id, AUTHOR, {
        title: "",
        body: { context: third, decision: third, consequences: third },
        refs: [],
      }),
    ).rejects.toThrow(/too large/);
  });

  it("allows a long but realistic draft", async () => {
    const ws = await workspace();
    const draft = await service.saveDraft(ws.id, AUTHOR, {
      title: "A thorough decision",
      body: { ...EMPTY, decision: "z".repeat(20_000) },
      refs: [],
    });
    expect(draft.id).toBeTruthy();
  });

  it("caps how many drafts one author may park in a workspace", async () => {
    const ws = await workspace();
    for (let i = 0; i < MAX_DRAFTS_PER_AUTHOR; i++) {
      await service.saveDraft(ws.id, AUTHOR, { title: `d${i}`, body: EMPTY, refs: [] });
    }
    await expect(
      service.saveDraft(ws.id, AUTHOR, { title: "one too many", body: EMPTY, refs: [] }),
    ).rejects.toThrow(/already have/);
  });

  it("still lets an existing draft be updated once at the cap", async () => {
    const ws = await workspace();
    const first = await service.saveDraft(ws.id, AUTHOR, {
      title: "first",
      body: EMPTY,
      refs: [],
    });
    for (let i = 1; i < MAX_DRAFTS_PER_AUTHOR; i++) {
      await service.saveDraft(ws.id, AUTHOR, { title: `d${i}`, body: EMPTY, refs: [] });
    }

    // Editing what you already parked is not creating another one.
    const updated = await service.saveDraft(ws.id, AUTHOR, {
      id: first.id,
      title: "first, revised",
      body: EMPTY,
      refs: [],
    });
    expect(updated.title).toBe("first, revised");
  });

  it("counts the cap per author, not per workspace", async () => {
    const ws = await workspace();
    for (let i = 0; i < MAX_DRAFTS_PER_AUTHOR; i++) {
      await service.saveDraft(ws.id, AUTHOR, { title: `d${i}`, body: EMPTY, refs: [] });
    }
    // The maintainer's own allowance is untouched by the author's.
    const theirs = await service.saveDraft(ws.id, MAINTAINER, {
      title: "mine",
      body: EMPTY,
      refs: [],
    });
    expect(theirs.title).toBe("mine");
  });

  it("burns no ADR number — a draft leaves the sequence untouched", async () => {
    const ws = await workspace();
    await service.saveDraft(ws.id, AUTHOR, { title: "never sent", body: EMPTY, refs: [] });
    await service.saveDraft(ws.id, AUTHOR, { title: "also never sent", body: EMPTY, refs: [] });

    const decision = await service.propose(ws.id, AUTHOR, {
      title: "The first real one",
      body: { context: "", decision: "Do it.", consequences: "" },
    });
    expect(decision.number).toBe(1);
  });

  it("previews the next label without reserving it", async () => {
    const ws = await workspace();
    expect(await service.peekNextLabel(ws.id)).toBe("PLA-001");

    await service.propose(ws.id, AUTHOR, {
      title: "One",
      body: { context: "", decision: "d", consequences: "" },
    });
    expect(await service.peekNextLabel(ws.id)).toBe("PLA-002");
    // Peeking twice does not advance it.
    expect(await service.peekNextLabel(ws.id)).toBe("PLA-002");
  });
});

describe("rebaselining", () => {
  let service: DecisionService;

  beforeEach(() => {
    service = makeService();
  });

  it("moves a reference's baseline to the state supplied", async () => {
    const ws = await service.createWorkspace(MAINTAINER, "Platform");
    const decision = await service.propose(ws.id, MAINTAINER, {
      title: "Cite something",
      body: { context: "", decision: "d", consequences: "" },
    });
    const reference = await service.addReference(decision.id, MAINTAINER, {
      kind: "file",
      repo: "acme/api",
      path: "src/auth.ts",
      startLine: 10,
      endLine: 20,
      baselineSnippet: "old text",
      baselineSha: "sha_draft",
    });

    await service.rebaselineReferences(decision.id, [
      {
        referenceId: reference.id,
        baselineSha: "sha_accepted",
        baselineSnippet: "new text",
        startLine: 30,
        endLine: 40,
      },
    ]);

    const [updated] = await service.listReferences(decision.id);
    expect(updated!.baselineSha).toBe("sha_accepted");
    expect(updated!.baselineSnippet).toBe("new text");
    expect(updated!.startLine).toBe(30);
    // In sync with itself: a new baseline cannot already have drifted.
    expect(updated!.currentSha).toBe("sha_accepted");
    expect(referenceDrift(updated!)).toBe("synced");
  });

  it("ignores a reference belonging to another decision", async () => {
    const ws = await service.createWorkspace(MAINTAINER, "Platform");
    const mine = await service.propose(ws.id, MAINTAINER, {
      title: "Mine",
      body: { context: "", decision: "d", consequences: "" },
    });
    const other = await service.propose(ws.id, MAINTAINER, {
      title: "Other",
      body: { context: "", decision: "d", consequences: "" },
    });
    const reference = await service.addReference(other.id, MAINTAINER, {
      kind: "file",
      repo: "acme/api",
      path: "src/auth.ts",
      baselineSha: "sha_original",
    });

    await service.rebaselineReferences(mine.id, [
      {
        referenceId: reference.id,
        baselineSha: "sha_hijacked",
        baselineSnippet: null,
        startLine: null,
        endLine: null,
      },
    ]);

    const [untouched] = await service.listReferences(other.id);
    expect(untouched!.baselineSha).toBe("sha_original");
  });
});
