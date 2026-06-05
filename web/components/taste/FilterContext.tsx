"use client";

import type { FilmDatum } from "@/lib/api";
import { countryName, flag } from "@/lib/countries";
import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, createContext, useContext, useMemo, useState } from "react";

export type Dim = "genre" | "director" | "decade" | "country" | "theme";
export interface Selection {
  dim: Dim;
  value: string;
}

interface Ctx {
  selection: Selection | null;
  isActive: boolean;
  toggle: (dim: Dim, value: string) => void;
  clear: () => void;
  filtered: FilmDatum[];
  countOf: (dim: Dim, value: string) => number;
  top: (dim: Dim, n: number) => [string, number][];
  totalFilms: number;
}

const FilterCtx = createContext<Ctx | null>(null);
const DIMS: Dim[] = ["genre", "director", "decade", "country", "theme"];

function field(f: FilmDatum, dim: Dim): string[] {
  switch (dim) {
    case "genre":
      return f.genres;
    case "director":
      return f.directors;
    case "country":
      return f.countries;
    case "theme":
      return f.themes;
    case "decade":
      return f.decade != null ? [String(f.decade)] : [];
  }
}

export function FilterProvider({ films, children }: { films: FilmDatum[]; children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);

  const filtered = useMemo(() => {
    if (!selection) return films;
    return films.filter((f) => field(f, selection.dim).includes(selection.value));
  }, [films, selection]);

  const counts = useMemo(() => {
    const m: Record<Dim, Map<string, number>> = {
      genre: new Map(),
      director: new Map(),
      decade: new Map(),
      country: new Map(),
      theme: new Map(),
    };
    for (const f of filtered) {
      for (const dim of DIMS) {
        for (const v of field(f, dim)) m[dim].set(v, (m[dim].get(v) ?? 0) + 1);
      }
    }
    return m;
  }, [filtered]);

  const value: Ctx = {
    selection,
    isActive: selection != null,
    toggle: (dim, val) =>
      setSelection((s) => (s && s.dim === dim && s.value === val ? null : { dim, value: val })),
    clear: () => setSelection(null),
    filtered,
    countOf: (dim, val) => counts[dim].get(val) ?? 0,
    top: (dim, n) => [...counts[dim].entries()].sort((a, b) => b[1] - a[1]).slice(0, n),
    totalFilms: films.length,
  };

  return <FilterCtx.Provider value={value}>{children}</FilterCtx.Provider>;
}

export function useFilter(): Ctx {
  const c = useContext(FilterCtx);
  if (!c) throw new Error("useFilter must be used within FilterProvider");
  return c;
}

const DIM_NOUN: Record<Dim, string> = {
  genre: "genre",
  director: "director",
  decade: "decade",
  country: "country",
  theme: "theme",
};

// A sticky banner naming the active selection, with a clear button.
export function FilterBanner() {
  const { selection, isActive, filtered, clear } = useFilter();
  return (
    <AnimatePresence>
      {isActive && selection && (
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          className="brutal sticky top-[3.25rem] z-30 mb-6 flex flex-wrap items-center gap-3 rounded-full bg-butter px-5 py-2"
        >
          <span className="text-sm font-bold text-ink">
            Filtering by {DIM_NOUN[selection.dim]}{" "}
            <strong className="font-black">
              {selection.dim === "decade"
                ? `${selection.value}s`
                : selection.dim === "country"
                  ? `${flag(selection.value)} ${countryName(selection.value)}`
                  : selection.value}
            </strong>{" "}
            · {filtered.length} films
          </span>
          <button
            type="button"
            onClick={clear}
            className="brutal-sm rounded-full bg-coral px-3 py-1 text-xs font-black uppercase text-ink"
          >
            ✕ clear
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
