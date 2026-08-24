import { describe, expect, it } from "vitest";
import { isStale, referenceDrift } from "./drift";
import type { ReferenceRecord } from "./store";

function ref(over: Partial<ReferenceRecord>): ReferenceRecord {
  return {
    id: "r",
    decisionId: "d",
    kind: "file",
    label: null,
    url: null,
    repo: "acme/api",
    path: "src/x.ts",
    startLine: null,
    endLine: null,
    baselineSnippet: null,
    baselineSha: "abc",
    currentSha: "abc",
    checkedAt: new Date(),
    addedBy: "u",
    createdAt: new Date(),
    ...over,
  };
}

describe("referenceDrift", () => {
  it("is synced when current matches baseline", () => {
    expect(referenceDrift(ref({ baselineSha: "abc", currentSha: "abc" }))).toBe("synced");
  });

  it("is drifted when current differs from baseline", () => {
    expect(referenceDrift(ref({ baselineSha: "abc", currentSha: "def" }))).toBe("drifted");
  });

  it("is missing when the file is gone", () => {
    expect(referenceDrift(ref({ baselineSha: "abc", currentSha: null }))).toBe("missing");
  });

  it("is unknown for a link reference", () => {
    expect(referenceDrift(ref({ kind: "link", baselineSha: null }))).toBe("unknown");
  });

  it("is unknown for a file never given a baseline", () => {
    expect(referenceDrift(ref({ baselineSha: null }))).toBe("unknown");
  });
});

describe("isStale", () => {
  it("is stale if any file reference has drifted", () => {
    expect(
      isStale([
        ref({ currentSha: "abc" }),
        ref({ baselineSha: "abc", currentSha: "def" }),
      ]),
    ).toBe(true);
  });

  it("is stale if any file reference is missing", () => {
    expect(isStale([ref({ currentSha: null })])).toBe(true);
  });

  it("is not stale when everything is in sync or a link", () => {
    expect(
      isStale([ref({ currentSha: "abc" }), ref({ kind: "link", baselineSha: null })]),
    ).toBe(false);
  });
});
