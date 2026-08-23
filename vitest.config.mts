import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the `@/*` -> project root alias from tsconfig so tests import the same
    // way the app does.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // The versioning and decision cores are pure and run in Node. UI/component tests,
    // when they arrive, will get their own jsdom project rather than widening this.
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
