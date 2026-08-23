import { beforeEach, describe, expect, it } from "vitest";
import { Versioning } from "@/lib/versioning/engine";
import { MemoryVersionStore } from "@/lib/versioning/memory-store";
import { MemoryDecisionStore } from "./memory-store";
import { DecisionError, DecisionService, type Clock, type IdGenerator } from "./service";

function makeService() {
  let tick = 0;
  const clock: Clock = { now: () => new Date(1_000 + tick++ * 1_000) };
  let seq = 0;
  const ids: IdGenerator = { next: () => `id_${String(++seq).padStart(4, "0")}` };
  const versioning = new Versioning(new MemoryVersionStore());
  const service = new DecisionService(
    new MemoryDecisionStore(),
    versioning,
    clock,
    ids,
  );
  return service;
}

const MAINTAINER = "user_owner";
const AUTHOR = "user_author";
const STRANGER = "user_stranger";

async function workspaceWithAuthor(service: DecisionService) {
  const ws = await service.createWorkspace(MAINTAINER, "Platform");
  await service.addMember(ws.id, AUTHOR, "author");
  return ws;
}

describe("DecisionService", () => {
  let service: DecisionService;

  beforeEach(() => {
    service = makeService();
  });

  it("numbers proposals sequentially within a workspace", async () => {
    const ws = await workspaceWithAuthor(service);
    const first = await service.propose(ws.id, AUTHOR, {
      title: "Use Postgres",
      body: { context: "we need a database" },
    });
    const second = await service.propose(ws.id, AUTHOR, {
      title: "Adopt Drizzle",
      body: {},
    });
    expect(first.number).toBe(1);
    expect(second.number).toBe(2);
    expect(first.status).toBe("proposed");
  });

  it("records an opening transition when a decision is proposed", async () => {
    const ws = await workspaceWithAuthor(service);
    const decision = await service.propose(ws.id, AUTHOR, {
      title: "Use Postgres",
      body: {},
    });
    const trail = await service.statusHistory(decision.id);
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({ fromStatus: null, toStatus: "proposed" });
  });

  it("refuses a proposal from a non-member", async () => {
    const ws = await workspaceWithAuthor(service);
    await expect(
      service.propose(ws.id, STRANGER, { title: "x", body: {} }),
    ).rejects.toBeInstanceOf(DecisionError);
  });

  it("lets a maintainer accept a proposal and logs the transition", async () => {
    const ws = await workspaceWithAuthor(service);
    const decision = await service.propose(ws.id, AUTHOR, { title: "x", body: {} });
    await service.changeStatus(decision.id, MAINTAINER, "accepted");

    const updated = await service.getDecision(decision.id);
    expect(updated?.status).toBe("accepted");
    const trail = await service.statusHistory(decision.id);
    expect(trail.map((t) => t.toStatus)).toEqual(["proposed", "accepted"]);
    expect(trail[1]).toMatchObject({ fromStatus: "proposed", actorId: MAINTAINER });
  });

  it("refuses an author without the accept capability", async () => {
    const ws = await workspaceWithAuthor(service);
    const decision = await service.propose(ws.id, AUTHOR, { title: "x", body: {} });
    await expect(
      service.changeStatus(decision.id, AUTHOR, "accepted"),
    ).rejects.toThrow("requires the accept capability");
  });

  it("versions the body on revise and locks it once accepted", async () => {
    const ws = await workspaceWithAuthor(service);
    const decision = await service.propose(ws.id, AUTHOR, {
      title: "x",
      body: { context: "draft" },
    });
    await service.revise(decision.id, AUTHOR, { context: "revised" });

    const content = await service.contentHistory(decision.id);
    expect(content).toHaveLength(2); // created + revised

    await service.changeStatus(decision.id, MAINTAINER, "accepted");
    await expect(
      service.revise(decision.id, AUTHOR, { context: "too late" }),
    ).rejects.toThrow("immutable");
  });

  it("supersedes an accepted decision with another, linking the two", async () => {
    const ws = await workspaceWithAuthor(service);
    const old = await service.propose(ws.id, AUTHOR, { title: "old", body: {} });
    const next = await service.propose(ws.id, AUTHOR, { title: "new", body: {} });
    await service.changeStatus(old.id, MAINTAINER, "accepted");
    await service.changeStatus(next.id, MAINTAINER, "accepted");

    await service.supersede(next.id, old.id, MAINTAINER);

    const superseded = await service.getDecision(old.id);
    expect(superseded?.status).toBe("superseded");
    expect(superseded?.supersededById).toBe(next.id);
    const trail = await service.statusHistory(old.id);
    expect(trail.at(-1)?.toStatus).toBe("superseded");
  });

  it("lets a maintainer invite a member and lists them", async () => {
    const ws = await workspaceWithAuthor(service);
    await service.inviteMember(ws.id, MAINTAINER, "user_new", "maintainer");
    const members = await service.listMembers(ws.id);
    expect(members.map((m) => m.userId).sort()).toEqual(
      [MAINTAINER, AUTHOR, "user_new"].sort(),
    );
    expect(members.find((m) => m.userId === "user_new")?.role).toBe("maintainer");
  });

  it("refuses to let an author invite a member", async () => {
    const ws = await workspaceWithAuthor(service);
    await expect(
      service.inviteMember(ws.id, AUTHOR, "user_new", "author"),
    ).rejects.toThrow("only a maintainer");
  });

  it("refuses to supersede with a decision that is not accepted", async () => {
    const ws = await workspaceWithAuthor(service);
    const old = await service.propose(ws.id, AUTHOR, { title: "old", body: {} });
    const next = await service.propose(ws.id, AUTHOR, { title: "new", body: {} });
    await service.changeStatus(old.id, MAINTAINER, "accepted");
    // `next` is still only proposed.
    await expect(
      service.supersede(next.id, old.id, MAINTAINER),
    ).rejects.toThrow("must be accepted first");
  });
});
