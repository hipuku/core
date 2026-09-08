import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModalShell } from "./ModalShell";
import { axe } from "vitest-axe";

/**
 * The shell fronts every destructive dialog in the app, so the parts worth
 * testing are the ones a keyboard or screen-reader user hits first: focus goes
 * into the panel, Tab stays there, closing gives focus back, and a stray
 * backdrop click does not throw away a half-filled form. Since C3 the shell
 * composes haus's Modal with dismissOnBackdrop off, which is how the last of
 * those is guaranteed rather than by the old drag-release detection.
 */
function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  return (
    <>
      <button type="button">behind</button>
      <ModalShell title="Delete workspace" onClose={onClose}>
        <input aria-label="name" />
        <button type="button">confirm</button>
      </ModalShell>
    </>
  );
}

describe("ModalShell", () => {
  it("names the dialog by its rendered heading", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Delete workspace" });
    expect(dialog.getAttribute("aria-labelledby")).toBe(
      screen.getByRole("heading", { name: "Delete workspace" }).id,
    );
  });

  it("focuses the first field and keeps Tab inside the panel", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText("name");
    const dialog = screen.getByRole("dialog");
    const behind = screen.getByRole("button", { name: "behind" });

    // Focus lands on the first body field, not the dialog and not haus Modal's
    // header close button.
    expect(document.activeElement).toBe(field);

    // Tab cycles within the dialog and never reaches the page behind it. The
    // dialog now carries a keyboard-reachable close button, so the cycle is
    // close → field → confirm rather than the two-item wrap the hand-rolled
    // shell had; what matters is that focus stays trapped.
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(document.activeElement).not.toBe(behind);
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 4; i++) {
      await user.tab({ shift: true });
      expect(document.activeElement).not.toBe(behind);
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("gives focus back to the opener when it closes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <button type="button">open</button>
        <div id="slot" />
      </>,
    );
    const opener = screen.getByRole("button", { name: "open" });
    opener.focus();

    rerender(
      <>
        <button type="button">open</button>
        <ModalShell title="Delete workspace" onClose={() => {}}>
          <button type="button">confirm</button>
        </ModalShell>
      </>,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "confirm" }),
    );

    rerender(
      <>
        <button type="button">open</button>
        <div id="slot" />
      </>,
    );
    expect(document.activeElement).toBe(opener);
    await user.tab();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks the page behind it and unlocks on close", () => {
    const { unmount } = render(<Harness />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("does not close on a backdrop click: dismiss is off for these dialogs", async () => {
    // Every core modal is a form or a destructive confirm, so the shell sets
    // dismissOnBackdrop={false}. A stray click on the backdrop, including one
    // ending a text-selection drag out of a field, cannot discard the dialog:
    // it closes by Escape or its own controls, never by the backdrop.
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const backdrop = screen.getByRole("dialog").parentElement!;

    await user.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close on a click inside the panel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "confirm" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * core has 30 components and shipped six component tests, none of which
 * asserted anything about accessibility. The two that own focus come first:
 * axe cannot see a missing focus trap, so these sit alongside the keyboard
 * tests rather than standing in for them.
 */
describe("accessibility", () => {
  it("has no violations when open", async () => {
    const { container } = render(<Harness />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
