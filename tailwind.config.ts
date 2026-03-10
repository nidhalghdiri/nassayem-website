import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        english: ["var(--font-inter)", "sans-serif"],
        arabic: ["var(--font-tajawal)", "sans-serif"],
      },
      colors: {
        nassayem: {
          DEFAULT: "#2a7475",
          light: "#3b9293",
          dark: "#1d5455",
        },
      },
    },
  },
  plugins: [],
};
export default config;
