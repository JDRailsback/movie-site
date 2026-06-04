"use client";

import type { GenreAffinity } from "@/lib/api";
import { HEX, pastelFor } from "@/lib/pastels";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const MUTED = "#D8C8BE"; // soft, faded fill for "not your thing"
const SCALE = 0.6; // affinities rarely exceed ±0.6 -> full bar there

// Playful diverging bars: each genre fills in its own pastel when you love it,
// a faded clay when you don't. Hover a row to peek at the four signals behind it.
export function AffinityBars({ genres }: { genres: Record<string, GenreAffinity> }) {
  const rows = Object.values(genres).sort((a, b) => b.affinity - a.affinity);
  return (
    <div className="space-y-1">
      {rows.map((g, i) => (
        <GenreRow key={g.name} g={g} index={i} />
      ))}
    </div>
  );
}

function GenreRow({ g, index }: { g: GenreAffinity; index: number }) {
  const [open, setOpen] = useState(false);
  const positive = g.affinity >= 0;
  const pct = Math.min(Math.abs(g.affinity) / SCALE, 1) * 50;
  const fill = positive ? HEX[pastelFor(g.name)].fill : MUTED;

  return (
    <div
      className="relative rounded-full px-1 py-1 transition hover:bg-paper-deep/60"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="w-24 shrink-0 text-right font-semibold text-ink-soft">{g.name}</span>
        <div className="relative h-6 flex-1 rounded-full bg-paper-deep">
          <div className="absolute left-1/2 top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-paper-edge" />
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 90, damping: 16, delay: index * 0.04 }}
            className="absolute top-0 h-6 rounded-full"
            style={
              positive ? { left: "50%", background: fill } : { right: "50%", background: fill }
            }
          />
        </div>
        <span className="w-11 shrink-0 text-right text-xs font-bold tabular-nums text-ink-soft">
          {g.affinity >= 0 ? "+" : ""}
          {g.affinity.toFixed(2)}
        </span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            className="absolute right-2 top-full z-10 mt-1 w-56 rounded-2xl border border-paper-edge bg-paper p-3 text-left shadow-lift"
          >
            <p className="mb-2 text-xs text-ink-soft">
              {g.count} films · you rate them {g.avg_rating.toFixed(1)}/10
            </p>
            <Component label="Rating vs. your average" v={g.components.rating} />
            <Component label="vs. the crowd" v={g.components.vs_audience} />
            <Component label="How often you watch" v={g.components.engagement} />
            <Component label="How often you ♥" v={g.components.likes} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Component({ label, v }: { label: string; v: number }) {
  const pct = Math.min(Math.abs(v), 1) * 50;
  return (
    <div className="flex items-center gap-2 py-0.5 text-[11px]">
      <span className="w-28 shrink-0 text-ink-soft">{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-paper-deep">
        <div className="absolute left-1/2 top-0 h-2 w-px bg-paper-edge" />
        <div
          className="absolute top-0 h-2 rounded-full"
          style={
            v >= 0
              ? { left: "50%", width: `${pct}%`, background: "#5FA87C" }
              : { right: "50%", width: `${pct}%`, background: "#DC6A4B" }
          }
        />
      </div>
    </div>
  );
}
