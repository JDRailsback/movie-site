export interface SemanticStyle {
  bg: string;
  fg: string;
  icon: string;
}

export const SEMANTIC: Record<string, SemanticStyle> = {
  drama: { bg: "#2A2048", fg: "#C4B0F0", icon: "✦" },
  romance: { bg: "#4A1030", fg: "#F0A0C4", icon: "♥" },
  crime: { bg: "#381010", fg: "#F0A0A0", icon: "◈" },
  thriller: { bg: "#1E1230", fg: "#B8A8D8", icon: "◈" },
  mystery: { bg: "#1E1238", fg: "#B0A8E0", icon: "◉" },
  comedy: { bg: "#2E2C08", fg: "#F0E060", icon: "◎" },
  action: { bg: "#301808", fg: "#F0A050", icon: "▶" },
  adventure: { bg: "#102808", fg: "#90D060", icon: "▶" },
  animation: { bg: "#082438", fg: "#80C0F0", icon: "◎" },
  documentary: { bg: "#0C2820", fg: "#80D0B0", icon: "◆" },
  horror: { bg: "#280808", fg: "#F08080", icon: "✦" },
  "science fiction": { bg: "#081C38", fg: "#78B8F0", icon: "◎" },
  fantasy: { bg: "#220848", fg: "#C080F0", icon: "✦" },
  history: { bg: "#282008", fg: "#F0C860", icon: "◆" },
  war: { bg: "#182008", fg: "#B0C870", icon: "◆" },
  western: { bg: "#281808", fg: "#E0A850", icon: "◆" },
  music: { bg: "#280840", fg: "#D080F0", icon: "♪" },
  family: { bg: "#2C2008", fg: "#F0C860", icon: "♥" },
  musical: { bg: "#280840", fg: "#D080F0", icon: "♪" },
  anime: { bg: "#081C38", fg: "#78B8F0", icon: "◎" },
  villain: { bg: "#280808", fg: "#F08080", icon: "◈" },
  friendship: { bg: "#2C2008", fg: "#F0C860", icon: "♥" },
  playful: { bg: "#2E2C08", fg: "#F0E060", icon: "◎" },
  christmas: { bg: "#0C2808", fg: "#80D080", icon: "✦" },
  "new york city": { bg: "#0C1C28", fg: "#88B8D8", icon: "◆" },
  suspenseful: { bg: "#1C1420", fg: "#C0A8C8", icon: "◈" },
  magic: { bg: "#220848", fg: "#C080F0", icon: "✦" },
  superhero: { bg: "#0C1438", fg: "#8890F0", icon: "✦" },
  "coming of age": { bg: "#082820", fg: "#80C8B0", icon: "→" },
  "sibling relationship": { bg: "#281808", fg: "#E0B080", icon: "♥" },
};

const FALLBACK: SemanticStyle = { bg: "#2C2C2E", fg: "#AEAEB2", icon: "◆" };

export function semStyle(name: string): SemanticStyle {
  return SEMANTIC[name.toLowerCase()] ?? FALLBACK;
}
