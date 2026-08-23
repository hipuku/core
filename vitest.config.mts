import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The versioning core is pure and runs in Node. UI/component tests, when they
    // arrive, will get their own jsdom project rather than widening this glob.
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
