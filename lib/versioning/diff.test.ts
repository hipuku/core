import { describe, expect, it } from "vitest";
import { diff, equal } from "./diff";

describe("equal", () => {
  it("treats structurally identical values as equal regardless of key order", () => {
    expect(equal({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(equal([1, [2, 3]], [1, [2, 3]])).toBe(true);
  });

  it("separates null from an empty object", () => {
    expect(equal(null, {})).toBe(false);
  });

  it("does not treat an array and an object as equal", () => {
    expect(equal([], {})).toBe(false);
  });
});

describe("diff", () => {
  it("reports no changes between identical states", () => {
    expect(diff({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("reports a replaced primitive at its pointer", () => {
    expect(diff({ a: 1 }, { a: 2 })).toEqual([
      { op: "replace", path: "/a", before: 1, after: 2 },
    ]);
  });

  it("reports added and removed keys distinctly, in sorted key order", () => {
    expect(diff({ a: 1 }, { b: 2 })).toEqual([
      { op: "remove", path: "/a", before: 1 },
      { op: "add", path: "/b", after: 2 },
    ]);
  });

  it("recurses into nested objects and reports the deep pointer", () => {
    expect(diff({ a: { b: 1 } }, { a: { b: 2 } })).toEqual([
      { op: "replace", path: "/a/b", before: 1, after: 2 },
    ]);
  });

  it("treats a change of shape as a single replace, not add plus remove", () => {
    expect(diff({ a: [1] }, { a: { "0": 1 } })).toEqual([
      { op: "replace", path: "/a", before: [1], after: { "0": 1 } },
    ]);
  });

  it("escapes reserved pointer characters in keys", () => {
    expect(diff({ "a/b": 1 }, { "a/b": 2 })).toEqual([
      { op: "replace", path: "/a~1b", before: 1, after: 2 },
    ]);
    expect(diff({ "m~n": 1 }, { "m~n": 2 })).toEqual([
      { op: "replace", path: "/m~0n", before: 1, after: 2 },
    ]);
  });

  it("diffs arrays by index, reporting appends as adds", () => {
    expect(diff([1, 2], [1, 2, 3])).toEqual([
      { op: "add", path: "/2", after: 3 },
    ]);
  });

  it("reports a shortened array as removals at the tail", () => {
    expect(diff([1, 2, 3], [1, 2])).toEqual([
      { op: "remove", path: "/2", before: 3 },
    ]);
  });
});
