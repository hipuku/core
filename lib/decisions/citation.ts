/**
 * Inline file citations — `{{owner/repo:path#L47-L120}}`.
 *
 * A reference list under a decision says *which* files matter but never *why*,
 * and a reader six months later has to guess which paragraph each entry belongs
 * to. Citing inline puts the file where the argument about it is: "we chose this
 * because {{acme/api:src/auth.ts#L12-L40}} already assumes it".
 *
 * The token is deliberately a plain-text form the author can type, paste and
 * edit — the same reason markdown links look the way they do. It survives being
 * copied into a commit message or a Slack thread, which a rich-editor node
 * would not.
 *
 * Pure: no rendering, no network. `renderCitations` rewrites tokens into
 * ordinary markdown so the renderer needs no plugin.
 */

export interface Citation {
  /** `owner/repo`. */
  repo: string;
  path: string;
  /** `L47-L120`, or null for the whole file. */
  lines: string | null;
}

/**
 * `{{repo:path}}` or `{{repo:path#lines}}`. Repo and path exclude `{`, `}` and
 * `#` so an unterminated token cannot swallow the rest of a paragraph.
 */
const TOKEN = /\{\{([^{}#:]+):([^{}#]+)(?:#([^{}]+))?\}\}/g;

export function formatCitation(citation: Citation): string {
  const lines = citation.lines ? `#${citation.lines}` : "";
  return `{{${citation.repo}:${citation.path}${lines}}}`;
}

/** Every citation in a body of markdown, in the order they appear. */
export function findCitations(markdown: string): Citation[] {
  const found: Citation[] = [];
  for (const match of markdown.matchAll(TOKEN)) {
    found.push({
      repo: match[1]!.trim(),
      path: match[2]!.trim(),
      lines: match[3]?.trim() || null,
    });
  }
  return found;
}

/**
 * Rewrite citation tokens into markdown links, using whatever the resolver
 * knows. A token the resolver cannot place becomes inline code rather than
 * disappearing: an unresolvable citation is still something the author wrote and
 * a reader should see, and silently dropping it would hide a typo.
 */
export function renderCitations(
  markdown: string,
  resolve: (citation: Citation) => string | null,
): string {
  return markdown.replace(TOKEN, (whole, repo: string, path: string, lines?: string) => {
    const citation: Citation = {
      repo: repo.trim(),
      path: path.trim(),
      lines: lines?.trim() || null,
    };
    const href = resolve(citation);
    const label = citationLabel(citation);
    if (!href) return `\`${label}\``;
    // Escape the label's brackets so a path containing them cannot break out of
    // the link syntax it is being placed into.
    return `[${label.replace(/([[\]])/g, "\\$1")}](${href})`;
  });
}

/** `src/auth.ts · L47-L120` — the filename leads, since that is what is scanned. */
export function citationLabel(citation: Citation): string {
  const file = citation.path.split("/").pop() || citation.path;
  return citation.lines ? `${file} · ${citation.lines}` : file;
}

/**
 * Citations in the prose that no reference is tracking.
 *
 * Citing a file inline and attaching it as a reference are different acts —
 * one is an argument, the other starts watching for drift — and the app
 * deliberately does not conflate them: "mentioned while reasoning" is not
 * "this decision governs this code", and auto-tracking would fill the log
 * with drift from files cited as counter-examples.
 *
 * But a chip in the text with no entry in the reference list reads as an
 * inconsistency rather than as a distinction. This finds that gap so the
 * interface can offer to close it, one citation at a time, rather than
 * silently closing it or leaving it to be noticed.
 *
 * Compared on repo and path only. A citation naming lines 40–60 of a file
 * already tracked as a whole is covered: the file is being watched.
 */
export function untrackedCitations(
  markdown: string,
  tracked: { repo: string; path: string }[],
): Citation[] {
  const known = new Set(tracked.map((t) => `${t.repo}:${t.path}`));
  const seen = new Set<string>();

  return findCitations(markdown).filter((citation) => {
    const key = `${citation.repo}:${citation.path}`;
    if (known.has(key) || seen.has(key)) return false;
    // The same file cited three times is one thing to track, not three.
    seen.add(key);
    return true;
  });
}

interface EditState {
  value: string;
  start: number;
  end: number;
}

/**
 * Insert a citation at the caret, with the spacing a sentence needs — no space
 * at the start of a line or after an existing one, exactly one otherwise.
 */
export function insertCitation(state: EditState, citation: Citation): EditState {
  const token = formatCitation(citation);
  const before = state.value.slice(0, state.start);
  const after = state.value.slice(state.end);

  const needsLead = before !== "" && !/[\s([]$/.test(before);
  const text = (needsLead ? " " : "") + token;
  const caret = state.start + text.length;

  return { value: before + text + after, start: caret, end: caret };
}
