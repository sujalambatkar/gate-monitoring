import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "#0d0d14",
        surface: "#13131f",
        border:  "#1e1e30",
        accent:  "#6c63ff",
        "accent-light": "#8b84ff",
        muted:   "#4a4a6a",
        danger:  "#ef4444",
        warn:    "#f59e0b",
        ok:      "#22c55e",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
