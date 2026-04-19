import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Stitch StudEX Design System — Warm Industrial Palette
        "surface": "#fcf9f4",
        "surface-bright": "#fcf9f4",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f6f3ee",
        "surface-container": "#f0ede9",
        "surface-container-high": "#ebe8e3",
        "surface-container-highest": "#e5e2dd",
        "surface-dim": "#dcdad5",
        "surface-variant": "#e5e2dd",
        "background": "#fcf9f4",
        "on-surface": "#1c1c19",
        "on-surface-variant": "#514534",
        "on-background": "#1c1c19",
        "inverse-surface": "#31302d",
        "inverse-on-surface": "#f3f0eb",

        // Primary — Amber
        "primary": "#815500",
        "primary-fixed": "#ffddb2",
        "primary-fixed-dim": "#ffb94c",
        "primary-container": "#e8a020",
        "on-primary": "#ffffff",
        "on-primary-container": "#5b3b00",
        "on-primary-fixed": "#291800",
        "on-primary-fixed-variant": "#624000",
        "inverse-primary": "#ffb94c",

        // Secondary
        "secondary": "#5f5e5b",
        "secondary-fixed": "#e5e2dd",
        "secondary-fixed-dim": "#c8c6c2",
        "secondary-container": "#e2dfdb",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#63635f",
        "on-secondary-fixed": "#1c1c19",
        "on-secondary-fixed-variant": "#474743",

        // Tertiary — Terracotta (deals/alerts)
        "tertiary": "#ae310d",
        "tertiary-fixed": "#ffdbd2",
        "tertiary-fixed-dim": "#ffb4a1",
        "tertiary-container": "#ff9073",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#801c00",
        "on-tertiary-fixed": "#3c0800",
        "on-tertiary-fixed-variant": "#891f00",

        // Error
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        // Outline
        "outline": "#847562",
        "outline-variant": "#d6c4ae",

        // Surface tint
        "surface-tint": "#815500",

        // Deep charcoal (for dark sections)
        "charcoal": "#2D2D2A",
        "ink": "#1A1A18",
        "amber": "#E8A020",
        "terracotta": "#D94F2A",
        "muted": "#8A8880",
      },
      fontFamily: {
        headline: ["Syne", "Epilogue", "sans-serif"],
        body: ["DM Sans", "Manrope", "sans-serif"],
        mono: ["DM Mono", "Space Grotesk", "monospace"],
      },
      borderRadius: {
        DEFAULT: "1rem",
        lg: "2rem",
        xl: "3rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
