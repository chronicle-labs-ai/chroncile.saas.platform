import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";
import prettier from "eslint-config-prettier/flat";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["apps/frontend/**/*.{js,jsx,ts,tsx}", "apps/env-manager/**/*.{js,jsx,ts,tsx}"],
    settings: {
      next: {
        rootDir: ["apps/frontend", "apps/env-manager"],
      },
    },
  },
  prettier,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/out/**",
      "**/next-env.d.ts",
      "**/backend/**",
    ],
  },
];

export default eslintConfig;
