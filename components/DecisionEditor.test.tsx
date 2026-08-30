import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionEditor } from "./DecisionEditor";

/**
 * The compose editor, exercised through the DOM.
 *
 * The text manipulation itself is covered by `lib/markdown/editing`: pure,
 * 27 tests. What is only observable here is the *wiring*: that a keystroke
 * reaches those functions and the caret survives, that leaving with unsaved
 * work is caught, and that the three ways out of the modal do different things.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) },
}));

// The picker talks to GitHub through server actions; none of that is under test.
vi.mock("@/app/app/actions", () => ({
  listWorkspaceFiles: vi.fn().mockResolvedValue({ files: [], truncated: [] }),
  addFileReference: vi.fn(),
  removeReference: vi.fn(),
  checkReferenceDrift: vi.fn(),
}));

const EMPTY = { context: "", decision: "", consequences: "" };

function setup(props: Partial<ComponentProps<typeof DecisionEditor>> = {}) {
  const action = vi.fn().mockResolvedValue(undefined);
  const onSaveDraft = vi.fn().mockResolvedValue({ ok: "Saved as a draft." });
  render(
    <DecisionEditor
      action={action}
      onSaveDraft={onSaveDraft}
      cancelHref="/app/ws-1"
      submitLabel="Propose decision"
      withTitle
      defaults={EMPTY}
      draftKey="ws-1:new"
      {...props}
    />,
  );
  return { action, onSaveDraft, user: userEvent.setup() };
}

const decisionField = () => screen.getByLabelText<HTMLTextAreaElement>("Decision");

beforeEach(() => {
  push.mockClear();
});

describe("DecisionEditor: markdown behaviour", () => {
  it("continues a list on Enter", async () => {
    const { user } = setup();
    const field = decisionField();
    await user.click(field);
    await user.type(field, "- first{Enter}second");
    expect(field.value).toBe("- first\n- second");
  });

  it("ends the list when Enter lands on an empty item", async () => {
    const { user } = setup();
    const field = decisionField();
    await user.click(field);
    await user.type(field, "- one{Enter}{Enter}");
    expect(field.value).toBe("- one\n");
  });

  it("indents with Tab instead of leaving the field", async () => {
    const { user } = setup();
    const field = decisionField();
    await user.click(field);
    await user.type(field, "- item");
    await user.tab();
    expect(field.value).toBe("  - item");
    expect(field).toHaveFocus();
  });

  it("wraps the selection with the bold shortcut", async () => {
    const { user } = setup();
    const field = decisionField();
    await user.click(field);
    await user.type(field, "make this bold");
    field.setSelectionRange(5, 9);
    await user.keyboard("{Control>}b{/Control}");
    expect(field.value).toBe("make **this** bold");
  });

  it("inserts markdown from the toolbar, so the syntax is visible", async () => {
    const { user } = setup();
    await user.click(decisionField());
    await user.click(screen.getByRole("button", { name: "Heading" }));
    expect(decisionField().value).toBe("## ");
  });

  it("submits on Cmd+Enter from inside the document", async () => {
    const { user, action } = setup();
    const field = decisionField();
    await user.click(field);
    await user.type(screen.getByLabelText("Title"), "A title");
    await user.click(field);
    await user.type(field, "the call");
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(action).toHaveBeenCalled());
  });
});

describe("DecisionEditor: leaving with unsaved work", () => {
  it("cancels straight out while nothing has been written", async () => {
    const { user } = setup();
    const cancel = screen.getByRole("link", { name: "Cancel" });
    expect(cancel).toHaveAttribute("href", "/app/ws-1");
    await user.click(cancel);
    expect(screen.queryByText("You have unsaved work")).not.toBeInTheDocument();
  });

  it("asks once something has been written", async () => {
    const { user } = setup();
    await user.type(decisionField(), "half a thought");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("You have unsaved work")).toBeInTheDocument();
  });

  it("offers three ways out, and keep editing is not one that leaves", async () => {
    const { user } = setup();
    await user.type(decisionField(), "half a thought");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: /Discard/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save as draft/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("You have unsaved work")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("parks the work on the server when asked to save as a draft", async () => {
    const { user, onSaveDraft, action } = setup();
    // A title as well as a body: the title is `required`, and jsdom runs form
    // validation on requestSubmit without honouring the submitter's
    // `formNoValidate`. An invalid form aborts the submit silently, so an empty
    // title makes this test look like a broken formAction when it is not.
    await user.type(screen.getByLabelText("Title"), "Worth keeping");
    await user.type(decisionField(), "worth keeping");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // Submitted through `requestSubmit(button)` rather than a click: the button
    // carries its own `formAction`, and that only takes effect when the submit
    // event knows its submitter. jsdom does not populate `event.submitter` from
    // a plain click, so a click here silently runs the *form's* action, which
    // would propose the decision instead of parking it.
    const save = screen.getByRole("button", { name: /Save as draft/ });
    await act(async () => {
      save.closest("form")!.requestSubmit(save);
    });

    await waitFor(() => expect(onSaveDraft).toHaveBeenCalled());
    // Parking is not proposing.
    expect(action).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/app/ws-1");
    // The server has it now; the local copy has done its job.
    expect(window.localStorage.getItem("core:draft:ws-1:new")).toBeNull();
  });

  it("closes on Escape without discarding anything", async () => {
    const { user } = setup();
    await user.type(decisionField(), "half a thought");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByText("You have unsaved work")).not.toBeInTheDocument();
    expect(decisionField().value).toBe("half a thought");
  });
});

describe("DecisionEditor: the document it is writing", () => {
  it("marks the decision as a draft until it is proposed", () => {
    setup({ nextKey: "VAU-014" });
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("VAU-014")).toBeInTheDocument();
  });

  it("does not call any block optional", () => {
    setup();
    expect(screen.queryByText("optional")).not.toBeInTheDocument();
  });

  it("shows what is unwritten in preview, rather than hiding it", async () => {
    const { user } = setup();
    await user.type(decisionField(), "only this one");
    await user.click(screen.getByRole("tab", { name: /Preview/ }));

    expect(screen.getAllByText("Not yet written.")).toHaveLength(2);
  });

  it("keeps the write pane mounted while previewing, so the fields still submit", async () => {
    const { user, action } = setup();
    await user.type(screen.getByLabelText("Title"), "A title");
    await user.type(decisionField(), "the call");
    await user.click(screen.getByRole("tab", { name: /Preview/ }));
    await user.click(screen.getByRole("button", { name: /Propose decision/ }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const formData = action.mock.calls[0]![0] as FormData;
    expect(formData.get("decision")).toBe("the call");
  });
});
