"use client";

import { RecCard } from "@/components/recs/RecCard";
import { FloatingShapes } from "@/components/ui/FloatingShapes";
import { Marquee } from "@/components/ui/Marquee";
import { type RecItem, getRecs } from "@/lib/api";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const SURFACES = [
  {
    key: "blind_spots",
    title: "Blind spots",
    blurb: "Acclaimed films you've somehow missed — that fit your taste.",
    bg: "bg-peach",
  },
  {
    key: "hidden_gems",
    title: "Hidden gems",
    blurb: "Under-the-radar films the algorithm dug up just for you.",
    bg: "bg-mint",
  },
];

export default function RecsPage() {
  const { profile } = useParams<{ profile: string }>();
  const [recs, setRecs] = useState<Record<string, RecItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(SURFACES.map((s) => getRecs(profile, s.key).catch(() => null))).then((sets) => {
      const out: Record<string, RecItem[]> = {};
      sets.forEach((set, i) => {
        out[SURFACES[i].key] = set?.items ?? [];
      });
      setRecs(out);
      setLoading(false);
    });
  }, [profile]);

  function remove(surface: string, tmdbId: number) {
    setRecs((r) => ({
      ...r,
      [surface]: (r[surface] ?? []).filter((i) => i.film.tmdbId !== tmdbId),
    }));
  }

  return (
    <main className="relative min-h-screen w-full overflow-x-clip pb-20">
      <FloatingShapes />
      <div className="sticky top-0 z-40">
        <Marquee
          items={[
            "Recommendations",
            "Find your next favourite",
            "Blind spots",
            "Hidden gems",
            "Reel",
          ]}
        />
      </div>

      <div className="mx-auto max-w-[1380px] px-6 pt-8 sm:px-10 lg:px-16">
        <header className="mb-8">
          <Link
            href={`/p/${profile}`}
            className="brutal-sm inline-block -rotate-2 rounded-full bg-lilac px-3 py-1 text-xs font-black uppercase text-ink"
          >
            ← back to your map
          </Link>
          <motion.h1
            initial={{ y: 24, opacity: 0, rotate: -2 }}
            animate={{ y: 0, opacity: 1, rotate: -1.5 }}
            transition={{ type: "spring", stiffness: 130, damping: 11 }}
            className="mt-3 font-display text-6xl font-black uppercase text-ink [text-shadow:4px_4px_0_#F6A24F,7px_7px_0_#3B322C] sm:text-7xl"
          >
            Watch next
          </motion.h1>
        </header>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {["a", "b", "c", "d", "e", "f"].map((k) => (
              <div key={k} className="aspect-[2/3] skeleton rounded-[1.1rem]" />
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {SURFACES.map((s) => {
              const items = recs[s.key] ?? [];
              return (
                <section key={s.key}>
                  <div
                    className={`brutal mb-5 inline-block -rotate-1 rounded-full ${s.bg} px-5 py-2`}
                  >
                    <h2 className="font-display text-2xl font-black uppercase text-ink">
                      {s.title}
                    </h2>
                  </div>
                  <p className="mb-4 text-sm font-bold text-ink/60">{s.blurb}</p>
                  {items.length ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {items.map((it) => (
                        <RecCard
                          key={it.film.tmdbId}
                          item={it}
                          profileId={profile}
                          surface={s.key}
                          onRemove={(id) => remove(s.key, id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-ink/50">
                      Nothing here yet — try importing more films, or check back as the corpus
                      grows.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
