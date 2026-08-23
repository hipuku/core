import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canEditContent,
  capabilitiesFor,
  checkSupersede,
  checkTransition,
  isTerminal,
} from "./lifecycle";
import type { Actor, DecisionStatus } from "./types";

const maintainer: Actor = { id: "m", capabilities: capabilitiesFor("maintainer") };
const author: Actor = { id: "a", capabilities: capabilitiesFor("author") };

describe("transition table", () => {
  it("lets a maintainer accept or reject a proposal", () => {
    expect(checkTransition("proposed", "accepted", maintainer)).toEqual({ ok: true });
    expect(checkTransition("proposed", "rejected", maintainer)).toEqual({ ok: true });
  });

  it("refuses an author without the accept capability", () => {
    const result = checkTransition("proposed", "accepted", author);
    expect(result).toEqual({ ok: false, reason: "requires the accept capability" });
  });

  it("refuses an edge that does not exist", () => {
    expect(checkTransition("rejected", "accepted", maintainer)).toEqual({
      ok: false,
      reason: "no transition from rejected to accepted",
    });
  });

  it("treats rejected, deprecated and superseded as terminal", () => {
    const terminal: DecisionStatus[] = ["rejected", "deprecated", "superseded"];
    for (const status of terminal) {
      expect(isTerminal(status)).toBe(true);
      expect(allowedTransitions(status)).toEqual([]);
    }
  });

  it("does not treat proposed or accepted as terminal", () => {
    expect(isTerminal("proposed")).toBe(false);
    expect(isTerminal("accepted")).toBe(false);
  });
});

describe("content immutability", () => {
  it("lets the author revise a proposal", () => {
    expect(canEditContent("proposed", author, true)).toEqual({ ok: true });
  });

  it("lets a maintainer revise any proposal via the edit capability", () => {
    expect(canEditContent("proposed", maintainer, false)).toEqual({ ok: true });
  });

  it("refuses a non-author without edit rights", () => {
    const stranger: Actor = { id: "s", capabilities: [] };
    expect(canEditContent("proposed", stranger, false)).toEqual({
      ok: false,
      reason: "only the author or an editor may revise a proposal",
    });
  });

  it("locks content once a decision is accepted, even for its author", () => {
    const result = canEditContent("accepted", author, true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("supersede it instead");
  });
});

describe("supersession", () => {
  const accepted = (id: string) => ({ id, status: "accepted" as const });

  it("supersedes one accepted decision with another", () => {
    expect(
      checkSupersede({
        superseding: accepted("adr-2"),
        superseded: accepted("adr-1"),
        actor: maintainer,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a decision superseding itself", () => {
    expect(
      checkSupersede({
        superseding: accepted("adr-1"),
        superseded: accepted("adr-1"),
        actor: maintainer,
      }),
    ).toEqual({ ok: false, reason: "a decision cannot supersede itself" });
  });

  it("requires the superseding decision to be accepted", () => {
    expect(
      checkSupersede({
        superseding: { id: "adr-2", status: "proposed" },
        superseded: accepted("adr-1"),
        actor: maintainer,
      }),
    ).toEqual({
      ok: false,
      reason: "the superseding decision must be accepted first",
    });
  });

  it("only supersedes an accepted decision", () => {
    expect(
      checkSupersede({
        superseding: accepted("adr-2"),
        superseded: { id: "adr-1", status: "proposed" },
        actor: maintainer,
      }),
    ).toEqual({ ok: false, reason: "only an accepted decision can be superseded" });
  });

  it("requires the supersede capability", () => {
    expect(
      checkSupersede({
        superseding: accepted("adr-2"),
        superseded: accepted("adr-1"),
        actor: author,
      }),
    ).toEqual({ ok: false, reason: "requires the supersede capability" });
  });
});
