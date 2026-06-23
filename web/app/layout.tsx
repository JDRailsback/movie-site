import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";

// Display: Fraunces (a soft, characterful "wonky" serif). UI: Nunito (rounded,
// friendly). Loaded as CSS variables consumed by tailwind's fontFamily.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "opsz", "WONK"],
});
const sans = Nunito({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Recs — personalized film recommendations",
  description:
    "Personalized film recommendations drawn from your Letterboxd taste.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
