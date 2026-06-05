"use client";

import type { GenreAffinity } from "@/lib/api";
import { HEX, pastelFor } from "@/lib/pastels";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const MUTED = "#D8C8BE"; // soft, faded fill for "not your thing"
const SCALE = 0.6; // affinities rarely exceed ±0.6 -> full bar there

// Playful diverging bars: each genre fills in its own pastel when you love it,
// a faded clay when you don't. Tap a row to expand the four signals behind it
// (inline, so nothing gets clipped by neighbouring cards).
export function AffinityBars({ genres }: { genres: Record<string, GenreAffinity> }) {
  const rows = Object.values(genres).sort((a, b) => b.affinity - a.affinity);
  const [openName, setOpenName] = useState<string | null>(null);
  return (
    <div className="space-y-0.5">
      {rows.map((g, i) => (
        <GenreRow
          key={g.name}
          g={g}
          index={i}
          open={openName === g.name}
          onToggle={() => setOpenName(openName === g.name ? null : g.name)}
        />
      ))}
    </div>
  );
}

function GenreRow({
  g,
  index,
  open,
  onToggle,
}: {
  g: GenreAffinity;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const positive = g.affinity >= 0;
  const pct = Math.min(Math.abs(g.affinity) / SCALE, 1) * 50;
  const fill = positive ? HEX[pastelFor(g.name)].fill : MUTED;

  return (
    <div
      className={`rounded-2xl px-1 transition ${open ? "bg-paper-deep/70" : "hover:bg-paper-deep/40"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 py-1 text-sm"
      >
        <span className="w-24 shrink-0 text-right font-semibold text-ink-soft">{g.name}</span>
        <div className="relative h-6 flex-1 rounded-full bg-paper-deep">
          <div className="absolute left-1/2 top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-paper-edge" />
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 90, damping: 16, delay: index * 0.03 }}
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
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-3 pt-1">
              <p className="mb-2 text-xs text-ink-soft">
                {g.count} films · you rate them {g.avg_rating.toFixed(1)}/10
              </p>
              <Signal label="Rating vs. your average" v={g.components.rating} />
              <Signal label="vs. the crowd" v={g.components.vs_audience} />
              <Signal label="How often you watch it" v={g.components.engagement} />
              <Signal label="How often you ♥ it" v={g.components.likes} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Signal({ label, v }: { label: string; v: number }) {
  const pct = Math.min(Math.abs(v), 1) * 50;
  return (
    <div className="flex items-center gap-2 py-0.5 text-[11px]">
      <span className="w-32 shrink-0 text-ink-soft">{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-paper">
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
