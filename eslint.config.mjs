import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Retired files staged for deletion.
    "_to_delete/**",
  ]),
  {
    // Tests render raw `<a>` elements deliberately: the unsaved-navigation
    // guard exists to intercept ordinary anchor clicks, and swapping them for
    // `<Link>` would test next/link rather than the guard.
    files: ["**/*.test.tsx"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
]);

export default eslintConfig;
