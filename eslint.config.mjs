import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override and extend ignores
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Legacy/backup/demo files not part of production code
    "**/*-old.*",
    "**/*-broken.*",
    "**/*-corrupted.*",
    // Utilities not meant for linting against TS rules
    "database/**",
    "server.js",
    // Debug APIs and session logs
    "app/api/debug/**",
    "session-logs/**",
  ]),
  // Project-specific rule tuning to keep CI signal high and actionable
  {
    rules: {
      // Allow pragmatic use of any in DB helpers and API surfaces
      "@typescript-eslint/no-explicit-any": "off",
      // Ignore underscore-prefixed variables that are intentionally unused
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      // Permit calling const fns inside effects without reordering code
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": "off",
      // Allow apostrophes/quotes inside JSX text content
      "react/no-unescaped-entities": "off",
      // Keep as informational only
      "prefer-const": "warn",
    },
  },
  // JS runtime scripts may use require()
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
