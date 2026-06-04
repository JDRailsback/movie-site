// Deterministic pastel assignment. Class strings are written out in full so
// Tailwind's content scanner keeps them (no dynamic class purging surprises).

export const PASTELS = ["blush", "peach", "butter", "mint", "sky", "lilac", "coral"] as const;
export type Pastel = (typeof PASTELS)[number];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pastelFor(key: string | number): Pastel {
  const i = typeof key === "number" ? Math.abs(Math.trunc(key)) : hash(key);
  return PASTELS[i % PASTELS.length];
}

export const BG: Record<Pastel, string> = {
  blush: "bg-blush",
  peach: "bg-peach",
  butter: "bg-butter",
  mint: "bg-mint",
  sky: "bg-sky",
  lilac: "bg-lilac",
  coral: "bg-coral",
};

export const TEXT_DEEP: Record<Pastel, string> = {
  blush: "text-blush-deep",
  peach: "text-peach-deep",
  butter: "text-butter-deep",
  mint: "text-mint-deep",
  sky: "text-sky-deep",
  lilac: "text-lilac-deep",
  coral: "text-coral-deep",
};

export const RING_DEEP: Record<Pastel, string> = {
  blush: "ring-blush-deep",
  peach: "ring-peach-deep",
  butter: "ring-butter-deep",
  mint: "ring-mint-deep",
  sky: "ring-sky-deep",
  lilac: "ring-lilac-deep",
  coral: "ring-coral-deep",
};

// Soft fill hex (for inline styles where a gradient/border is needed)
export const HEX: Record<Pastel, { fill: string; deep: string }> = {
  blush: { fill: "#F7C9D2", deep: "#D77A8E" },
  peach: { fill: "#FBD9B4", deep: "#E0964F" },
  butter: { fill: "#F7E6A0", deep: "#C9A52E" },
  mint: { fill: "#C2E6CD", deep: "#5FA87C" },
  sky: { fill: "#BFDCEC", deep: "#5C97BD" },
  lilac: { fill: "#D8CCEF", deep: "#8C76C9" },
  coral: { fill: "#F6AE96", deep: "#DC6A4B" },
};
