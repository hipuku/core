import { describe, expect, it } from "vitest";
import { DrizzleDecisionStore } from "./drizzle-store";
import { MemoryDecisionStore } from "./memory-store";

/**
 * The domain suite runs entirely against MemoryDecisionStore, so everything it
 * proves about permissions and the lifecycle is proved about a double. The
 * implementation that enforces those rules in production is exercised by
 * nothing.
 *
 * A full contract suite, one set of tests run against both stores, needs a
 * Postgres and is the real answer. This is the half that does not: it holds the
 * two implementations to the same method set, so a port method added to one and
 * forgotten on the other fails here rather than on a page. It cannot catch a
 * behavioural difference, only a structural one, and it is worth having because
 * the structural one is silent today: TypeScript checks each class against the
 * interface, so a method dropped from the interface and both classes typechecks
 * cleanly while the service calls it.
 *
 * Constructing DrizzleDecisionStore is safe without a database. postgres-js
 * connects lazily and lib/db builds its client with an empty URL rather than
 * throwing at import.
 */
function methodsOf(instance: object): string[] {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
    .filter((name) => name !== "constructor")
    .sort();
}

describe("store parity", () => {
  const memory = methodsOf(new MemoryDecisionStore());
  const drizzle = methodsOf(new DrizzleDecisionStore());

  it("implements every port method on both sides", () => {
    // Compared against the port rather than against each other. The stores are
    // not expected to have identical prototypes: MemoryDecisionStore carries a
    // private `memberKey` helper for its composite Map key, which the SQL side
    // has no use for. What has to match is that both satisfy the interface.
    //
    // The list is written out rather than derived from either store, because a
    // list read off one of them would agree with itself no matter what both of
    // them dropped.
    const port = [
      "addMember",
      "addReference",
      "addWorkspaceRepo",
      "applyStatusChange",
      "countDecisions",
      "countProposed",
      "createWorkspace",
      "deleteDraft",
      "deleteDraftsBefore",
      "deleteReference",
      "deleteWorkspace",
      "deleteWorkspaceRepo",
      "getDecision",
      "getDraft",
      "getMembership",
      "getReference",
      "getWorkspace",
      "getWorkspaceRepo",
      "insertDecision",
      "listDecisions",
      "listDrafts",
      "listMembers",
      "listReferences",
      "listTransitions",
      "listWorkspaceRepos",
      "listWorkspacesForUser",
      "peekNextNumber",
      "rebaselineReference",
      "removeMember",
      "updateReferenceState",
      "updateWorkspace",
      "upsertDraft",
    ];
    for (const method of port) {
      expect(memory).toContain(method);
      expect(drizzle).toContain(method);
    }
  });

  it("adds no public method the other side lacks", () => {
    // The reverse direction, minus the one documented private helper. A method
    // added to the SQL store and never written in memory means the double has
    // quietly stopped standing in for it.
    const publicMemory = memory.filter((name) => name !== "memberKey");
    expect(drizzle).toEqual(publicMemory);
  });
});
