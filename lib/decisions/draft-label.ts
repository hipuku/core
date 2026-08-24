/**
 * What to call a draft that has no title yet.
 *
 * Requiring a title would be the obvious fix, and the wrong one: a draft exists
 * so half-formed work can be parked, and demanding a name before you may park it
 * puts a form field in front of the escape hatch. But "Untitled draft" three
 * times in a list is no better than no list at all.
 *
 * So the title is optional and a name is derived when it is missing, from the
 * first thing the author actually wrote. In practice that is almost always
 * enough to recognise your own work.
 */

const MAX = 72;

export interface DraftLabel {
  text: string;
  /** True when this was derived from the body rather than typed as a title. */
  derived: boolean;
}

/** Strip the markdown that would otherwise show up as punctuation in a list. */
function plain(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/, "")
    .replace(/^>\s?/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

export function draftLabel(
  title: string,
  body: { context: string; decision: string; consequences: string },
): DraftLabel {
  const typed = title.trim();
  if (typed) return { text: typed, derived: false };

  // Decision first: it is the sentence the whole record exists to hold, so it
  // names the draft better than the context leading up to it.
  for (const block of [body.decision, body.context, body.consequences]) {
    for (const line of block.split("\n")) {
      const text = plain(line);
      if (text) {
        return {
          text: text.length > MAX ? `${text.slice(0, MAX - 1).trimEnd()}…` : text,
          derived: true,
        };
      }
    }
  }
  return { text: "Empty draft", derived: true };
}
