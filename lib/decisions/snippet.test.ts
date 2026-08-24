import { describe, expect, it } from "vitest";
import {
  compareSnippet,
  extractRange,
  formatRange,
  parseRange,
} from "./snippet";

const FILE = ["one", "two", "three", "four", "five"].join("\n");

describe("extractRange", () => {
  it("takes a 1-based inclusive range", () => {
    expect(extractRange(FILE, { start: 2, end: 4 })).toBe("two\nthree\nfour");
  });

  it("takes a single line", () => {
    expect(extractRange(FILE, { start: 1, end: 1 })).toBe("one");
  });

  it("clamps past the end of the file rather than inventing blank lines", () => {
    expect(extractRange(FILE, { start: 4, end: 99 })).toBe("four\nfive");
  });

  it("returns nothing when the range starts past the end", () => {
    expect(extractRange(FILE, { start: 90, end: 99 })).toBe("");
  });
});

describe("compareSnippet", () => {
  const baseline = "two\nthree";
  const range = { start: 2, end: 3 };

  it("is synced when the cited lines are untouched", () => {
    expect(compareSnippet({ baseline, content: FILE, range })).toEqual({
      status: "synced",
    });
  });

  it("ignores changes elsewhere in the file — the whole point of a range", () => {
    const edited = ["ONE", "two", "three", "FOUR", "FIVE"].join("\n");
    expect(compareSnippet({ baseline, content: edited, range })).toEqual({
      status: "synced",
    });
  });

  it("reports movement, with the new range, when lines are inserted above", () => {
    const shifted = ["new", "lines", "one", "two", "three", "four"].join("\n");
    expect(compareSnippet({ baseline, content: shifted, range })).toEqual({
      status: "moved",
      range: { start: 4, end: 5 },
    });
  });

  it("reports movement when lines are removed above", () => {
    const shifted = ["two", "three", "four"].join("\n");
    expect(compareSnippet({ baseline, content: shifted, range })).toEqual({
      status: "moved",
      range: { start: 1, end: 2 },
    });
  });

  it("reports a change when the cited lines are edited", () => {
    const edited = ["one", "two", "THREE!", "four", "five"].join("\n");
    expect(compareSnippet({ baseline, content: edited, range })).toEqual({
      status: "changed",
    });
  });

  it("reports a change when the cited lines are deleted", () => {
    const gutted = ["one", "four", "five"].join("\n");
    expect(compareSnippet({ baseline, content: gutted, range })).toEqual({
      status: "changed",
    });
  });

  it("does not fire on trailing whitespace, so a formatter run is not drift", () => {
    const reformatted = ["one", "two  ", "three\t", "four"].join("\n");
    expect(compareSnippet({ baseline, content: reformatted, range })).toEqual({
      status: "synced",
    });
  });

  it("does fire on changed indentation — that is a real change of scope", () => {
    const reindented = ["one", "  two", "  three", "four"].join("\n");
    expect(compareSnippet({ baseline, content: reindented, range }).status).toBe(
      "changed",
    );
  });

  it("finds the first occurrence when the cited text repeats", () => {
    const repeated = ["two", "three", "x", "two", "three"].join("\n");
    expect(compareSnippet({ baseline, content: repeated, range })).toEqual({
      status: "moved",
      range: { start: 1, end: 2 },
    });
  });

  it("treats an empty baseline as changed rather than matching everywhere", () => {
    expect(
      compareSnippet({ baseline: "", content: FILE, range }).status,
    ).toBe("changed");
  });
});

describe("formatRange / parseRange", () => {
  it("round-trips a span", () => {
    expect(formatRange({ start: 47, end: 120 })).toBe("L47-L120");
    expect(parseRange("L47-L120")).toEqual({ start: 47, end: 120 });
  });

  it("collapses a single line", () => {
    expect(formatRange({ start: 9, end: 9 })).toBe("L9");
    expect(parseRange("L9")).toEqual({ start: 9, end: 9 });
  });

  it("accepts bare numbers and spacing", () => {
    expect(parseRange("12-20")).toEqual({ start: 12, end: 20 });
    expect(parseRange(" L12 - L20 ")).toEqual({ start: 12, end: 20 });
  });

  it("reads a backwards range the way it was obviously meant", () => {
    expect(parseRange("L20-L12")).toEqual({ start: 12, end: 20 });
  });

  it("rejects nonsense", () => {
    expect(parseRange("")).toBeNull();
    expect(parseRange("L0")).toBeNull();
    expect(parseRange("lines 4 to 9")).toBeNull();
  });
});
