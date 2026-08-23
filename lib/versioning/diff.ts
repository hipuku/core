import type { Change, Json } from "./types";

function isObject(value: Json): value is { [key: string]: Json } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** RFC 6901: `~` and `/` are the two reserved characters in a pointer token. */
function escapeToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Deep structural equality over JSON. Used to prune unchanged subtrees before recursing. */
export function equal(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return (
      keysA.length === keysB.length &&
      keysA.every((k) => k in b && equal(a[k], b[k]))
    );
  }
  return false;
}

/**
 * Structural diff between two JSON states, producing a flat list of changes each
 * addressed by a JSON Pointer. Objects diff by key, arrays by index. Two values of
 * differing shape (object vs array, or any primitive change) are a single `replace`
 * at their shared path.
 *
 * Array diffing is index-based, not a longest-common-subsequence match: inserting an
 * item at the front reports every following index as changed. That is honest and
 * correct, just not minimal; an LCS pass is the obvious future refinement, kept out
 * of v1 so the core stays small and auditable.
 */
export function diff(before: Json, after: Json, path = ""): Change[] {
  if (equal(before, after)) return [];

  if (isObject(before) && isObject(after)) {
    const changes: Change[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      const childPath = `${path}/${escapeToken(key)}`;
      const inBefore = key in before;
      const inAfter = key in after;
      if (inBefore && !inAfter) {
        changes.push({ op: "remove", path: childPath, before: before[key] });
      } else if (!inBefore && inAfter) {
        changes.push({ op: "add", path: childPath, after: after[key] });
      } else {
        changes.push(...diff(before[key], after[key], childPath));
      }
    }
    return changes;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const changes: Change[] = [];
    const length = Math.max(before.length, after.length);
    for (let i = 0; i < length; i++) {
      const childPath = `${path}/${i}`;
      const inBefore = i < before.length;
      const inAfter = i < after.length;
      if (inBefore && !inAfter) {
        changes.push({ op: "remove", path: childPath, before: before[i] });
      } else if (!inBefore && inAfter) {
        changes.push({ op: "add", path: childPath, after: after[i] });
      } else {
        changes.push(...diff(before[i], after[i], childPath));
      }
    }
    return changes;
  }

  // Differing shapes or a changed primitive: one replace at this path.
  return [{ op: "replace", path, before, after }];
}
