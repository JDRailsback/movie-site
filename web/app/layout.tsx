import type { Metadata } from "next";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import "./globals.css";

const display = localFont({
  src: "../public/fonts/manbow.otf",
  variable: "--font-display",
  display: "swap",
});
const sans = Nunito({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Recs — personalized film recommendations",
  description: "Personalized film recommendations drawn from your Letterboxd taste.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
