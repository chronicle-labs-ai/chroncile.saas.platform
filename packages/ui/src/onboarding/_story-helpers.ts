/*
 * Shared Storybook parameter presets for the Onboarding stories.
 *
 * Centralizing these keeps the stories themselves focused on
 * scenario data, and lets us tweak the mobile viewport / theme
 * defaults in one place if Storybook's addon defaults shift.
 */

/**
 * iPhone 14-class viewport (390x844). Used to surface the squish on
 * tile grids, plan cards, and the underline tab strip — the steps
 * render edge-to-edge thanks to `parameters.layout: "fullscreen"`
 * (paired with the matching decorator opt-out in `preview.tsx`).
 */
export const MOBILE_PARAMS = {
  viewport: {
    viewports: {
      mobile: {
        name: "Mobile · 390",
        styles: { width: "390px", height: "844px" },
        type: "mobile" as const,
      },
    },
    defaultViewport: "mobile",
  },
} as const;

/**
 * Force the addon-themes decorator to render the story in light
 * theme, regardless of the toolbar selection. Use on stories that
 * lock theme for autodocs so reviewers see both theme variants
 * without having to flip the toolbar manually.
 *
 * The `globals.theme` value must match a key defined in the
 * `withThemeByDataAttribute` setup in `.storybook/preview.tsx`.
 */
export const LIGHT_PARAMS = {
  globals: { theme: "light" },
} as const;
