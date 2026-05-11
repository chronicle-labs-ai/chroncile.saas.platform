import rootConfig from "../../eslint.config.mjs";

export default [
  ...rootConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        React: "readonly",
        JSX: "readonly",
        RequestInit: "readonly",
        HeadersInit: "readonly",
      },
    },
  },
];
