import { describe, expect, it } from "vitest";
import { draftLabel } from "./draft-label";

const EMPTY = { context: "", decision: "", consequences: "" };

describe("draftLabel", () => {
  it("uses the typed title when there is one", () => {
    expect(draftLabel("Use Postgres", EMPTY)).toEqual({
      text: "Use Postgres",
      derived: false,
    });
  });

  it("prefers the decision block, the sentence the record exists to hold", () => {
    expect(
      draftLabel("", {
        context: "We keep losing schema changes.",
        decision: "Adopt Drizzle migrations.",
        consequences: "",
      }),
    ).toEqual({ text: "Adopt Drizzle migrations.", derived: true });
  });

  it("falls back to context, then consequences", () => {
    expect(draftLabel("", { ...EMPTY, context: "Only this." }).text).toBe("Only this.");
    expect(draftLabel("", { ...EMPTY, consequences: "Only this." }).text).toBe("Only this.");
  });

  it("skips blank leading lines", () => {
    expect(draftLabel("", { ...EMPTY, decision: "\n\n  \nReal text" }).text).toBe("Real text");
  });

  it("strips markdown so a list does not fill with punctuation", () => {
    expect(draftLabel("", { ...EMPTY, decision: "## Adopt Drizzle" }).text).toBe("Adopt Drizzle");
    expect(draftLabel("", { ...EMPTY, decision: "- [ ] Adopt Drizzle" }).text).toBe("Adopt Drizzle");
    expect(draftLabel("", { ...EMPTY, decision: "> Adopt **Drizzle**" }).text).toBe("Adopt Drizzle");
    expect(draftLabel("", { ...EMPTY, decision: "1. Use `pnpm`" }).text).toBe("Use pnpm");
    expect(draftLabel("", { ...EMPTY, decision: "See [the RFC](http://x)" }).text).toBe(
      "See the RFC",
    );
  });

  it("drops citation tokens, which are not prose", () => {
    expect(
      draftLabel("", { ...EMPTY, decision: "Because {{a/b:x.ts#L1}} says so" }).text,
    ).toBe("Because  says so");
  });

  it("truncates a long first line rather than breaking the row", () => {
    const long = "x".repeat(200);
    const label = draftLabel("", { ...EMPTY, decision: long });
    expect(label.text.length).toBeLessThanOrEqual(72);
    expect(label.text.endsWith("…")).toBe(true);
  });

  it("names a genuinely empty draft", () => {
    expect(draftLabel("", EMPTY)).toEqual({ text: "Empty draft", derived: true });
  });

  it("treats a whitespace-only title as no title", () => {
    expect(draftLabel("   ", { ...EMPTY, decision: "Body wins" }).text).toBe("Body wins");
  });
});
