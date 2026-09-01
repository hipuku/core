import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

/**
 * Shared setup for the jsdom project.
 *
 * Every hook here exists because leaving it out makes tests pass or fail based
 * on what ran before them, which is worse than having no tests at all.
 */

// jsdom implements no layout, so it ships no scrollIntoView at all. Anything
// keeping a highlighted row in view calls it, and without this the component
// throws in tests over a method that cannot fail in a browser.
Element.prototype.scrollIntoView = vi.fn();

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
