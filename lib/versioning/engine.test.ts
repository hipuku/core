import { beforeEach, describe, expect, it } from "vitest";
import { Versioning, VersioningError, type Clock, type IdGenerator } from "./engine";
import { MemoryVersionStore } from "./memory-store";

/** Deterministic clock and ids so history ordering and messages are assertable. */
function fixtures() {
  let tick = 0;
  const clock: Clock = { now: () => new Date(1_000 + tick++ * 1_000) };
  let seq = 0;
  const ids: IdGenerator = { next: () => `v_${String(++seq).padStart(4, "0")}` };
  const store = new MemoryVersionStore();
  return { engine: new Versioning(store, clock, ids), store };
}

describe("Versioning", () => {
  let engine: Versioning;

  beforeEach(() => {
    engine = fixtures().engine;
  });

  it("seeds a document with an initial commit whose parent is null", async () => {
    const { document, version } = await engine.create("user_a", "doc", {
      title: "hello",
    });
    expect(version.parentId).toBeNull();
    expect(version.message).toBe("Created");
    expect(document.headVersionId).toBe(version.id);
  });

  it("chains each commit onto the previous head", async () => {
    const { document } = await engine.create("user_a", "doc", { n: 1 });
    const second = await engine.commit(document.id, { n: 2 }, "user_a", "bump");
    const third = await engine.commit(document.id, { n: 3 }, "user_b", "bump");
    expect(second.parentId).toBe(document.headVersionId);
    expect(third.parentId).toBe(second.id);
  });

  it("keeps history append-only when restoring, rather than rewinding", async () => {
    const { document, version: first } = await engine.create("user_a", "doc", {
      n: 1,
    });
    await engine.commit(document.id, { n: 2 }, "user_a", "bump");
    const restored = await engine.restore(document.id, first.id, "user_b");

    const history = await engine.history(document.id);
    // Three entries: create, bump, restore. The restore adds to history.
    expect(history).toHaveLength(3);
    expect(restored.state).toEqual({ n: 1 });
    expect(restored.message).toContain("Restored version");
    // The restore's parent is the latest commit, not the version it restored.
    expect(restored.parentId).toBe(history[1].id);
  });

  it("annotates each history entry with its diff from the previous state", async () => {
    const { document } = await engine.create("user_a", "doc", { n: 1 });
    await engine.commit(document.id, { n: 1, extra: true }, "user_a", "add field");

    const history = await engine.history(document.id);
    expect(history[0].changes).toEqual([{ op: "add", path: "/n", after: 1 }]);
    expect(history[1].changes).toEqual([
      { op: "add", path: "/extra", after: true },
    ]);
  });

  it("diffs any two versions of the same document", async () => {
    const { document, version: first } = await engine.create("user_a", "doc", {
      n: 1,
    });
    const second = await engine.commit(document.id, { n: 9 }, "user_a", "bump");
    expect(await engine.diffVersions(first.id, second.id)).toEqual([
      { op: "replace", path: "/n", before: 1, after: 9 },
    ]);
  });

  it("refuses to restore a version from a different document", async () => {
    const a = await engine.create("user_a", "a", { n: 1 });
    const b = await engine.create("user_a", "b", { n: 2 });
    await expect(
      engine.restore(a.document.id, b.version.id, "user_a"),
    ).rejects.toBeInstanceOf(VersioningError);
  });

  it("refuses to diff versions across documents", async () => {
    const a = await engine.create("user_a", "a", { n: 1 });
    const b = await engine.create("user_a", "b", { n: 2 });
    await expect(
      engine.diffVersions(a.version.id, b.version.id),
    ).rejects.toBeInstanceOf(VersioningError);
  });

  it("throws when committing to a document that does not exist", async () => {
    await expect(
      engine.commit("nope", { n: 1 }, "user_a", "x"),
    ).rejects.toBeInstanceOf(VersioningError);
  });
});
