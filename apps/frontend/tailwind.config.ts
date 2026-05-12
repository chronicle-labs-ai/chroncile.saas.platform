import type { Config } from "tailwindcss";
import uiPreset from "ui/tailwind.config";

const config: Config = {
  presets: [uiPreset as Config],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./server/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
