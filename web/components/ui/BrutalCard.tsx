"use client";

import { HEX, type Pastel } from "@/lib/pastels";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

// Minimal card: white surface with a faint colour wash, hairline border, soft
// shadow. (pattern / shape / tilt props are accepted but ignored now.)
export function BrutalCard({
  children,
  bg = "blush",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  bg?: Pastel;
  pattern?: "dots" | "stripes" | "checks" | "grid" | "none";
  shape?: "squircle" | "blob" | "blob2";
  tilt?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ y: 14, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      whileHover={{ y: -2 }}
      className={`brutal h-full rounded-2xl p-6 ${className}`}
      style={{ backgroundColor: `${HEX[bg].fill}14` }}
    >
      {children}
    </motion.section>
  );
}

export function BrutalTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl font-semibold text-ink">{children}</h2>
      {hint && <p className="mt-1 text-sm text-ink/45">{hint}</p>}
    </div>
  );
}
