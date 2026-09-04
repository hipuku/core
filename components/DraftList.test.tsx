import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DraftList, type DraftSummary } from "./DraftList";
import { axe } from "vitest-axe";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const EMPTY = { context: "", decision: "", consequences: "" };

function draft(over: Partial<DraftSummary> = {}): DraftSummary {
  return {
    id: "d1",
    title: "",
    body: EMPTY,
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

describe("DraftList", () => {
  it("renders nothing when there are no drafts", () => {
    const { container } = render(
      <DraftList workspaceId="ws-1" workspaceKey="VAU" drafts={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the workspace key with no number, since a draft has none yet", () => {
    render(
      <DraftList workspaceId="ws-1" workspaceKey="VAU" drafts={[draft({ title: "Use Postgres" })]} />,
    );
    expect(screen.getByText("VAU-•••")).toBeInTheDocument();
  });

  it("tags a draft, so it is told from a decision by more than its number", () => {
    render(<DraftList workspaceId="ws-1" workspaceKey="VAU" drafts={[draft()]} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("uses a typed title when there is one", () => {
    render(
      <DraftList workspaceId="ws-1" workspaceKey="VAU" drafts={[draft({ title: "Use Postgres" })]} />,
    );
    expect(screen.getByText("Use Postgres")).toBeInTheDocument();
  });

  it("names an untitled draft from its body rather than calling it Untitled", () => {
    render(
      <DraftList
        workspaceId="ws-1"
        workspaceKey="VAU"
        drafts={[draft({ body: { ...EMPTY, decision: "## Adopt Drizzle" } })]}
      />,
    );
    // Markdown stripped: a list of drafts should not fill with punctuation.
    expect(screen.getByText("Adopt Drizzle")).toBeInTheDocument();
  });

  it("links to the draft's own compose screen", () => {
    render(
      <DraftList workspaceId="ws-1" workspaceKey="VAU" drafts={[draft({ id: "abc" })]} />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/app/ws-1/new?draft=abc",
    );
  });

  it("offers no delete control; discarding happens where the text is readable", () => {
    render(<DraftList workspaceId="ws-1" workspaceKey="VAU" drafts={[draft()]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when each draft was last touched", () => {
    render(
      <DraftList
        workspaceId="ws-1"
        workspaceKey="VAU"
        drafts={[draft({ updatedAt: new Date(Date.now() - 3 * 60_000).toISOString() })]}
      />,
    );
    expect(screen.getByText("edited 3 minutes ago")).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("has no violations with drafts", async () => {
    const { container } = render(
      <DraftList workspaceId="ws-1" workspaceKey="VAU" drafts={[draft()]} />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
