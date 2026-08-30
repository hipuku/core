import { describe, expect, it } from "vitest";
import {
  continueList,
  indent,
  insertFence,
  insertLink,
  toggleLinePrefix,
  wrap,
  type EditState,
} from "./editing";

/**
 * `|` marks the caret; `«…»` marks a selection. Guillemets rather than square
 * brackets because markdown itself uses `[`, for links and for task items,
 * and a marker that collides with the syntax under test is a trap.
 */
function at(marked: string): EditState {
  const open = marked.indexOf("\u00ab");
  if (open !== -1) {
    const close = marked.indexOf("\u00bb");
    const value =
      marked.slice(0, open) + marked.slice(open + 1, close) + marked.slice(close + 1);
    return { value, start: open, end: close - 1 };
  }
  const caret = marked.indexOf("|");
  return { value: marked.replace("|", ""), start: caret, end: caret };
}

function show(state: EditState): string {
  if (state.start === state.end) {
    return state.value.slice(0, state.start) + "|" + state.value.slice(state.start);
  }
  return (
    state.value.slice(0, state.start) +
    "\u00ab" +
    state.value.slice(state.start, state.end) +
    "\u00bb" +
    state.value.slice(state.end)
  );
}

describe("continueList", () => {
  it("continues a bullet", () => {
    expect(show(continueList(at("- one|"))!)).toBe("- one\n- |");
  });

  it("advances an ordered marker rather than repeating it", () => {
    expect(show(continueList(at("1. one\n2. two|"))!)).toBe("1. one\n2. two\n3. |");
  });

  it("carries the task checkbox but never the checked state", () => {
    expect(show(continueList(at("- [x] done|"))!)).toBe("- [x] done\n- [ ] |");
  });

  it("preserves indentation of a nested item", () => {
    expect(show(continueList(at("  - deep|"))!)).toBe("  - deep\n  - |");
  });

  it("continues a blockquote", () => {
    expect(show(continueList(at("> quoted|"))!)).toBe("> quoted\n> |");
  });

  it("ends the list when the item is empty, instead of stacking bullets", () => {
    expect(show(continueList(at("- one\n- |"))!)).toBe("- one\n|");
  });

  it("keeps indentation when ending a nested empty item", () => {
    expect(show(continueList(at("  - |"))!)).toBe("  |");
  });

  it("declines outside a list, so Enter stays a plain newline", () => {
    expect(continueList(at("just a paragraph|"))).toBeNull();
  });

  it("declines mid-line, where Enter should split the text", () => {
    expect(continueList(at("- one| two"))).toBeNull();
  });

  it("declines when text is selected", () => {
    expect(continueList(at("- \u00abone\u00bb"))).toBeNull();
  });
});

describe("indent", () => {
  it("indents the caret's line", () => {
    expect(show(indent(at("- one|"), 1))).toBe("  - one|");
  });

  it("indents every line the selection touches", () => {
    const result = indent(at("- \u00abone\n- two\u00bb"), 1);
    expect(result.value).toBe("  - one\n  - two");
  });

  it("outdents, and stops at column zero", () => {
    expect(indent(at("  - one|"), -1).value).toBe("- one");
    expect(indent(at("- one|"), -1).value).toBe("- one");
  });
});

describe("wrap", () => {
  it("wraps a selection and keeps it selected", () => {
    expect(show(wrap(at("make \u00abthis\u00bb bold"), "**"))).toBe("make **\u00abthis\u00bb** bold");
  });

  it("unwraps when the markers are just outside the selection", () => {
    expect(show(wrap(at("make **\u00abthis\u00bb** bold"), "**"))).toBe("make «this» bold");
  });

  it("unwraps when the markers are inside the selection", () => {
    expect(wrap(at("make \u00ab**this**\u00bb bold"), "**").value).toBe("make this bold");
  });

  it("inserts an empty pair with the caret between the markers", () => {
    expect(show(wrap(at("a |"), "`"))).toBe("a `|`");
  });
});

describe("toggleLinePrefix", () => {
  it("adds a prefix", () => {
    expect(toggleLinePrefix(at("Title|"), "## ").value).toBe("## Title");
  });

  it("removes it again", () => {
    expect(toggleLinePrefix(at("## Title|"), "## ").value).toBe("Title");
  });

  it("replaces one heading level with another rather than stacking", () => {
    expect(toggleLinePrefix(at("# Title|"), "### ").value).toBe("### Title");
  });

  it("applies across a multi-line selection", () => {
    expect(toggleLinePrefix(at("\u00abone\ntwo\u00bb"), "- ").value).toBe("- one\n- two");
  });

  it("only removes when every touched line has the prefix", () => {
    expect(toggleLinePrefix(at("\u00ab- one\ntwo\u00bb"), "- ").value).toBe("- - one\n- two");
  });
});

describe("insertLink", () => {
  it("makes the selection the label and puts the caret in the url", () => {
    expect(show(insertLink(at("see \u00abthe docs\u00bb here")))).toBe("see [the docs](\u00aburl\u00bb) here");
  });

  it("treats a selected url as the target, not the label", () => {
    expect(show(insertLink(at("\u00abhttps://x.dev\u00bb")))).toBe("[|](https://x.dev)");
  });
});

describe("insertFence", () => {
  it("separates the fence from surrounding text", () => {
    expect(insertFence(at("text|"), "mermaid").value).toBe("text\n\n```mermaid\n\n```");
  });

  it("does not add blank lines that are already there", () => {
    expect(insertFence(at("text\n\n|"), "mermaid").value).toBe("text\n\n```mermaid\n\n```");
  });

  it("puts the caret inside the fence", () => {
    const result = insertFence(at("|"), "mermaid");
    expect(result.value.slice(0, result.start)).toBe("```mermaid\n");
  });
});
