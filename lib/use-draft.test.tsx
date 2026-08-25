import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useDraft } from "./use-draft";

/**
 * `useDraft` is the whole reason twenty minutes of reasoning is no longer one
 * stray ⌘W away from gone, so it is worth testing the storage behaviour
 * directly rather than only through the editor.
 */

const KEY = "ws-1:new";
const STORAGE_KEY = `core:draft:${KEY}`;

/** A minimal consumer: type into it, and watch what reaches localStorage. */
function Harness({ initial = "" }: { initial?: string }) {
  const [text, setText] = useState(initial);
  const draft = useDraft<{ text: string }>({
    key: KEY,
    value: { text },
    pristine: text === initial,
  });

  return (
    <div>
      <input aria-label="body" value={text} onChange={(e) => setText(e.target.value)} />
      {draft.found && (
        <div>
          <span>found:{draft.found.data.text}</span>
          <button onClick={() => setText(draft.found!.data.text)}>restore</button>
          <button onClick={draft.dismiss}>dismiss</button>
        </div>
      )}
      <button onClick={draft.clear}>clear</button>
    </div>
  );
}

function store(value: unknown, savedAt = Date.now()) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt, data: value }));
}

function read() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { savedAt: number; data: { text: string } }) : null;
}

describe("useDraft", () => {
  it("does not write while the editor is untouched", async () => {
    vi.useFakeTimers();
    render(<Harness />);
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(read()).toBeNull();
  });

  // These two use `fireEvent` rather than `userEvent`. userEvent schedules its
  // own delays on the timers it captured at setup, so pairing it with fake
  // timers means the typing never completes and the test hangs until it times
  // out. Setting a value directly is the honest primitive here anyway: what is
  // under test is the debounce, not the keystrokes.
  it("persists after the debounce once something is typed", async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("body"), { target: { value: "hello" } });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(read()?.data).toEqual({ text: "hello" });
  });

  it("offers a stored draft on mount", () => {
    store({ text: "unsent work" });
    render(<Harness />);
    expect(screen.getByText("found:unsent work")).toBeInTheDocument();
  });

  it("does not offer one older than a week, and clears it out", () => {
    const eightDays = Date.now() - 8 * 24 * 60 * 60 * 1000;
    store({ text: "ancient" }, eightDays);
    render(<Harness />);

    expect(screen.queryByText(/^found:/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("survives unparseable storage rather than throwing", () => {
    window.localStorage.setItem(STORAGE_KEY, "{ not json");
    expect(() => render(<Harness />)).not.toThrow();
    expect(screen.queryByText(/^found:/)).not.toBeInTheDocument();
  });

  it("stops offering a draft once dismissed, but leaves it stored", async () => {
    const user = userEvent.setup();
    store({ text: "taken" });
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "dismiss" }));

    expect(screen.queryByText(/^found:/)).not.toBeInTheDocument();
    // The editor now holds the text; storage is not the place it went.
    expect(read()?.data).toEqual({ text: "taken" });
  });

  it("clear removes the stored draft entirely", async () => {
    const user = userEvent.setup();
    store({ text: "gone soon" });
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "clear" }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByText(/^found:/)).not.toBeInTheDocument();
  });

  it("does not write again after clear, even if more is typed", async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "clear" }));
    fireEvent.change(screen.getByLabelText("body"), { target: { value: "after" } });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Submitting is the one moment the local copy has done its job; writing it
    // back afterwards would resurrect a draft the server already has.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
