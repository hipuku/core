import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

/**
 * Shared setup for the jsdom project.
 *
 * Every hook here exists because leaving it out makes tests pass or fail based
 * on what ran before them, which is worse than having no tests at all.
 */

afterEach(() => {
  // React Testing Library does not unmount between tests on its own when
  // globals are off, and a left-behind tree makes `getByRole` ambiguous.
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  // Drafts are keyed per document, but a leaked entry from a previous test
  // would still be offered for recovery in the next one.
  window.localStorage.clear();
});
