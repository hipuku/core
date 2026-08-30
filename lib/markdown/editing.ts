/**
 * Markdown editing as pure functions over a textarea's state.
 *
 * The compose editor is a plain <textarea> by choice: no CodeMirror, no
 * contenteditable, no third-party editor to keep in sync with how the document
 * later renders. What makes it *feel* like a markdown editor is behaviour while
 * typing: a list that continues itself, Tab that indents, ⌘B that wraps a
 * selection. All of that is text-in / text-out, so it lives here, pure and
 * tested, and the component only applies the result.
 *
 * Every function takes the full value plus the caret (or selection) and returns
 * the same shape. Returning `null` means "this keystroke is not ours", so the
 * caller lets the browser handle it.
 */

export interface EditState {
  value: string;
  /** Selection start, as a character offset into `value`. */
  start: number;
  /** Selection end. Equal to `start` when nothing is selected. */
  end: number;
}

/** How far a marker is indented, and what marker it is. */
interface ListItem {
  indent: string;
  /** `-`, `*`, `+`, `1.`, or `>`: the literal marker text. */
  marker: string;
  /** `[ ]` / `[x]` for a task item, else null. */
  checkbox: string | null;
  /** Everything after the marker and its trailing space. */
  content: string;
}

const LIST_LINE =
  /^(\s*)(?:([-*+])|(\d+)([.)]))\s+(?:(\[[ xX]\])\s+)?(.*)$/;
const QUOTE_LINE = /^(\s*)(>+)\s?(.*)$/;

function lineBoundsAt(value: string, offset: number): [number, number] {
  const start = value.lastIndexOf("\n", offset - 1) + 1;
  const nextBreak = value.indexOf("\n", offset);
  return [start, nextBreak === -1 ? value.length : nextBreak];
}

function parseListLine(line: string): ListItem | null {
  const bullet = LIST_LINE.exec(line);
  if (bullet) {
    const [, indent, dash, digits, delim, checkbox, content] = bullet;
    return {
      indent: indent ?? "",
      marker: dash ?? `${digits}${delim}`,
      checkbox: checkbox ?? null,
      content: content ?? "",
    };
  }
  const quote = QUOTE_LINE.exec(line);
  if (quote) {
    const [, indent, arrows, content] = quote;
    return {
      indent: indent ?? "",
      marker: arrows ?? ">",
      checkbox: null,
      content: content ?? "",
    };
  }
  return null;
}

/** An ordered marker (`3.`) advances; every other marker repeats verbatim. */
function nextMarker(marker: string): string {
  const ordered = /^(\d+)([.)])$/.exec(marker);
  if (!ordered) return marker;
  return `${Number(ordered[1]) + 1}${ordered[2]}`;
}

function replaceRange(
  state: EditState,
  from: number,
  to: number,
  text: string,
  caret = from + text.length,
): EditState {
  return {
    value: state.value.slice(0, from) + text + state.value.slice(to),
    start: caret,
    end: caret,
  };
}

/**
 * Enter inside a list continues it; Enter on an *empty* item ends the list
 * instead of stacking another empty bullet, the behaviour every markdown
 * editor has and every plain textarea lacks. Returns null when the caret is not
 * in a list, so a normal newline falls through to the browser.
 */
export function continueList(state: EditState): EditState | null {
  if (state.start !== state.end) return null;

  const [lineStart, lineEnd] = lineBoundsAt(state.value, state.start);
  // Only continue from the end of the line; mid-line Enter is a plain split.
  if (state.start !== lineEnd) return null;

  const item = parseListLine(state.value.slice(lineStart, lineEnd));
  if (!item) return null;

  // An empty item means "I'm done with this list": clear the marker instead of
  // emitting another one.
  if (item.content.trim() === "") {
    return replaceRange(state, lineStart, lineEnd, item.indent);
  }

  const checkbox = item.checkbox ? " [ ]" : "";
  const inserted = `\n${item.indent}${nextMarker(item.marker)}${checkbox} `;
  return replaceRange(state, state.start, state.start, inserted);
}

const INDENT = "  ";

/**
 * Tab indents, Shift+Tab outdents, across every line the selection touches, so
 * nesting a whole sub-list is one keystroke. Without this, Tab leaves the field
 * and there is no way to nest at all.
 */
