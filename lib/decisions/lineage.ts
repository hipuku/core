/**
 * The chain a decision sits in.
 *
 * `supersededById` is a single column, so the relationship is only ever visible
 * one hop at a time: this record links forward to what replaced it, and finding
 * what *it* replaced means searching. A decision three revisions deep therefore
 * shows no sign of the two before it, which is precisely the history someone
 * arriving at it needs. A decision is often best understood as the latest
 * answer to a question that has been answered before.
 *
 * Pure: give it every decision in the workspace and it walks both directions.
 */

export interface Lineal {
  id: string;
  number: number;
  title: string;
  status: string;
  supersededById: string | null;
}

export interface LineageEntry<T extends Lineal> {
  decision: T;
  /** True for the decision the chain was built around. */
  current: boolean;
}

/**
 * Oldest first, ending with whatever currently stands. A decision in no chain
 * returns an empty array rather than a chain of one: a lineage of length one is
 * not a lineage, and drawing it would be chrome around a single item.
 */
export function supersessionChain<T extends Lineal>(
  all: T[],
  currentId: string,
): LineageEntry<T>[] {
  const byId = new Map(all.map((d) => [d.id, d]));
  const current = byId.get(currentId);
  if (!current) return [];

  // Backwards: whoever names this one as their replacement.
  const predecessors = new Map<string, T>();
  for (const decision of all) {
    if (decision.supersededById) predecessors.set(decision.supersededById, decision);
  }

  // One `seen` set across *both* walks, not one each. A cycle is reachable in
  // both directions, so two separate guards each stop correctly and still
  // collect the same decision twice: a chain longer than the workspace, with a
  // repeat in it. The service cannot create a cycle; a database restored by
  // hand could.
  const seen = new Set<string>([currentId]);

  const earlier: T[] = [];
  let cursor = predecessors.get(currentId);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    earlier.unshift(cursor);
    cursor = predecessors.get(cursor.id);
  }

  // Forwards: follow the replacements.
  const later: T[] = [];
  let next = current.supersededById ? byId.get(current.supersededById) : undefined;
  while (next && !seen.has(next.id)) {
    seen.add(next.id);
    later.push(next);
    next = next.supersededById ? byId.get(next.supersededById) : undefined;
  }

  if (earlier.length === 0 && later.length === 0) return [];

  return [...earlier, current, ...later].map((decision) => ({
    decision,
    current: decision.id === currentId,
  }));
}
