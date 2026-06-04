"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// A soft squircle "paper" card that springs in and lifts slightly on hover.
// Optional small tilt for the scrapbook, asymmetric feel.
export function PaperCard({
  children,
  tilt = 0,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  tilt?: number;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ y: 18, opacity: 0, rotate: tilt }}
      whileInView={{ y: 0, opacity: 1, rotate: tilt }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 120, damping: 16, delay }}
      whileHover={{ rotate: 0, y: -4 }}
      className={`rounded-squircle border border-paper-edge bg-paper-deep/50 p-6 shadow-lift backdrop-blur-[1px] ${className}`}
    >
      {children}
    </motion.section>
  );
}
