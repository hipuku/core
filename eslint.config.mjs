import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

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
    // The recommended accessibility set. eslint-config-next registers the
    // jsx-a11y plugin but turns on only a few of its rules; this turns on the rest.
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  {
    // An effect or callback that reads a value it does not list goes stale
    // silently, so a missing dependency fails rather than warns.
    rules: { "react-hooks/exhaustive-deps": "error" },
  },
  {
    // lib/ is the domain and its helpers. It does not reach up into pages,
    // server actions or components, so it can be tested in Node on its own.
    files: ["lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/components/*", "**/app/*", "**/components/*"],
              message: "lib/ does not import pages, server actions or components.",
            },
          ],
        },
      ],
      // no-restricted-imports reads static imports only; this catches import().
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^(@\\/(app|components)|(\\.\\.\\/)+(app|components))(\\/|$)/]",
          message: "lib/ does not import pages, server actions or components.",
        },
      ],
    },
  },
  {
    // The decision and versioning engines depend on their store ports. Only
    // the Drizzle stores touch the database (ARCHITECTURE.md, Storage is a port).
    files: ["lib/decisions/**/*.ts", "lib/versioning/**/*.ts"],
    ignores: ["**/drizzle-store.ts", "**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/db",
                "@/lib/db/*",
                "**/db",
                "**/db/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "postgres",
              ],
              message: "Go through the store port; only drizzle-store.ts touches the database.",
            },
            {
              group: ["@/app/*", "@/components/*", "**/app/*", "**/components/*"],
              message: "lib/ does not import pages, server actions or components.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^(@\\/lib\\/db|drizzle-orm|postgres|(\\.\\.\\/)+db)(\\/|$)/]",
          message: "Go through the store port; only drizzle-store.ts touches the database.",
        },
        {
          selector:
            "ImportExpression[source.value=/^(@\\/(app|components)|(\\.\\.\\/)+(app|components))(\\/|$)/]",
          message: "lib/ does not import pages, server actions or components.",
        },
      ],
    },
  },
  {
    // Tests render raw `<a>` elements deliberately: the unsaved-navigation
    // guard exists to intercept ordinary anchor clicks, and swapping them for
    // `<Link>` would test next/link rather than the guard.
    files: ["**/*.test.tsx"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
]);

export default eslintConfig;
