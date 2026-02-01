import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* === TACTICAL COLOR SYSTEM === */
      colors: {
        // Base palette - near-black foundation
        void: "#050607",
        base: "#0a0c0f",
        surface: "#0f1215",
        elevated: "#141719",
        hover: "#1a1d21",
        active: "#1f2328",
        
        // Borders
        "border-dim": "#1a1d21",
        "border-default": "#252a30",
        "border-bright": "#353c45",
        
        // Text hierarchy
        primary: "#e8eaed",
        secondary: "#9aa0a6",
        tertiary: "#5f6368",
        disabled: "#3c4043",
        
        // SEMANTIC COLORS - The only colors allowed
        // Critical / Threat - RED
        critical: {
          DEFAULT: "#ff3b3b",
          dim: "#661717",
          bg: "#1a0a0a",
        },
        // Caution / Attention - AMBER
        caution: {
          DEFAULT: "#ffb800",
          dim: "#664a00",
          bg: "#1a1400",
        },
        // Nominal / Success - GREEN
        nominal: {
          DEFAULT: "#00ff88",
          dim: "#006633",
          bg: "#001a0d",
        },
        // Data / Informational - CYAN
        data: {
          DEFAULT: "#00d4ff",
          dim: "#005566",
          bg: "#001419",
        },
      },
      
      /* === TYPOGRAPHY === */
      fontFamily: {
        mono: ["IBM Plex Mono", "Consolas", "Monaco", "monospace"],
        sans: ["Helvetica Neue LT Pro", "Helvetica Neue", "Helvetica", "-apple-system", "system-ui", "sans-serif"],
      },
      
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.08em" }],
        "xs": ["11px", { lineHeight: "16px" }],
        "sm": ["12px", { lineHeight: "18px" }],
        "base": ["14px", { lineHeight: "22px" }],
        "lg": ["16px", { lineHeight: "24px" }],
        "xl": ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["28px", { lineHeight: "36px" }],
        "metric": ["32px", { lineHeight: "1", letterSpacing: "-0.02em" }],
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
      
      /* === SPACING === */
      spacing: {
        "sidebar": "240px",
        "header": "48px",
      },
      
      /* === BORDERS === */
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "6px",
      },
      
      /* === SHADOWS - Minimal, functional === */
      boxShadow: {
        "glow-critical": "0 0 8px #ff3b3b",
        "glow-caution": "0 0 8px #ffb800",
        "glow-nominal": "0 0 8px #00ff88",
        "glow-data": "0 0 8px #00d4ff",
      },
      
      /* === TRANSITIONS - Fast, deterministic === */
      transitionDuration: {
        "instant": "50ms",
        "fast": "100ms",
        "base": "150ms",
      },
      
      /* === ANIMATIONS === */
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
  plugins: [],
};

export default config;
