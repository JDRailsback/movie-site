"use client";

import { useFilter } from "@/components/taste/FilterContext";
import type { GenreAffinity } from "@/lib/api";
import { HEX, pastelFor } from "@/lib/pastels";
import { AnimatePresence, motion } from "framer-motion";

const MUTED = "#E2D8CC";
const SELECTED_RING = "0 0 0 2px #3B322C";

export function GenreBubbles({ genres }: { genres: Record<string, GenreAffinity> }) {
  const rows = Object.values(genres).sort((a, b) => b.affinity - a.affinity);
  const { selection, isActive, toggle, countOf } = useFilter();
  const selectedGenre = selection?.dim === "genre" ? selection.value : null;
  const selected = rows.find((r) => r.name === selectedGenre) ?? null;

  // size relative to *this* user's range, so the spread is always visible even
  // when affinities are all small in absolute terms.
  const affs = rows.map((r) => r.affinity);
  const lo = Math.min(...affs);
  const hi = Math.max(...affs);
  const range = hi - lo || 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-3 py-1">
        {rows.map((g) => {
          const norm = (g.affinity - lo) / range;
          const size = 56 + norm * 72;
          const positive = g.affinity >= 0;
          const fill = positive ? HEX[pastelFor(g.name)].fill : MUTED;
          const count = countOf("genre", g.name);
          const dimmed = isActive && count === 0;
          const isSel = g.name === selectedGenre;
          return (
            <button
              type="button"
              key={g.name}
              onClick={() => toggle("genre", g.name)}
              className="grid place-items-center rounded-full leading-none transition hover:scale-105"
              style={{
                width: size,
                height: size,
                backgroundColor: fill,
                opacity: dimmed ? 0.3 : 1,
                boxShadow: isSel ? SELECTED_RING : "0 1px 2px rgba(59,50,44,0.06)",
              }}
            >
              <span
                className="px-1.5 text-center font-semibold leading-tight text-ink"
                style={{ fontSize: size > 98 ? 13 : size > 74 ? 11 : 10 }}
              >
                {g.name}
                {size > 74 && (
                  <span className="block text-[9px] font-medium opacity-50">
                    {isActive
                      ? `${count}`
                      : `${g.affinity >= 0 ? "+" : ""}${g.affinity.toFixed(2)}`}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[156px]">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="rounded-xl bg-paper p-3"
              style={{ boxShadow: "0 1px 2px rgba(59,50,44,0.06)" }}
            >
              <p className="mb-2 font-display text-base font-semibold text-ink">
                {selected.name}{" "}
                <span className="text-xs font-normal text-ink/50">
                  · {selected.count} films · {selected.avg_rating.toFixed(1)}/10
                </span>
              </p>
              <Signal label="Rating vs. your average" v={selected.components.rating} />
              <Signal label="vs. the crowd" v={selected.components.vs_audience} />
              <Signal label="How often you watch it" v={selected.components.engagement} />
              <Signal label="How often you ♥ it" v={selected.components.likes} />
            </motion.div>
          ) : (
            <p className="pt-6 text-center text-xs text-ink/40">
              Tap a genre to filter your whole map
            </p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Signal({ label, v }: { label: string; v: number }) {
  const pct = Math.min(Math.abs(v), 1) * 50;
  return (
    <div className="flex items-center gap-2 py-0.5 text-[11px]">
      <span className="w-32 shrink-0 text-ink/55">{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-ink/5">
        <div className="absolute left-1/2 top-0 h-full w-px bg-ink/15" />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          className="absolute top-0 h-full rounded-full"
          style={
            v >= 0
              ? { left: "50%", background: "#5FA87C" }
              : { right: "50%", background: "#DC6A4B" }
          }
        />
      </div>
    </div>
  );
}
