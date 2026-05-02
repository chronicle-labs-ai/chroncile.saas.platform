import type { Preview, Decorator } from "@storybook/react";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import * as React from "react";

import { ThemeProvider } from "../src/theme/theme-provider";
import { UIProviders } from "../src/providers/ui-providers";
import { Toaster } from "../src/primitives/sonner";
// Order matters: Tailwind preflight first, then our tokens/fonts/base so
// they win the cascade against `@tailwind base`'s resets.
import "./preview.css";
import "../src/styles/globals.css";

const withProvider: Decorator = (Story) => (
  // Wrap every story in UIProviders (RAC I18n) + ThemeProvider. No
  // RouterProvider in stories — navigate is only wired inside apps.
  // ThemeProvider's attachToRoot={false} keeps the <html data-theme>
  // attribute driven by the addon-themes decorator below.
  // <Toaster /> mounts the sonner host once so any story can just call
  // `toast(...)` without scaffolding (see "Primitives/Sonner").
  <UIProviders>
    <ThemeProvider attachToRoot={false} toggleShortcut={null}>
      <div className="min-h-screen p-s-6 bg-page text-ink">
        <Story />
      </div>
      <Toaster />
    </ThemeProvider>
  </UIProviders>
);

const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: [
          "Introduction",
          "Foundations",
          [
            "Colors",
            "Typography",
            "Spacing",
            "Motion",
            "Gradients & Glass",
            "Density",
          ],
          "Brand",
          "Typography",
          "Surfaces",
          "Primitives",
          "Icons",
          "Layout",
          "Auth",
          "Onboarding",
          "Connections",
          "Connectors",
          "Datasets",
          "Agents",
          "Backtests",
          "Stream Timeline",
          "Env Manager",
          "Product",
          "Admin",
        ],
      },
    },
  },
  decorators: [
    withProvider,
    withThemeByDataAttribute({
      themes: { dark: "dark", light: "light" },
      defaultTheme: "dark",
      attributeName: "data-theme",
    }),
  ],
  tags: ["autodocs"],
};

export default preview;
