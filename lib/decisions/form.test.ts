import { describe, expect, it } from "vitest";
import { adrBody, citedRefs, referenceLabel } from "./form";

function form(pairs: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of pairs) fd.append(k, v);
  return fd;
}

describe("adrBody", () => {
  it("reads the three blocks", () => {
    expect(
      adrBody(
        form([
          ["context", "The palette lives in three places."],
          ["decision", "One source of truth."],
          ["consequences", "The Sass map is generated."],
        ]),
      ),
    ).toEqual({
      context: "The palette lives in three places.",
      decision: "One source of truth.",
      consequences: "The Sass map is generated.",
    });
  });

  it("treats an absent field as empty", () => {
    // A draft is under no obligation to be complete, so a missing block is
    // legitimate and must not read as the string "null" or "undefined".
    expect(adrBody(form([["decision", "Only this one."]]))).toEqual({
      context: "",
      decision: "Only this one.",
      consequences: "",
    });
  });

  it("trims, so whitespace does not count as content", () => {
    // The draft-label and empty-state logic downstream both test these for
    // emptiness; a block holding only a newline would defeat them.
    expect(adrBody(form([["context", "  \n  "]])).context).toBe("");
  });

  it("takes the first value when a field is posted twice", () => {
    expect(adrBody(form([["decision", "first"], ["decision", "second"]])).decision).toBe(
      "first",
    );
  });
});

describe("citedRefs", () => {
  it("pairs the parallel arrays by position", () => {
    const refs = citedRefs(
      form([
        ["refRepoId", "r1"],
        ["refRepoId", "r2"],
        ["refRepoLabel", "hipuku/haus"],
        ["refRepoLabel", "hipuku/vault"],
        ["refPath", "src/a.ts"],
        ["refPath", "src/b.ts"],
        ["refLines", "L1-L20"],
        ["refLines", ""],
      ]),
    );
    expect(refs).toEqual([
      { repoId: "r1", repo: "hipuku/haus", path: "src/a.ts", lines: "L1-L20" },
      { repoId: "r2", repo: "hipuku/vault", path: "src/b.ts", lines: null },
    ]);
  });

  it("is empty when nothing was cited", () => {
    expect(citedRefs(form([["context", "no citations here"]]))).toEqual([]);
  });

  it("reads an empty line range as no range rather than an empty one", () => {
    // A whole-file citation posts an empty refLines. Storing "" would later
    // parse as a range of nothing, which never drifts.
    expect(citedRefs(form([["refRepoId", "r1"], ["refLines", ""]]))[0].lines).toBeNull();
  });

  it("lets refRepoId set the length", () => {
    // A label with no id cannot be resolved to a repository, so it is not a
    // citation; a row whose companions are missing still yields a row, because
    // dropping it silently would lose a file the author picked.
    const refs = citedRefs(
      form([
        ["refRepoId", "r1"],
        ["refRepoLabel", "hipuku/haus"],
        ["refRepoLabel", "hipuku/orphan"],
      ]),
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ repoId: "r1", repo: "hipuku/haus", path: "", lines: null });
  });
});

describe("referenceLabel", () => {
  it("appends the range when there is one", () => {
    expect(referenceLabel("hipuku", "haus", "src/tokens.css", { start: 1, end: 48 })).toBe(
      "hipuku/haus · src/tokens.css · L1-L48",
    );
  });

  it("leaves no dangling separator on a whole-file citation", () => {
    expect(referenceLabel("hipuku", "haus", "src/tokens.css", null)).toBe(
      "hipuku/haus · src/tokens.css",
    );
  });

  it("writes a single-line range as one line, not a span", () => {
    expect(referenceLabel("hipuku", "vault", "src/a.ts", { start: 7, end: 7 })).toBe(
      "hipuku/vault · src/a.ts · L7",
    );
  });
});
