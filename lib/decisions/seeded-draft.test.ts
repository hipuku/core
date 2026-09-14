import { describe, expect, it } from "vitest";
import { Versioning } from "@/lib/versioning/engine";
import { MemoryVersionStore } from "@/lib/versioning/memory-store";
import { MemoryDecisionStore } from "./memory-store";
import { DEMO_WORKSPACE_NAME, SEEDED_DRAFT, restoreSeededDraft } from "./seeded-draft";
import { DecisionService } from "./service";

const DEMO = "user_demo";

function makeService() {
  return new DecisionService(new MemoryDecisionStore(), new Versioning(new MemoryVersionStore()));
}

describe("restoreSeededDraft", () => {
  it("saves the seeded draft when the demo workspace has none", async () => {
    const service = makeService();
    const ws = await service.createWorkspace(DEMO, DEMO_WORKSPACE_NAME);

    expect(await restoreSeededDraft(service, DEMO)).toBe(true);

    const drafts = await service.listDrafts(ws.id, DEMO);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.title).toBe(SEEDED_DRAFT.title);
    expect(drafts[0]!.body).toEqual(SEEDED_DRAFT.body);
  });

  it("does nothing when a draft with the seeded title is already there", async () => {
    const service = makeService();
    const ws = await service.createWorkspace(DEMO, DEMO_WORKSPACE_NAME);
    await service.saveDraft(ws.id, DEMO, SEEDED_DRAFT);

    expect(await restoreSeededDraft(service, DEMO)).toBe(false);
    expect(await service.listDrafts(ws.id, DEMO)).toHaveLength(1);
  });

  it("restores it beside a visitor's draft with another title", async () => {
    const service = makeService();
    const ws = await service.createWorkspace(DEMO, DEMO_WORKSPACE_NAME);
    await service.saveDraft(ws.id, DEMO, {
      title: "A visitor's draft",
      body: { context: "", decision: "", consequences: "" },
      refs: [],
    });

    expect(await restoreSeededDraft(service, DEMO)).toBe(true);
    expect((await service.listDrafts(ws.id, DEMO)).map((d) => d.title).sort()).toEqual(
      ["A visitor's draft", SEEDED_DRAFT.title].sort(),
    );
  });

  it("does nothing when the account is in no workspace of that name", async () => {
    const service = makeService();
    const ws = await service.createWorkspace(DEMO, "Platform");

    expect(await restoreSeededDraft(service, DEMO)).toBe(false);
    expect(await service.listDrafts(ws.id, DEMO)).toHaveLength(0);
  });
});
