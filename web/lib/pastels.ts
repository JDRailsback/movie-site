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
  blush: { fill: "#F49AC1", deep: "#BE4A77" },
  peach: { fill: "#F6A24F", deep: "#BD5A14" },
  butter: { fill: "#F3C53A", deep: "#A87E0E" },
  mint: { fill: "#5DC59C", deep: "#207C5E" },
  sky: { fill: "#6FACDA", deep: "#2C6694" },
  lilac: { fill: "#9F86E2", deep: "#523BB4" },
  coral: { fill: "#F26B45", deep: "#B83216" },
};
