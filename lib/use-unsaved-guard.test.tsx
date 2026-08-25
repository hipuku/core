import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useUnsavedGuard } from "./use-unsaved-guard";

/**
 * The guard exists because `beforeunload` only covers leaving the *site*.
 * Client routing never touches it, so the topbar's back arrow silently
 * discarded a half-written decision.
 *
 * It is deliberately narrow, and the narrowness is the part worth testing: a
 * guard that swallows a ⌘-click or an external link feels broken rather than
 * protective.
 */
function Harness({
  when,
  onBlocked,
}: {
  when: boolean;
  onBlocked: (href: string) => void;
}) {
  useUnsavedGuard({ when, onBlocked });
  // The guard listens in the capture phase, so it sees every click before this
  // does and `defaultPrevented` is still false when it decides. Preventing
  // default here only stops jsdom logging "Not implemented: navigation" for the
  // clicks the guard deliberately lets through.
  return (
    <div onClick={(e) => e.preventDefault()}>
      <a href="/app/ws-1">internal</a>
      <a href="/app/ws-1?tab=x">internal with query</a>
      <a href="https://example.com/away">external</a>
      <a href="/files/report.pdf" download>
        download
      </a>
      <a href="/app/ws-2" target="_blank" rel="noreferrer">
        new tab
      </a>
      <a href={typeof window === "undefined" ? "#top" : `${window.location.pathname}#top`}>
        same page
      </a>
      <button type="button">not a link</button>
    </div>
  );
}

function setup(when: boolean) {
  const onBlocked = vi.fn();
  render(<Harness when={when} onBlocked={onBlocked} />);
  return { onBlocked, user: userEvent.setup() };
}

describe("useUnsavedGuard", () => {
  it("blocks an in-app link while there is unsaved work", async () => {
    const { onBlocked, user } = setup(true);
    await user.click(screen.getByText("internal"));
    expect(onBlocked).toHaveBeenCalledWith("/app/ws-1");
  });

  it("passes the query string through, so the destination is not lost", async () => {
    const { onBlocked, user } = setup(true);
    await user.click(screen.getByText("internal with query"));
    expect(onBlocked).toHaveBeenCalledWith("/app/ws-1?tab=x");
  });

  it("does nothing when there is nothing to lose", async () => {
    const { onBlocked, user } = setup(false);
    await user.click(screen.getByText("internal"));
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("ignores an external link", async () => {
    const { onBlocked, user } = setup(true);
    await user.click(screen.getByText("external"));
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("ignores a download", async () => {
    const { onBlocked, user } = setup(true);
    await user.click(screen.getByText("download"));
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("ignores a link opening in a new tab", async () => {
    const { onBlocked, user } = setup(true);
    await user.click(screen.getByText("new tab"));
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("ignores a jump within the same page", async () => {
    const { onBlocked, user } = setup(true);
    await user.click(screen.getByText("same page"));
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("ignores a modified click, which opens a new tab rather than navigating", async () => {
    const { onBlocked, user } = setup(true);
    await user.keyboard("{Meta>}");
    await user.click(screen.getByText("internal"));
    await user.keyboard("{/Meta}");
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("ignores clicks that are not on a link at all", async () => {
    const { onBlocked, user } = setup(true);
    await user.click(screen.getByRole("button", { name: "not a link" }));
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("stops guarding once the work is saved", async () => {
    const onBlocked = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Harness when={true} onBlocked={onBlocked} />);

    rerender(<Harness when={false} onBlocked={onBlocked} />);
    await user.click(screen.getByText("internal"));

    expect(onBlocked).not.toHaveBeenCalled();
  });
});
