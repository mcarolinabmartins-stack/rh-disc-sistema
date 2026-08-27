import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F2F1FA",
          100: "#E4E2F4",
          300: "#B7B2E8",
          500: "#6F67B8",
          600: "#524B8F",
          700: "#37324E",
          900: "#211F27",
        },
        disc: {
          d: "#C1442A",
          dSoft: "#F6E3DD",
          i: "#C8901A",
          iSoft: "#F6EAD3",
          s: "#3E7D56",
          sSoft: "#DEEBE2",
          c: "#2E5F8A",
          cSoft: "#DCE6EE",
        },
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Public Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
