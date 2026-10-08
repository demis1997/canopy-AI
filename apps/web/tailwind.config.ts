import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: "#161816",
        pine: "#2F3D34",
        forest: "#4E5F50",
        leaf: "#6B8F6E",
        brass: "#C4A056",
        bone: "#EBE5D9",
        bark: "#2A332C",
        mist: "#8B9088",
        sunfleck: "#C6E26B",
        clay: "#B45A3C",
        canopy: {
          50: "#EBE5D9",
          100: "#d7e0d6",
          200: "#c4d0c4",
          300: "#8B9088",
          400: "#6B8F6E",
          500: "#6B8F6E",
          600: "#4E5F50",
          900: "#2F3D34",
        },
        ink: {
          950: "#0E100F",
          900: "#121512",
          800: "#1a1f1b",
          700: "#2A332C",
        },
        teal: {
          50: "#e8eee8",
          100: "#d4ddd4",
          200: "#b8c8b8",
          400: "#6B8F6E",
          500: "#6B8F6E",
          600: "#4E5F50",
          700: "#2F3D34",
          800: "#2F3D34",
          900: "#161816",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Helvetica Neue", "Arial", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(235,229,217,0.04), 0 12px 32px rgba(0,0,0,0.32)",
      },
      borderRadius: {
        xl: "12px",
      },
    },
  },
  plugins: [animate],
};

export default config;
