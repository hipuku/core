import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmAction } from "./ConfirmAction";

/**
 * Approve, Reject and Deprecate all go through this dialog. The part worth
 * testing is the failure path: an action that rejects (the network dropped,
 * the server failed) used to leave the confirm button spinning, with nothing
 * said and the rejection unhandled.
 */

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) },
}));

function renderAction(action: () => Promise<{ ok?: string; error?: string }>) {
  render(
    <ConfirmAction
      action={action}
      icon={null}
      label="Approve"
      title="Approve this decision?"
      description="It becomes immutable."
      confirmLabel="Approve"
      pendingLabel="Approving"
    />,
  );
}

describe("ConfirmAction", () => {
  beforeEach(() => {
    toastError.mockClear();
    toastSuccess.mockClear();
    refresh.mockClear();
  });

  it("says so and stops spinning when the action rejects", async () => {
    const user = userEvent.setup();
    renderAction(() => Promise.reject(new Error("offline")));

    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog");
    await user.click(
      screen.getAllByRole("button", { name: "Approve" }).find((b) => dialog.contains(b))!,
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Could not reach the server. Try again."),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("closes and refreshes when the action succeeds", async () => {
    const user = userEvent.setup();
    renderAction(() => Promise.resolve({ ok: "Approved." }));

    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog");
    await user.click(
      screen.getAllByRole("button", { name: "Approve" }).find((b) => dialog.contains(b))!,
    );

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Approved."));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });
});
