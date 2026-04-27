import { addons } from "@storybook/manager-api";
import { create } from "@storybook/theming";

addons.setConfig({
  theme: create({
    base: "dark",
    brandTitle: "Chronicle Labs",
    brandImage: "/logo-wordmark-dark.svg",
    brandUrl: "/",
    colorPrimary: "#d8430a",
    colorSecondary: "#709188",
    appBg: "#0a0806",
    appContentBg: "#0f0f0f",
    appBorderColor: "rgba(255,255,255,0.06)",
    appBorderRadius: 6,
    textColor: "#eaeaea",
    textInverseColor: "#040404",
    barTextColor: "#bfbfbf",
    barSelectedColor: "#d8430a",
    barBg: "#0f0f0f",
    fontBase: '"TWK Lausanne", "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontCode: '"Geist Mono", ui-monospace, Menlo, monospace',
  }),
});
