"use client";

import { BG, type Pastel, TEXT_DEEP, pastelFor } from "@/lib/pastels";
import { motion } from "framer-motion";

// A tilted pastel "sticker" chip that wiggles on hover. Tilt is deterministic
// from the label so it's stable across renders.
export function Sticker({
  label,
  pastel,
  index = 0,
}: {
  label: string;
  pastel?: Pastel;
  index?: number;
}) {
  const p = pastel ?? pastelFor(label);
  let h = 0;
  for (const c of label) h += c.charCodeAt(0);
  const tilt = (h % 7) - 3; // deterministic -3..3 deg

  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotate: tilt }}
      transition={{ type: "spring", stiffness: 320, damping: 18, delay: index * 0.03 }}
      whileHover={{ rotate: 0, scale: 1.08, y: -2 }}
      className={`inline-block cursor-default rounded-full px-3 py-1 text-sm font-semibold shadow-sticker ${BG[p]} ${TEXT_DEEP[p]}`}
    >
      {label}
    </motion.span>
  );
}
