import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModalShell } from "./ModalShell";
import { axe } from "vitest-axe";

/**
 * The shell fronts every destructive dialog in the app, so the parts worth
 * testing are the ones a keyboard or screen-reader user hits first: focus goes
 * into the panel, Tab stays there, closing gives focus back, and a drag that
 * ends on the backdrop does not throw away what was typed.
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
    const confirm = screen.getByRole("button", { name: "confirm" });

    expect(document.activeElement).toBe(field);

    await user.tab();
    expect(document.activeElement).toBe(confirm);
    // Past the last item, focus wraps rather than reaching "behind".
    await user.tab();
    expect(document.activeElement).toBe(field);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
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

  it("closes on a backdrop click but not on a drag released there", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    const backdrop = container.querySelector("div")!;
    const field = screen.getByLabelText("name");

    // A selection drag that starts in the field and releases on the backdrop.
    await user.pointer([
      { target: field, keys: "[MouseLeft>]" },
      { target: backdrop },
      { keys: "[/MouseLeft]", target: backdrop },
    ]);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
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
