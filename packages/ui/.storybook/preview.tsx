import type { Preview, Decorator } from "@storybook/react";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import * as React from "react";

import { ThemeProvider } from "../src/theme/theme-provider";
import { ChromeStyleProvider } from "../src/theme/chrome-style-context";
import type { ChromeStyle } from "../src/theme/chrome-style-context";
import { UIProviders } from "../src/providers/ui-providers";
// Order matters: Tailwind preflight first, then our tokens/fonts/base so
// they win the cascade against `@tailwind base`'s resets.
import "./preview.css";
import "../src/styles/globals.css";

const withProvider: Decorator = (Story) => (
  // Wrap every story in UIProviders (RAC I18n) + ThemeProvider. No
  // RouterProvider in stories — navigate is only wired inside apps.
  // ThemeProvider's attachToRoot={false} keeps the <html data-theme>
  // attribute driven by the addon-themes decorator below.
  <UIProviders>
    <ThemeProvider attachToRoot={false} toggleShortcut={null}>
      <div className="min-h-screen p-s-6 bg-page text-ink">
        <Story />
      </div>
    </ThemeProvider>
  </UIProviders>
);

/**
 * Global `data-chrome` toggle: brand (`--c-*` editorial) vs product
 * (`--l-*` Linear-density). Drives the CSS remap in `chrome.css` AND
 * feeds `<ChromeStyleProvider>` so primitives that read context for
 * their `density` (Button, Input, …) flip in step. Stories that
 * accept their own `chromeStyle` prop (e.g. `AuthShell`) can override
 * the global; that local value wins because it sets `data-chrome`
 * on a deeper element in the cascade.
 */
const withChromeAttribute: Decorator = (Story, context) => {
  const chrome = (context.globals.chrome ?? "brand") as ChromeStyle;

  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-chrome", chrome);
    return () => {
      root.removeAttribute("data-chrome");
    };
  }, [chrome]);

  return (
    <ChromeStyleProvider value={chrome}>
      <Story />
    </ChromeStyleProvider>
  );
};

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
          "Primitives",
          "Typography",
          "Surfaces",
          "Product",
          "Layout",
          "Templates",
        ],
      },
    },
  },
  decorators: [
    withProvider,
    withChromeAttribute,
    withThemeByDataAttribute({
      themes: { dark: "dark", light: "light" },
      defaultTheme: "dark",
      attributeName: "data-theme",
    }),
  ],
  tags: ["autodocs"],
};

/**
 * Top-level globals export — Storybook reads `globalTypes` from a
 * named export at the preview-file root and renders the toolbar
 * from it. (Nesting under the default `Preview` config is silently
 * ignored in 8.x for the toolbar, so keep this here.)
 */
export const globalTypes = {
  chrome: {
    name: "Chrome",
    description: "Brand (editorial) vs Product (Linear-density) chrome",
    defaultValue: "brand",
    toolbar: {
      title: "Chrome",
      icon: "mirror",
      items: [
        { value: "brand", title: "Brand", right: "--c-*" },
        { value: "product", title: "Product", right: "--l-*" },
      ],
      dynamicTitle: true,
    },
  },
};

export default preview;
