import { describe, expect, it } from "vitest";
import {
  citationLabel,
  findCitations,
  formatCitation,
  insertCitation,
  renderCitations,
} from "./citation";

const REF = { repo: "acme/api", path: "src/auth.ts", lines: "L12-L40" };

describe("formatCitation / findCitations", () => {
  it("round-trips a ranged citation", () => {
    expect(formatCitation(REF)).toBe("{{acme/api:src/auth.ts#L12-L40}}");
    expect(findCitations(formatCitation(REF))).toEqual([REF]);
  });

  it("round-trips a whole-file citation", () => {
    const whole = { repo: "acme/api", path: "src/auth.ts", lines: null };
    expect(formatCitation(whole)).toBe("{{acme/api:src/auth.ts}}");
    expect(findCitations(formatCitation(whole))).toEqual([whole]);
  });

  it("finds several in a paragraph, in order", () => {
    const text = "We chose this because {{a/b:one.ts}} and {{c/d:two.ts#L3}} agree.";
    expect(findCitations(text).map((c) => c.path)).toEqual(["one.ts", "two.ts"]);
  });

  it("ignores an unterminated token instead of swallowing the paragraph", () => {
    expect(findCitations("{{acme/api:src/auth.ts and then some prose")).toEqual([]);
  });

  it("ignores empty braces and plain prose", () => {
    expect(findCitations("nothing here {{}} or here")).toEqual([]);
  });
});

describe("renderCitations", () => {
  const resolve = (c: { repo: string; path: string; lines: string | null }) =>
    c.repo === "acme/api"
      ? `https://github.com/acme/api/blob/main/${c.path}${c.lines ? `#${c.lines}` : ""}`
      : null;

  it("becomes a markdown link when it resolves", () => {
    expect(renderCitations("see {{acme/api:src/auth.ts#L12-L40}}", resolve)).toBe(
      "see [auth.ts · L12-L40](https://github.com/acme/api/blob/main/src/auth.ts#L12-L40)",
    );
  });

  it("falls back to code when the repo is unknown, rather than vanishing", () => {
    expect(renderCitations("see {{other/repo:x.ts}}", resolve)).toBe("see `x.ts`");
  });

  it("leaves the surrounding markdown untouched", () => {
    const text = "## Heading\n\n- a {{acme/api:x.ts}} item\n";
    expect(renderCitations(text, resolve)).toBe(
      "## Heading\n\n- a [x.ts](https://github.com/acme/api/blob/main/x.ts) item\n",
    );
  });

  it("escapes brackets in a filename so it cannot break out of the link", () => {
    const out = renderCitations("{{acme/api:app/[slug].tsx}}", resolve);
    expect(out).toContain("[\\[slug\\].tsx](");
  });

  it("keeps a bracketed directory out of the label entirely", () => {
    const out = renderCitations("{{acme/api:app/[id]/page.tsx}}", resolve);
    expect(out).toBe("[page.tsx](https://github.com/acme/api/blob/main/app/[id]/page.tsx)");
  });
});

describe("citationLabel", () => {
  it("leads with the filename, which is what gets scanned", () => {
    expect(citationLabel(REF)).toBe("auth.ts · L12-L40");
    expect(citationLabel({ ...REF, lines: null })).toBe("auth.ts");
  });
});

describe("insertCitation", () => {
  it("adds a leading space mid-sentence", () => {
    const result = insertCitation({ value: "because", start: 7, end: 7 }, REF);
    expect(result.value).toBe("because {{acme/api:src/auth.ts#L12-L40}}");
    expect(result.start).toBe(result.value.length);
  });

  it("adds no leading space at the start of a line", () => {
    expect(insertCitation({ value: "", start: 0, end: 0 }, REF).value).toBe(
      "{{acme/api:src/auth.ts#L12-L40}}",
    );
    expect(insertCitation({ value: "a\n", start: 2, end: 2 }, REF).value).toBe(
      "a\n{{acme/api:src/auth.ts#L12-L40}}",
    );
  });

  it("adds no leading space after an existing space or bracket", () => {
    expect(insertCitation({ value: "see ", start: 4, end: 4 }, REF).value).toBe(
      "see {{acme/api:src/auth.ts#L12-L40}}",
    );
    expect(insertCitation({ value: "(", start: 1, end: 1 }, REF).value).toBe(
      "({{acme/api:src/auth.ts#L12-L40}}",
    );
  });

  it("replaces a selection", () => {
    const result = insertCitation({ value: "see THIS end", start: 4, end: 8 }, REF);
    expect(result.value).toBe("see {{acme/api:src/auth.ts#L12-L40}} end");
  });
});
