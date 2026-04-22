import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["apps/frontend/**/*.{js,jsx,ts,tsx}", "apps/env-manager/**/*.{js,jsx,ts,tsx}"],
    settings: {
      next: {
        rootDir: ["apps/frontend", "apps/env-manager"],
      },
    },
    languageOptions: {
      globals: {
        React: "readonly",
        JSX: "readonly",
        RequestInit: "readonly",
        HeadersInit: "readonly",
      },
    },
  },
  prettier,
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/build/**",
    "**/out/**",
    "**/next-env.d.ts",
    "**/backend/**",
    "**/storybook-static/**",
  ]),
]);

export default eslintConfig;
