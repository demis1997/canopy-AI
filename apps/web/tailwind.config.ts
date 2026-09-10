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
          950: "#080c12",
          900: "#0c1218",
          800: "#121a24",
          700: "#1b2532",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.04), 0 12px 32px rgba(0,0,0,0.28)",
      },
      borderRadius: {
        xl: "12px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
