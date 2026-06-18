import type { Config } from "tailwindcss";

// Slate-dark design system: near-black base + dark-tinted pastels + bright labels.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // paper = dark surfaces, ink = light text
        paper: { DEFAULT: "#1C1C1E", deep: "#2C2C2E", edge: "#3A3A3C" },
        ink: { DEFAULT: "#F0F0EE", soft: "#AEAEB2", faint: "#636366" },
        // Dark-tinted pastel surfaces (fill) + bright readable labels (deep).
        // Sync HEX values with pastels.ts.
        blush: { DEFAULT: "#4A2030", deep: "#F4B0C8" },
        peach: { DEFAULT: "#4A2818", deep: "#F4C0A0" },
        butter: { DEFAULT: "#3A3010", deep: "#F4DC80" },
        mint: { DEFAULT: "#0E3A3A", deep: "#78D8D8" },
        sky: { DEFAULT: "#0A2C3A", deep: "#68C8E0" },
        lilac: { DEFAULT: "#302810", deep: "#F4C868" },
        coral: { DEFAULT: "#4A2010", deep: "#F4A890" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        blob: "42% 58% 56% 44% / 50% 44% 56% 50%",
        blob2: "58% 42% 38% 62% / 44% 58% 42% 56%",
        squircle: "1.75rem",
      },
      boxShadow: {
        sticker: "0 6px 0 -2px rgba(0,0,0,0.4), 0 10px 20px -8px rgba(0,0,0,0.5)",
        lift: "0 12px 30px -12px rgba(0,0,0,0.5)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0) rotate(var(--tw-rotate,0))" },
          "50%": { transform: "translateY(-8px) rotate(var(--tw-rotate,0))" },
        },
        wiggle: {
          "0%,100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
        breathe: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        jiggle: {
          "0%,100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        wobble: {
          "0%,100%": { transform: "translateY(0) rotate(-1.5deg)" },
          "50%": { transform: "translateY(-10px) rotate(1.5deg)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        wiggle: "wiggle 0.4s ease-in-out",
        breathe: "breathe 4s ease-in-out infinite",
        pop: "pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        jiggle: "jiggle 2.4s ease-in-out infinite",
        marquee: "marquee 48s linear infinite",
        wobble: "wobble 7s ease-in-out infinite",
        "spin-slow": "spin 16s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
