import type { Config } from "tailwindcss";

// Whimsical design system: cream "paper" base + a rotating set of soft pastels,
// organic shapes, characterful type. Playful but legible (light mode).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // paper + ink
        paper: { DEFAULT: "#FBF6EC", deep: "#F3E9D6", edge: "#EADDC4" },
        ink: { DEFAULT: "#3B322C", soft: "#857669", faint: "#B6A795" },
        // pastel accent families: each has a soft fill + a deeper ink for text/edges
        blush: { DEFAULT: "#F7C9D2", deep: "#D77A8E" },
        peach: { DEFAULT: "#FBD9B4", deep: "#E0964F" },
        butter: { DEFAULT: "#F7E6A0", deep: "#C9A52E" },
        mint: { DEFAULT: "#C2E6CD", deep: "#5FA87C" },
        sky: { DEFAULT: "#BFDCEC", deep: "#5C97BD" },
        lilac: { DEFAULT: "#D8CCEF", deep: "#8C76C9" },
        coral: { DEFAULT: "#F6AE96", deep: "#DC6A4B" },
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
        sticker: "0 6px 0 -2px rgba(59,50,44,0.10), 0 10px 20px -8px rgba(59,50,44,0.20)",
        lift: "0 12px 30px -12px rgba(59,50,44,0.30)",
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
        marquee: "marquee 22s linear infinite",
        wobble: "wobble 7s ease-in-out infinite",
        "spin-slow": "spin 16s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
