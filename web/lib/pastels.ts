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

// Slate-dark palette: fill = dark-tinted surface, deep = bright readable label.
// Keep in sync with tailwind.config.ts.
export const HEX: Record<Pastel, { fill: string; deep: string }> = {
  blush: { fill: "#4A2030", deep: "#F4B0C8" },
  peach: { fill: "#4A2818", deep: "#F4C0A0" },
  coral: { fill: "#4A2010", deep: "#F4A890" },
  butter: { fill: "#3A3010", deep: "#F4DC80" },
  lilac: { fill: "#302810", deep: "#F4C868" },
  mint: { fill: "#0E3A3A", deep: "#78D8D8" },
  sky: { fill: "#0A2C3A", deep: "#68C8E0" },
};
