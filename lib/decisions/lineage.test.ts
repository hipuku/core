import { describe, expect, it } from "vitest";
import { supersessionChain, type Lineal } from "./lineage";

function d(number: number, supersededById: string | null = null): Lineal {
  return {
    id: `id-${number}`,
    number,
    title: `Decision ${number}`,
    status: supersededById ? "superseded" : "accepted",
    supersededById,
  };
}

/** 1 → 2 → 3, oldest superseded by the next. */
const CHAIN = [d(1, "id-2"), d(2, "id-3"), d(3), d(9)];

describe("supersessionChain", () => {
  it("returns nothing for a decision in no chain", () => {
    expect(supersessionChain(CHAIN, "id-9")).toEqual([]);
  });

  it("returns nothing for an unknown id", () => {
    expect(supersessionChain(CHAIN, "id-nope")).toEqual([]);
  });

  it("walks forward from the oldest", () => {
    const chain = supersessionChain(CHAIN, "id-1");
    expect(chain.map((e) => e.decision.number)).toEqual([1, 2, 3]);
  });

  it("walks backward from the newest", () => {
    const chain = supersessionChain(CHAIN, "id-3");
    expect(chain.map((e) => e.decision.number)).toEqual([1, 2, 3]);
  });

  it("walks both ways from the middle", () => {
    const chain = supersessionChain(CHAIN, "id-2");
    expect(chain.map((e) => e.decision.number)).toEqual([1, 2, 3]);
  });

  it("marks which one is being looked at", () => {
    const chain = supersessionChain(CHAIN, "id-2");
    expect(chain.filter((e) => e.current).map((e) => e.decision.number)).toEqual([2]);
  });

  it("handles a chain of two", () => {
    const pair = [d(1, "id-2"), d(2)];
    expect(supersessionChain(pair, "id-2").map((e) => e.decision.number)).toEqual([1, 2]);
  });

  it("does not loop, or repeat itself, on a cycle", () => {
    // The service cannot create this; a hand-edited database could. Both walks
    // can reach the same decision, so terminating is not enough. It also has
    // to appear once.
    const cyclic = [d(1, "id-2"), { ...d(2), supersededById: "id-1" }];
    const chain = supersessionChain(cyclic, "id-1");

    const ids = chain.map((e) => e.decision.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids.length).toBeLessThanOrEqual(cyclic.length);
    expect(chain.filter((e) => e.current)).toHaveLength(1);
  });

  it("ignores decisions from elsewhere in the workspace", () => {
    const chain = supersessionChain([...CHAIN, d(20), d(21)], "id-2");
    expect(chain.map((e) => e.decision.number)).toEqual([1, 2, 3]);
  });
});
