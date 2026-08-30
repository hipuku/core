/**
 * Comparing a *cited range* of a file, rather than the whole file.
 *
 * A whole-file reference is a blunt instrument: any commit touching a 900-line
 * module marks every decision citing it as stale, and a staleness signal that
 * fires on unrelated typos is one people learn to ignore. Citing lines 47–120
 * turns the claim from "this file changed" into "the code this decision governs
 * changed", which is the only version worth acting on.
 *
 * The hard case is *movement*. Insert twenty lines at the top of a file and the
 * cited code is untouched but now lives at 67–140. Comparing by line number
 * alone would call that a change; it is not one, and reporting it as one
 * reintroduces exactly the noise ranges were meant to remove. So the baseline
 * text is stored alongside the range, and a range that no longer matches is
 * searched for elsewhere in the file before anything is called drift.
 *
 * Pure: no network, no database. The caller fetches the file.
 */

export interface LineRange {
  /** 1-based, inclusive. */
  start: number;
  /** 1-based, inclusive. */
  end: number;
}

export type SnippetVerdict =
  /** The cited lines are unchanged, at the same place. */
  | { status: "synced" }
  /** Unchanged, but they live somewhere else now, so the range is updated. */
  | { status: "moved"; range: LineRange }
  /** The cited lines are gone or different. */
  | { status: "changed" };

/** Extract a 1-based inclusive line range. Out-of-bounds clamps to the file. */
export function extractRange(content: string, range: LineRange): string {
  const lines = content.split("\n");
  const start = Math.max(1, range.start);
  const end = Math.min(lines.length, range.end);
  if (start > lines.length || end < start) return "";
  return lines.slice(start - 1, end).join("\n");
}

/**
 * Trailing whitespace and a file's final newline are not semantic changes, and
 * treating them as drift would fire on a formatter run. Leading indentation *is*
 * kept: a block that changed indentation moved scope, which is a real change.
 */
function normalize(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

/**
 * Find where `baseline` now sits in `content`, as a 1-based inclusive range, or
 * null if it is not there. Matches on normalized text so that reformatting of
 * trailing space does not hide an otherwise intact block.
 */
function locate(content: string, baseline: string): LineRange | null {
  const needle = normalize(baseline);
  if (needle === "") return null;

  const lines = content.split("\n").map((line) => line.replace(/\s+$/, ""));
  const needleLines = needle.split("\n");
  const span = needleLines.length;

  for (let i = 0; i + span <= lines.length; i++) {
    let matched = true;
    for (let j = 0; j < span; j++) {
      if (lines[i + j] !== needleLines[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return { start: i + 1, end: i + span };
  }
  return null;
}

/**
 * Compare a cited range against the file as it stands now.
 *
 * Order matters: the cheap same-place check runs first, because the overwhelming
 * majority of checks find the code exactly where it was left.
 */
export function compareSnippet({
  baseline,
  content,
  range,
}: {
  /** The cited text as it was when the decision recorded it. */
  baseline: string;
  /** The file's current contents. */
  content: string;
  /** Where the citation pointed when it was made. */
  range: LineRange;
}): SnippetVerdict {
  const wanted = normalize(baseline);
  if (normalize(extractRange(content, range)) === wanted) return { status: "synced" };

  const moved = locate(content, baseline);
  if (moved) return { status: "moved", range: moved };

  return { status: "changed" };
}

/** `L47-L120`, or `L47` for a single line. The suffix GitHub itself understands. */
export function formatRange(range: LineRange): string {
  return range.start === range.end
    ? `L${range.start}`
    : `L${range.start}-L${range.end}`;
}

/** Parse `L47-L120` / `L47` / `47-120`. Returns null for anything else. */
export function parseRange(text: string): LineRange | null {
  const match = /^L?(\d+)(?:\s*-\s*L?(\d+))?$/.exec(text.trim());
  if (!match) return null;

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (start < 1 || end < 1) return null;
  // A backwards range is a typo rather than an empty selection, so read it either way.
  return start <= end ? { start, end } : { start: end, end: start };
}
