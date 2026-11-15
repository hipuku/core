import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Mermaid } from "./Mermaid";

/**
 * A diagram that fails to render falls back to its source. The part worth
 * testing is what happens next: when the source changes and renders, the
 * diagram has to come back rather than stay on the fallback.
 */

const renderChart = vi.fn();
vi.mock("mermaid", () => ({
  default: { initialize: vi.fn(), render: (id: string, chart: string) => renderChart(id, chart) },
}));

describe("Mermaid", () => {
  it("falls back to the source on failure, and recovers when the source changes", async () => {
    renderChart.mockRejectedValueOnce(new Error("parse error"));
    const { rerender, container } = render(<Mermaid chart="graph TD; A--" />);

    await waitFor(() => expect(screen.getByText("graph TD; A--")).toBeInTheDocument());

    renderChart.mockResolvedValueOnce({ svg: '<svg data-testid="diagram"></svg>' });
    rerender(<Mermaid chart="graph TD; A-->B" />);

    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
    expect(screen.queryByText("graph TD; A--")).toBeNull();
  });
});
