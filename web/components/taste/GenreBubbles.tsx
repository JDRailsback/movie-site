"use client";

import { useFilter } from "@/components/taste/FilterContext";
import type { GenreAffinity } from "@/lib/api";
import { HEX, pastelFor } from "@/lib/pastels";
import { AnimatePresence, motion } from "framer-motion";

const NEG = "#CDBDB0"; // muted clay for "not for you"

// Genre affinity as a sorted diverging bar chart — most-loved at the top, bars
// reading right (love) / left (dislike). Tap a row to filter the whole hub and
// reveal the four signals behind it.
export function GenreBubbles({ genres }: { genres: Record<string, GenreAffinity> }) {
  const rows = Object.values(genres).sort((a, b) => b.affinity - a.affinity);
  const { selection, isActive, toggle, countOf } = useFilter();
  const selectedGenre = selection?.dim === "genre" ? selection.value : null;
  const selected = rows.find((r) => r.name === selectedGenre) ?? null;

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.affinity)), 0.05);
  const half = Math.ceil(rows.length / 2);
  const columns = [rows.slice(0, half), rows.slice(half)];

  return (
    <div>
      <div className="grid gap-x-10 gap-y-0.5 md:grid-cols-2">
        {columns.map((col, ci) => (
          <div key={ci === 0 ? "left" : "right"} className="space-y-0.5">
            {col.map((g, i) => {
              const pct = Math.min(Math.abs(g.affinity) / maxAbs, 1) * 50;
              const positive = g.affinity >= 0;
              const count = countOf("genre", g.name);
              const dimmed = isActive && count === 0;
              const isSel = g.name === selectedGenre;
              return (
                <button
                  type="button"
                  key={g.name}
                  onClick={() => toggle("genre", g.name)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1 text-sm transition hover:bg-ink/5"
                  style={{
                    opacity: dimmed ? 0.4 : 1,
                    backgroundColor: isSel ? "rgba(59,50,44,0.06)" : undefined,
                  }}
                >
                  <span className="w-24 shrink-0 truncate text-right text-ink/75">{g.name}</span>
                  <div className="relative h-5 flex-1">
                    <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-ink/12" />
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.02 }}
                      className="absolute top-0.5 h-4 rounded"
                      style={
                        positive
                          ? { left: "50%", backgroundColor: HEX[pastelFor(g.name)].fill }
                          : { right: "50%", backgroundColor: NEG }
                      }
                    />
                  </div>
                  <span className="w-11 shrink-0 text-right text-xs tabular-nums text-ink/50">
                    {isActive ? count : `${g.affinity >= 0 ? "+" : ""}${g.affinity.toFixed(2)}`}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mt-4 rounded-xl bg-paper p-4"
            style={{ boxShadow: "0 1px 2px rgba(59,50,44,0.06)" }}
          >
            <p className="mb-2 font-display text-base font-semibold text-ink">
              {selected.name}{" "}
              <span className="text-xs font-normal text-ink/50">
                · {selected.count} films · you rate them {selected.avg_rating.toFixed(1)}/10
              </span>
            </p>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <Signal label="Rating vs. your average" v={selected.components.rating} />
              <Signal label="vs. the crowd" v={selected.components.vs_audience} />
              <Signal label="How often you watch it" v={selected.components.engagement} />
              <Signal label="How often you ♥ it" v={selected.components.likes} />
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
      <span className="w-32 shrink-0 text-ink/55">{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-ink/5">
        <div className="absolute left-1/2 top-0 h-full w-px bg-ink/15" />
        <div
          className="absolute top-0 h-full rounded-full"
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
