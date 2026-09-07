import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canopy: {
          50: "#edfdf8",
          100: "#d1faf0",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0f766e",
          900: "#134e4a",
        },
        ink: {
          950: "#0b0f10",
          900: "#111618",
          800: "#171e21",
          700: "#222b30",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(255,255,255,0.04), 0 20px 50px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
