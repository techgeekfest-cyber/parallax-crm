import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // ADR 0004: production code reads data only from the API. Mocks and fixtures may exist in test/ and e2e/ only.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["msw", "msw/*", "**/mocks/**", "**/__mocks__/**", "**/fixtures/**", "**/test/**", "**/e2e/**"],
              message: "Application code must not import mocks, fixtures or test helpers (ADR 0004).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
