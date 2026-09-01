import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Dropdown, type DropdownOption } from "./Dropdown";

/**
 * The dropdown replaced a native <select> for styling, which means it owes the
 * keyboard everything the native control gave away: arrows, Home, End, Enter
 * and typeahead. It also has to keep `role="option"` a direct child of the
 * listbox, which is why focus stays on the trigger and the highlight travels
 * through `aria-activedescendant` instead.
 */
const OPTIONS: DropdownOption[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin", hint: "Can invite" },
  { value: "editor", label: "Editor" },
  { value: "email", label: "Emailer" },
];

function Harness({ onChange = () => {} }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState("admin");
  return (
    <Dropdown
      label="Role"
      name="role"
      value={value}
      options={OPTIONS}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

const trigger = () => screen.getByRole("combobox", { name: "Role" });
const active = () =>
  document.getElementById(trigger().getAttribute("aria-activedescendant") ?? "")
    ?.textContent;

describe("Dropdown", () => {
  it("keeps every option a direct child of the listbox", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());

    const list = screen.getByRole("listbox");
    for (const option of screen.getAllByRole("option")) {
      expect(option.parentElement).toBe(list);
      // A focusable element between the two would break the structure again.
      expect(option.tagName).toBe("LI");
    }
  });

  it("opens on ArrowDown and starts on the current selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(active()).toContain("Admin");

    await user.keyboard("{ArrowDown}");
    expect(active()).toContain("Editor");
    await user.keyboard("{ArrowUp}");
    expect(active()).toContain("Admin");
  });

  it("stops at the ends rather than wrapping, and Home and End reach them", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();
    await user.keyboard("{ArrowDown}{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(active()).toContain("Owner");
    await user.keyboard("{End}");
    expect(active()).toContain("Emailer");
    await user.keyboard("{ArrowDown}");
    expect(active()).toContain("Emailer");
    await user.keyboard("{Home}");
    expect(active()).toContain("Owner");
  });

  it("commits the active option on Enter and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    trigger().focus();

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("editor");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger().textContent).toContain("Editor");
    expect(document.activeElement).toBe(trigger());
  });

  it("jumps to a typed prefix, and cycles on a repeated letter", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();
    await user.keyboard("{ArrowDown}");

    await user.keyboard("e");
    expect(active()).toContain("Editor");
    // The same letter again moves on rather than staying put, the way a native
    // <select> cycles, instead of searching for "ee" and finding nothing.
    await user.keyboard("e");
    expect(active()).toContain("Emailer");
    await user.keyboard("e");
    expect(active()).toContain("Editor");
  });

  it("treats a run of different letters as one prefix", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();
    await user.keyboard("{ArrowDown}");

    // "Editor" and "Emailer" both start with e, so the second letter is what
    // separates them.
    await user.keyboard("em");
    expect(active()).toContain("Emailer");
  });

  it("returns focus to the trigger on Escape and leaves the value alone", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    trigger().focus();

    await user.keyboard("{ArrowDown}{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
  });

  it("still submits inside a plain form", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: /Owner/ }));

    const hidden = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="role"]',
    );
    expect(hidden?.value).toBe("owner");
  });
});