export function indent(state: EditState, direction: 1 | -1): EditState {
  const [blockStart] = lineBoundsAt(state.value, state.start);
  const [, blockEnd] = lineBoundsAt(state.value, state.end);
  const lines = state.value.slice(blockStart, blockEnd).split("\n");

  let firstDelta = 0;
  let totalDelta = 0;

  const shifted = lines.map((line, i) => {
    if (direction === 1) {
      if (i === 0) firstDelta = INDENT.length;
      totalDelta += INDENT.length;
      return INDENT + line;
    }
    const removable = /^[ \t]{1,2}/.exec(line);
    const removed = removable ? removable[0].length : 0;
    if (i === 0) firstDelta = -removed;
    totalDelta -= removed;
    return line.slice(removed);
  });

  return {
    value:
      state.value.slice(0, blockStart) +
      shifted.join("\n") +
      state.value.slice(blockEnd),
    start: Math.max(blockStart, state.start + firstDelta),
    end: Math.max(blockStart, state.end + totalDelta),
  };
}

/**
 * Wrap the selection in `marker`, or unwrap it if it is already wrapped:
 * ⌘B on bold text un-bolds it rather than producing `****text****`.
 * With nothing selected, inserts the pair and puts the caret between them.
 */
export function wrap(state: EditState, marker: string): EditState {
  const { value, start, end } = state;
  const selected = value.slice(start, end);

  const alreadyInside =
    value.slice(start - marker.length, start) === marker &&
    value.slice(end, end + marker.length) === marker;

  if (alreadyInside) {
    return {
      value:
        value.slice(0, start - marker.length) +
        selected +
        value.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }

  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
    const inner = selected.slice(marker.length, -marker.length);
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
  }

  const wrapped = marker + selected + marker;
  return {
    value: value.slice(0, start) + wrapped + value.slice(end),
    start: start + marker.length,
    end: start + marker.length + selected.length,
  };
}

/**
 * Add or remove a line-level prefix (`## `, `- `, `> `) on every line the
 * selection touches. Toggling is per-block: if every touched line already has
 * the prefix, it comes off.
 */
export function toggleLinePrefix(state: EditState, prefix: string): EditState {
  const [blockStart] = lineBoundsAt(state.value, state.start);
  const [, blockEnd] = lineBoundsAt(state.value, state.end);
  const lines = state.value.slice(blockStart, blockEnd).split("\n");

  // Headings replace each other: `## ` over an existing `# ` should not stack.
  const heading = /^#{1,6}\s+/;
  const isHeading = /^#{1,6}\s$/.test(prefix);

  const allPrefixed = lines.every((l) => l.startsWith(prefix));
  const next = lines.map((line) => {
    if (allPrefixed) return line.slice(prefix.length);
    const bare = isHeading ? line.replace(heading, "") : line;
    return prefix + bare;
  });

  const rebuilt = next.join("\n");
  const delta = rebuilt.length - (blockEnd - blockStart);
  return {
    value: state.value.slice(0, blockStart) + rebuilt + state.value.slice(blockEnd),
    start: state.start + (allPrefixed ? -prefix.length : prefix.length),
    end: state.end + delta,
  };
}

/**
 * ⌘K. Selected text becomes the link label with the caret in the URL slot;
 * a selection that already looks like a URL becomes the target instead.
 */
export function insertLink(state: EditState): EditState {
  const selected = state.value.slice(state.start, state.end);
  const looksLikeUrl = /^(https?:\/\/|\/|mailto:)\S*$/.test(selected);

  const text = looksLikeUrl ? `[](${selected})` : `[${selected}](url)`;
  const caretStart = looksLikeUrl ? state.start + 1 : state.start + selected.length + 3;
  const caretEnd = looksLikeUrl ? caretStart : caretStart + 3;

  return {
    value: state.value.slice(0, state.start) + text + state.value.slice(state.end),
    start: caretStart,
    end: caretEnd,
  };
}

/**
 * Drop a fenced block on its own lines, with blank-line separation only where
 * it is actually needed, and the caret placed inside the fence.
 */
export function insertFence(state: EditState, language: string, body = ""): EditState {
  const before = state.value.slice(0, state.start);
  const after = state.value.slice(state.end);

  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = after === "" || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";

  const opening = `${lead}\`\`\`${language}\n`;
  const text = `${opening}${body}\n\`\`\`${tail}`;
  const caret = state.start + opening.length + body.length;

  return { value: before + text + after, start: caret, end: caret };
}
