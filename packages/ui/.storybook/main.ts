import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: [
    {
      from: "../src/assets",
      to: "/",
    },
  ],
  stories: [
    "../src/stories/**/*.mdx",
    "../src/stories/**/*.stories.@(ts|tsx)",
    "../src/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-essentials", "@storybook/addon-themes"],
  docs: {
    autodocs: "tag",
  },
  typescript: {
    check: false,
    reactDocgen: "react-docgen-typescript",
  },
  viteFinal: async (viteConfig) => {
    // Point PostCSS / Tailwind at the package-local configs so utility
    // class-names resolve against our preset in the Storybook build.
    viteConfig.css ??= {};
    viteConfig.css.postcss = path.resolve(dirname, "./postcss.config.cjs");
    return viteConfig;
  },
};

export default config;
