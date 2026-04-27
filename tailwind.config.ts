import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#fcf9f8",
        "surface-bright": "#fcf9f8",
        surface: "#fcf9f8",
        "surface-dim": "#dcd9d9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f6f3f2",
        "surface-container": "#f0eded",
        "surface-container-high": "#eae7e7",
        "surface-container-highest": "#e5e2e1",
        "surface-variant": "#e5e2e1",
        "on-background": "#1c1b1b",
        "on-surface": "#1c1b1b",
        "on-surface-variant": "#3d4a42",
        primary: "#006948",
        secondary: "#006a61",
        tertiary: "#8d4b00",
        "primary-container": "#00855d",
        "secondary-container": "#86f2e4",
        "tertiary-container": "#b15f00",
        "primary-fixed": "#85f8c4",
        "primary-fixed-dim": "#68dba9",
        "secondary-fixed": "#89f5e7",
        "secondary-fixed-dim": "#6bd8cb",
        "outline-variant": "#bccac0",
        outline: "#6d7a72"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "sans-serif"]
      },
      fontSize: {
        "display-xl": ["42px", { lineHeight: "50px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["28px", { lineHeight: "36px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["22px", { lineHeight: "30px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "label-sm": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "500" }]
      },
      spacing: {
        gutter: "24px",
        "stack-xs": "8px",
        "stack-md": "24px",
        "stack-lg": "48px"
      },
      boxShadow: {
        soft: "0 4px 24px rgba(0, 0, 0, 0.04)",
        ambient: "0 12px 40px rgba(0, 0, 0, 0.08)"
      },
      borderRadius: {
        shell: "32px"
      },
      maxWidth: {
        shell: "1280px"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.65", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.06)" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
