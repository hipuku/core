import type { LineRange } from "./snippet";
import { formatRange } from "./snippet";

/**
 * Reading a decision out of a form, and naming what it cites.
 *
 * These sat in the actions module, which may only export async functions, so
 * nothing could reach them from a test. They are the layer between what a
 * browser posts and what the service is handed: every proposal, revision and
 * draft passes through here, and a field read under the wrong name arrives as a
 * silently empty section rather than an error.
 */

/** The three ADR blocks, as posted. Absent and blank are the same thing. */
export function adrBody(formData: FormData): {
  context: string;
  decision: string;
  consequences: string;
} {
  return {
    context: String(formData.get("context") ?? "").trim(),
    decision: String(formData.get("decision") ?? "").trim(),
    consequences: String(formData.get("consequences") ?? "").trim(),
  };
}

export interface CitedRef {
  repoId: string;
  repo: string;
  path: string;
  lines: string | null;
}

/**
 * Files cited while composing, which are buffered in the form until the
 * decision exists to attach them to.
 *
 * The four fields are parallel arrays posted by repeated inputs, so they are
 * paired by position. `refRepoId` sets the length: a row without one cannot be
 * resolved to a repository, and a trailing label with no id is not a citation.
 */
export function citedRefs(formData: FormData): CitedRef[] {
  const repoIds = formData.getAll("refRepoId").map(String);
  const repos = formData.getAll("refRepoLabel").map(String);
  const paths = formData.getAll("refPath").map(String);
  const lines = formData.getAll("refLines").map(String);
  return repoIds.map((repoId, i) => ({
    repoId,
    repo: repos[i] ?? "",
    path: paths[i] ?? "",
    lines: lines[i] || null,
  }));
}

/**
 * How a file reference reads in the list: `owner/name · path · L47-L120`.
 *
 * The range is appended only when there is one, so a whole-file citation does
 * not carry a dangling separator.
 */
export function referenceLabel(
  owner: string,
  name: string,
  path: string,
  range: LineRange | null,
): string {
  const suffix = range ? ` · ${formatRange(range)}` : "";
  return `${owner}/${name} · ${path}${suffix}`;
}
