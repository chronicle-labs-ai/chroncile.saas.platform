import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Chronicle Labs shared Tailwind preset.
 *
 * Every token is wired to a CSS variable declared in `src/styles/tokens.css`
 * so utilities pick up the active `data-theme` automatically and a single
 * source of truth stays in CSS. The token namespace is unified — the
 * legacy `--c-*` aliases now resolve to Linear's "Midnight Command Center"
 * surface stack, and the `--l-*` namespace has been retired.
 *
 * The `l.*` utility shortcuts (e.g. `bg-l-wash-3`, `text-l-ink-lo`) are
 * kept as alias utilities pointing at the unified `--c-*` tokens so that
 * existing `cva()` strings keep compiling — they just produce the same
 * pixels as the regular `bg-wash-3` / `text-ink-lo` utilities.
 *
 * This file plays two roles:
 *   1. As a Tailwind *preset* for apps — they do
 *        presets: [require("ui/tailwind.config")]
 *      and add their own `content` globs.
 *   2. As a Tailwind *config* for Storybook — it points `content` at this
 *      package's own sources via an absolute path so Tailwind generates
 *      every utility the design-system components use.
 *
 * App Tailwind configs' `content` is merged with the preset's, so having
 * absolute paths here is harmless for apps and necessary for Storybook.
 */
