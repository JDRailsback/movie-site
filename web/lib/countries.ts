// ISO 3166-1 alpha-2 -> flag emoji (via regional indicator symbols) + a small
// name map for the common film-producing countries (fallback: the code).

export function flag(code: string): string {
  if (code.length !== 2) return "🎬";
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const NAMES: Record<string, string> = {
  US: "USA",
  GB: "UK",
  JP: "Japan",
  FR: "France",
  CA: "Canada",
  DE: "Germany",
  AU: "Australia",
  CN: "China",
  KR: "South Korea",
  IT: "Italy",
  ES: "Spain",
  IN: "India",
  SE: "Sweden",
  DK: "Denmark",
  RU: "Russia",
  HK: "Hong Kong",
  TW: "Taiwan",
  MX: "Mexico",
  BR: "Brazil",
  IE: "Ireland",
  NZ: "New Zealand",
  IR: "Iran",
  PL: "Poland",
  BE: "Belgium",
  NL: "Netherlands",
  AR: "Argentina",
  NO: "Norway",
  FI: "Finland",
  CZ: "Czechia",
  AT: "Austria",
  CH: "Switzerland",
};

export function countryName(code: string): string {
  return NAMES[code] ?? code;
}
