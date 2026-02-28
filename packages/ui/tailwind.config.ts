import type { Config } from "tailwindcss";

/**
 * Shared Chronicle Labs Tailwind preset.
 * Import in each app's tailwind.config.ts via:
 *   presets: [require("ui/tailwind.config")]
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        void: "#050607",
        base: "#0a0c0f",
        surface: "#0f1215",
        elevated: "#141719",
        hover: "#1a1d21",
        active: "#1f2328",

        "border-dim": "#1a1d21",
        "border-default": "#252a30",
        "border-bright": "#353c45",

        primary: "#e8eaed",
        secondary: "#9aa0a6",
        tertiary: "#5f6368",
        disabled: "#3c4043",

        critical: {
          DEFAULT: "#ff3b3b",
          dim: "#661717",
          bg: "#1a0a0a",
        },
        caution: {
          DEFAULT: "#ffb800",
          dim: "#664a00",
          bg: "#1a1400",
        },
        nominal: {
          DEFAULT: "#00ff88",
          dim: "#006633",
          bg: "#001a0d",
        },
        data: {
          DEFAULT: "#00d4ff",
          dim: "#005566",
          bg: "#001419",
        },
      },

      fontFamily: {
        mono: ["IBM Plex Mono", "Consolas", "Monaco", "monospace"],
        sans: [
          "Helvetica Neue LT Pro",
          "Helvetica Neue",
          "Helvetica",
          "-apple-system",
          "system-ui",
          "sans-serif",
        ],
      },

      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.08em" }],
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["12px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "22px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["28px", { lineHeight: "36px" }],
        metric: ["32px", { lineHeight: "1", letterSpacing: "-0.02em" }],
      },

      letterSpacing: {
        tighter: "-0.02em",
        tight: "-0.01em",
        normal: "0",
        wide: "0.02em",
        wider: "0.05em",
        widest: "0.1em",
        tactical: "0.08em",
      },

      spacing: {
        sidebar: "240px",
        header: "48px",
      },

      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "6px",
      },

      boxShadow: {
        "glow-critical": "0 0 8px #ff3b3b",
        "glow-caution": "0 0 8px #ffb800",
        "glow-nominal": "0 0 8px #00ff88",
        "glow-data": "0 0 8px #00d4ff",
      },

      transitionDuration: {
        instant: "50ms",
        fast: "100ms",
        base: "150ms",
      },

      animation: {
        "pulse-slow": "pulse 2s ease-in-out infinite",
      },

      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
};

export default preset;
