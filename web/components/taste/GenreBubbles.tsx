"use client";

import { useFilter } from "@/components/taste/FilterContext";
import type { GenreAffinity } from "@/lib/api";
import { HEX, pastelFor } from "@/lib/pastels";
import { AnimatePresence, motion } from "framer-motion";

const MUTED = "#D9C7BB";

// Genre bubbles drive the cross-filter: tapping one filters the whole hub to
// your films in that genre (and unfurls its four signals). Sized by affinity;
// faded when out of the active slice.
export function GenreBubbles({ genres }: { genres: Record<string, GenreAffinity> }) {
  const rows = Object.values(genres).sort((a, b) => b.affinity - a.affinity);
  const { selection, isActive, toggle, countOf } = useFilter();
  const selectedGenre = selection?.dim === "genre" ? selection.value : null;
  const selected = rows.find((r) => r.name === selectedGenre) ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-2.5 py-1">
        {rows.map((g, i) => {
          const t = Math.max(0, Math.min(1, (g.affinity + 0.3) / 0.9));
          const size = 44 + t * 74;
          const positive = g.affinity >= 0;
          const fill = positive ? HEX[pastelFor(g.name)].fill : MUTED;
          let h = 0;
          for (const c of g.name) h += c.charCodeAt(0);
          const tilt = (h % 9) - 4;
          const count = countOf("genre", g.name);
          const dimmed = isActive && count === 0;
          const isSel = g.name === selectedGenre;
          return (
            <span
              key={g.name}
              className="inline-block animate-float"
              style={{ animationDelay: `${(i % 7) * 0.5}s`, animationDuration: `${5 + (i % 4)}s` }}
            >
              <motion.button
                type="button"
                onClick={() => toggle("genre", g.name)}
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: dimmed ? 0.28 : 1, rotate: tilt }}
                viewport={{ once: true }}
                animate={{ opacity: dimmed ? 0.28 : 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 14, delay: i * 0.03 }}
                whileHover={{ rotate: 0, scale: 1.15, zIndex: 5 }}
                className="brutal-sm grid place-items-center rounded-full leading-none"
                style={{
                  width: size,
                  height: size,
                  background: fill,
                  boxShadow: isSel ? "0 0 0 3px #3B322C, 4px 4px 0 0 #3B322C" : undefined,
                }}
              >
                <span
                  className="px-1 text-center font-extrabold leading-tight text-ink"
                  style={{ fontSize: size > 80 ? 13 : size > 58 ? 11 : 9.5 }}
                >
                  {g.name}
                  {size > 58 && (
                    <span className="block text-[9px] font-black opacity-60">
                      {isActive
                        ? `${count}`
                        : `${g.affinity >= 0 ? "+" : ""}${g.affinity.toFixed(2)}`}
                    </span>
                  )}
                </span>
              </motion.button>
            </span>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key={selected.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="brutal-sm mt-3 rounded-xl bg-paper p-3"
          >
            <p className="mb-2 font-display text-base font-black uppercase text-ink">
              {selected.name}{" "}
              <span className="text-xs font-bold normal-case text-ink/60">
                · {selected.count} films · {selected.avg_rating.toFixed(1)}/10
              </span>
            </p>
            <Signal label="Rating vs. your average" v={selected.components.rating} />
            <Signal label="vs. the crowd" v={selected.components.vs_audience} />
            <Signal label="How often you watch it" v={selected.components.engagement} />
            <Signal label="How often you ♥ it" v={selected.components.likes} />
          </motion.div>
        ) : (
          <p className="mt-3 text-center text-xs font-bold text-ink/50">
            ▸ tap a genre to filter your whole map
          </p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Signal({ label, v }: { label: string; v: number }) {
  const pct = Math.min(Math.abs(v), 1) * 50;
  return (
    <div className="flex items-center gap-2 py-0.5 text-[11px]">
      <span className="w-32 shrink-0 font-semibold text-ink/70">{label}</span>
      <div className="relative h-2.5 flex-1 rounded-full border border-ink bg-paper-deep">
        <div className="absolute left-1/2 top-0 h-full w-px bg-ink/30" />
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
