import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Two projects, because the suites have genuinely different needs.
 *
 * The domain and text cores are pure and run in Node — no DOM, no setup file,
 * nothing to tear down between tests. Widening that project to jsdom to
 * accommodate the component tests would make 141 fast tests pay for a browser
 * environment none of them use.
 */
export default defineConfig({
  resolve: {
    // Mirror the `@/*` -> project root alias from tsconfig so tests import the
    // same way the app does.
    alias: { "@": root },
  },
  test: {
    projects: [
      {
        resolve: { alias: { "@": root } },
        test: {
          name: "domain",
          environment: "node",
          include: ["lib/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: { "@": root } },
        test: {
          name: "ui",
          environment: "jsdom",
          setupFiles: ["./test/setup.ts"],
          include: ["{lib,components}/**/*.test.tsx"],
        },
      },
    ],
  },
});