const preset: Config = {
  content: [
    path.join(here, "src/**/*.{ts,tsx,mdx}"),
    path.join(here, ".storybook/**/*.{ts,tsx,mdx}"),
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        void: "var(--c-void)",
        black: "var(--c-black)",
        page: "var(--c-page)",

        surface: {
          DEFAULT: "var(--c-surface-01)",
          "00": "var(--c-surface-00)",
          "01": "var(--c-surface-01)",
          "02": "var(--c-surface-02)",
          "03": "var(--c-surface-03)",
          input: "var(--c-surface-input)",
        },

        hairline: {
          DEFAULT: "var(--c-hairline)",
          strong: "var(--c-hairline-strong)",
        },
        divider: "var(--c-divider)",

        ink: {
          DEFAULT: "var(--c-ink)",
          hi: "var(--c-ink-hi)",
          lo: "var(--c-ink-lo)",
          dim: "var(--c-ink-dim)",
          faint: "var(--c-ink-faint)",
          inv: {
            DEFAULT: "var(--c-ink-inv)",
            hi: "var(--c-ink-inv-hi)",
            lo: "var(--c-ink-inv-lo)",
            dim: "var(--c-ink-inv-dim)",
          },
        },

        wash: {
          "1": "var(--c-wash-1)",
          "2": "var(--c-wash-2)",
          "3": "var(--c-wash-3)",
          "5": "var(--c-wash-5)",
        },

        // Primary action color (Chronicle signal). Stays as ember.
        ember: {
          DEFAULT: "var(--c-ember)",
          deep: "var(--c-ember-deep)",
        },
        // Aux brand accents — kept for the glass-scene recipes and a
        // handful of marketing surfaces. Not part of the day-to-day
        // product palette.
        sage: {
          DEFAULT: "var(--c-sage)",
          deep: "var(--c-sage-deep)",
        },
        gold: {
          DEFAULT: "var(--c-gold)",
          deep: "var(--c-gold-deep)",
        },
        bronze: "var(--c-bronze)",
        bone: "var(--c-bone)",

        // Linear "Midnight Command Center" — named utilities. Use
        // `bg-pitch-black`, `text-porcelain`, `border-charcoal-grey`,
        // `text-storm-cloud`, `bg-neon-lime`, etc. directly when you
        // want a specific Linear hex. Alongside the semantic
        // `surface-*` / `ink-*` utilities (which already point at
        // these values).
        "pitch-black": "var(--color-pitch-black)",
        graphite: "var(--color-graphite)",
        "deep-slate": "var(--color-deep-slate)",
        "charcoal-grey": "var(--color-charcoal-grey)",
        "muted-ash": "var(--color-muted-ash)",
        gunmetal: "var(--color-gunmetal)",
        porcelain: "var(--color-porcelain)",
        "light-steel": "var(--color-light-steel)",
        "storm-cloud": "var(--color-storm-cloud)",
        "fog-grey": "var(--color-fog-grey)",
        alabaster: "var(--color-alabaster)",
        "neon-lime": "var(--color-neon-lime)",
        "aether-blue": "var(--color-aether-blue)",
        "forest-green": "var(--color-forest-green)",
        "cyan-spark": "var(--color-cyan-spark)",
        emerald: "var(--color-emerald)",
        "warning-red": "var(--color-warning-red)",
        "deep-violet": "var(--color-deep-violet)",
        amethyst: "var(--color-amethyst)",

        event: {
          teal: "var(--c-event-teal)",
          amber: "var(--c-event-amber)",
          green: "var(--c-event-green)",
          orange: "var(--c-event-orange)",
          pink: "var(--c-event-pink)",
          violet: "var(--c-event-violet)",
          red: "var(--c-event-red)",
          white: "var(--c-event-white)",
        },

        row: {
          hover: "var(--c-row-hover)",
          active: "var(--c-row-active)",
          selected: "var(--c-row-selected)",
        },

        // ── Legacy `l-*` alias namespace — DEPRECATED ──
        // The Linear-density layer has been merged into the unified
        // `--c-*` tokens. These shortcuts stay so the dozens of
        // existing `bg-l-wash-3` / `text-l-ink` / `border-l-border`
        // strings inside `cva()` definitions keep compiling. Each
        // points at its unified equivalent.
        //
        // Do NOT add new utilities under this namespace. New product
        // UI should use `bg-surface-01`, `text-ink-hi`,
        // `border-hairline-strong`, `bg-card`, `text-card-foreground`
        // (shadcn semantic) directly. This tree is scheduled for
        // removal once first-party `cva()` strings have been migrated;
        // see the deprecation banner in `src/styles/tokens.css`.
        l: {
          surface: "var(--c-surface-00)",
          "surface-raised": "var(--c-surface-01)",
          "surface-raised-2": "var(--c-surface-02)",
          "surface-input": "var(--c-surface-input)",
          "surface-bar": "var(--c-surface-00)",
          "surface-bar-2": "var(--c-surface-00)",
          "surface-hover": "var(--c-row-hover)",
          "surface-selected": "var(--c-row-selected)",
          "wash-1": "var(--c-wash-1)",
          "wash-2": "var(--c-wash-2)",
          "wash-3": "var(--c-wash-3)",
          "wash-5": "var(--c-wash-5)",
          ink: "var(--c-ink-hi)",
          "ink-lo": "var(--c-ink-lo)",
          "ink-dim": "var(--c-ink-dim)",
          border: "var(--c-hairline-strong)",
          "border-strong": "var(--c-hairline-strong)",
          "border-hover": "var(--c-ink-dim)",
          "border-faint": "var(--c-hairline)",
          "p-urgent": "var(--c-priority-urgent)",
          "p-high": "var(--c-priority-high)",
          "p-med": "var(--c-priority-med)",
          "p-low": "var(--c-priority-low)",
          "p-none": "var(--c-priority-none)",
          "status-backlog": "var(--c-status-backlog)",
          "status-todo": "var(--c-status-todo)",
          "status-inprogress": "var(--c-status-inprogress)",
          "status-done": "var(--c-status-done)",
          "status-canceled": "var(--c-status-canceled)",
        },

        priority: {
          urgent: "var(--c-priority-urgent)",
          high: "var(--c-priority-high)",
          med: "var(--c-priority-med)",
          low: "var(--c-priority-low)",
          none: "var(--c-priority-none)",
        },
        status: {
          backlog: "var(--c-status-backlog)",
          todo: "var(--c-status-todo)",
          inprogress: "var(--c-status-inprogress)",
          done: "var(--c-status-done)",
          canceled: "var(--c-status-canceled)",
        },

        // Legacy aliases — kept so older variant names in consumer code
        // don't 500 during the migration. Map to the closest new token.
        critical: "var(--c-event-red)",
        caution: "var(--c-event-amber)",
        nominal: "var(--c-event-green)",
        data: "var(--c-event-teal)",
        tertiary: "var(--c-ink-dim)",
        disabled: "var(--c-ink-faint)",
        elevated: "var(--c-surface-02)",
        hover: "var(--c-surface-03)",
        active: "var(--c-surface-03)",
        base: "var(--c-surface-00)",
        "border-dim": "var(--c-hairline)",
        "border-default": "var(--c-hairline-strong)",
        "border-bright": "var(--c-ink-dim)",
      },

      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },

      fontSize: {
        "display-xxl": ["var(--fs-display-xxl)", { lineHeight: "0.94" }],
        "display-xl": ["var(--fs-display-xl)", { lineHeight: "0.96" }],
        "display-lg": ["var(--fs-display-lg)", { lineHeight: "1" }],
        "display-md": ["var(--fs-display-md)", { lineHeight: "1" }],
        "display-sm": ["var(--fs-display-sm)", { lineHeight: "1.05" }],
        "title-lg": ["var(--fs-title-lg)", { lineHeight: "1.15" }],
        title: ["var(--fs-title)", { lineHeight: "1.2" }],
        "title-sm": ["var(--fs-title-sm)", { lineHeight: "1.3" }],
        "body-lg": ["var(--fs-body-lg)", { lineHeight: "1.5" }],
        body: ["var(--fs-body)", { lineHeight: "1.5" }],
        "body-sm": ["var(--fs-body-sm)", { lineHeight: "1.5" }],
        micro: ["var(--fs-micro)", { lineHeight: "1.4" }],
        "mono-lg": ["var(--fs-mono-lg)", { lineHeight: "1.5" }],
        mono: ["var(--fs-mono)", { lineHeight: "1.5" }],
        "mono-sm": ["var(--fs-mono-sm)", { lineHeight: "1.5" }],
        "mono-xs": ["var(--fs-mono-xs)", { lineHeight: "1.5" }],
        // Linear semantic roles — preferred for new product UI.
        caption: ["var(--text-caption)", { lineHeight: "var(--leading-caption)", letterSpacing: "var(--tracking-caption)" }],
        heading: ["var(--text-heading)", { lineHeight: "var(--leading-heading)", letterSpacing: "var(--tracking-heading)" }],
        "heading-lg": ["var(--text-heading-lg)", { lineHeight: "var(--leading-heading-lg)", letterSpacing: "var(--tracking-heading-lg)" }],
        display: ["var(--text-display)", { lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)" }],
      },

      fontWeight: {
        // Linear Inter axis values — `font-w510`, `font-w590`.
        w510: "var(--font-weight-w510)",
        w590: "var(--font-weight-w590)",
      },

      letterSpacing: {
        tight: "-0.02em",
        display: "-0.025em",
        normal: "0",
        mono: "0.02em",
        tactical: "0.08em",
        eyebrow: "0.1em",
      },

      spacing: {
        "s-1": "var(--s-1)",
        "s-2": "var(--s-2)",
        "s-3": "var(--s-3)",
        "s-4": "var(--s-4)",
        "s-5": "var(--s-5)",
        "s-6": "var(--s-6)",
        "s-8": "var(--s-8)",
        "s-10": "var(--s-10)",
        "s-12": "var(--s-12)",
        "s-16": "var(--s-16)",
        "s-20": "var(--s-20)",
        // Density rhythm utilities — `h-row`, `h-row-sm`, `h-input`, `h-input-md`.
        row: "var(--density-row-h)",
        "row-sm": "var(--density-row-h-sm)",
        "input-h": "var(--density-input-h)",
        "input-h-md": "var(--density-input-h-md)",
        // Legacy `h-l-row` / `h-l-input` aliases — kept compiling.
        "l-row": "var(--density-row-h)",
        "l-row-sm": "var(--density-row-h-sm)",
        "l-input": "var(--density-input-h)",
        "l-input-md": "var(--density-input-h-md)",
      },

      borderRadius: {
        none: "0",
        DEFAULT: "var(--radius)",
        xs: "var(--r-xs)",
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        pill: "var(--r-pill)",
        // Linear named roles — `rounded-tags`, `rounded-cards`, …
        tags: "var(--radius-tags)",
        cards: "var(--radius-cards)",
        badges: "var(--radius-badges)",
        inputs: "var(--radius-inputs)",
        buttons: "var(--radius-buttons)",
        // Note: `rounded-l` and `rounded-l-sm` aliases were retired
        // because they collided with Tailwind's built-in side
        // modifier (`rounded-l-{size}` = left-side only). Use
        // `rounded-md` / `rounded-xs` (or the named Linear roles
        // above) instead.
      },

      boxShadow: {
        card: "var(--shadow-card)",
        panel: "var(--shadow-panel)",
        "glow-ember": "var(--shadow-glow-ember)",
        // Linear shadows
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        subtle: "var(--shadow-subtle)",
        "subtle-2": "var(--shadow-subtle-2)",
        "subtle-3": "var(--shadow-subtle-3)",
        xl: "var(--shadow-xl)",
        "subtle-4": "var(--shadow-subtle-4)",
        "subtle-5": "var(--shadow-subtle-5)",
        "subtle-6": "var(--shadow-subtle-6)",
        // Popover — `shadow-pop`. Legacy `shadow-l-pop` aliased.
        pop: "var(--c-pop-shadow)",
        "l-pop": "var(--c-pop-shadow)",
      },

      backgroundImage: {
        lightsource: "var(--grad-lightsource)",
        "lightsource-90": "var(--grad-lightsource-90)",
        "lightsource-45": "var(--grad-lightsource-45)",
      },

      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },

      transitionDuration: {
        fast: "var(--dur-fast)",
        DEFAULT: "var(--dur)",
        slow: "var(--dur-slow)",
        enter: "var(--dur-enter)",
        exit: "var(--dur-exit)",
      },

      zIndex: {
        // Mirror of the `--z-*` token scale in tokens.css.
        base: "var(--z-base)",
        raised: "var(--z-raised)",
        sticky: "var(--z-sticky)",
        overlay: "var(--z-overlay)",
        modal: "var(--z-modal)",
        popover: "var(--z-popover)",
        tooltip: "var(--z-tooltip)",
        toast: "var(--z-toast)",
      },

      animation: {
        "chron-pulse": "chron-pulse 1.6s ease-in-out infinite",
      },

      keyframes: {
        "chron-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [animate],
  /*
   * `hoverOnlyWhenSupported` rewrites every `hover:` utility to be wrapped
   * in `@media (hover: hover) and (pointer: fine)`. Without it, every
   * `hover:bg-…` on a row/card/chip "sticks" highlighted after a tap on
   * iOS/iPadOS because Mobile Safari fires `:hover` on tap. See Emil's
   * touch-accessibility rules — hover is an enhancement, not a primary
   * affordance, and must not double as a tap-feedback surface.
   */
  future: {
    hoverOnlyWhenSupported: true,
  },
};

export default preset;
