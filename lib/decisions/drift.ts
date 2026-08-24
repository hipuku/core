import type { ReferenceRecord } from "./store";

export type DriftStatus = "synced" | "drifted" | "missing" | "unknown";

type DriftInput = Pick<ReferenceRecord, "kind" | "baselineSha" | "currentSha">;

/**
 * Where a file reference stands relative to the code it cited:
 * - `synced`  — the file is unchanged since the decision referenced it
 * - `drifted` — the file has changed since (the decision may be out of date)
 * - `missing` — the file no longer exists at that path
 * - `unknown` — a link reference, or a file never checked
 */
export function referenceDrift(ref: DriftInput): DriftStatus {
  if (ref.kind !== "file" || !ref.baselineSha) return "unknown";
  if (ref.currentSha === null) return "missing";
  return ref.currentSha === ref.baselineSha ? "synced" : "drifted";
}

/** A decision is stale when any file it references has drifted or gone missing. */
export function isStale(refs: DriftInput[]): boolean {
  return refs.some((ref) => {
    const status = referenceDrift(ref);
    return status === "drifted" || status === "missing";
  });
}
