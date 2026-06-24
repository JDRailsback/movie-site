"use client";

import { MarqueeBanner } from "@/components/recs/MarqueeBanner";
import { RecRow } from "@/components/recs/RecRow";
import { type RecItem, getRecs } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const SURFACES = [
  { key: "overall", title: "Top Picks", blurb: "Overall recommendations based on your taste" },
  { key: "blind_spots", title: "Blind Spots", blurb: "The biggest films you somehow haven't seen yet" },
  { key: "hidden_gems", title: "Hidden Gems", blurb: "Niche films that might be your next favorite" },
];

const EDGE = "rgba(196,154,60,0.2)";

export default function RecsPage() {
  const { profile } = useParams<{ profile: string }>();
  const [recs, setRecs] = useState<Record<string, RecItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(SURFACES.map((s) => getRecs(profile, s.key).catch(() => null))).then((sets) => {
      const out: Record<string, RecItem[]> = {};
      sets.forEach((set, i) => {
        out[SURFACES[i].key] = (set as { items: RecItem[] } | null)?.items ?? [];
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
    <div className="min-h-screen pb-32">
      {/* Hero */}
      <div className="mx-auto max-w-7xl px-8 pt-14 pb-4">
        <MarqueeBanner />
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        SURFACES.map((s) => {
          const items = recs[s.key] ?? [];
          return (
            <section key={s.key} className="mx-auto max-w-7xl px-8 mt-14">
              <div className="border-t pt-8 mb-7" style={{ borderColor: EDGE }}>
                <h2 className="font-display text-[2.8rem] leading-tight tracking-tight" style={{ color: "rgba(240,210,150,0.95)" }}>
                  {s.title}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "rgba(196,154,60,0.6)" }}>
                  {s.blurb}
                </p>
              </div>

              {items.length ? (
                <RecRow
                  items={items}
                  profileId={profile}
                  surface={s.key}
                  onRemove={(id) => remove(s.key, id)}
                />
              ) : (
                <div
                  className="rounded-sm px-6 py-8 text-center"
                  style={{ background: "rgba(196,154,60,0.04)", border: `1px solid ${EDGE}` }}
                >
                  <p className="text-[13px]" style={{ color: "rgba(196,154,60,0.6)" }}>
                    Nothing here yet.
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: "rgba(196,154,60,0.6)" }}>
                    Import more of your Letterboxd history to populate this section.{" "}
                    <Link
                      href="/"
                      className="underline underline-offset-2 hover:opacity-70 transition-opacity"
                    >
                      Import now
                    </Link>
                  </p>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      {SURFACES.map((s) => (
        <div key={s.key} className="mx-auto max-w-7xl px-8 mt-14">
          <div className="border-t pt-8 mb-7" style={{ borderColor: "rgba(196,154,60,0.2)" }}>
            <div className="h-10 w-44 rounded" style={{ background: "rgba(196,154,60,0.08)" }} />
            <div className="h-3 w-64 rounded mt-2" style={{ background: "rgba(196,154,60,0.05)" }} />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }, (_, k) => k).map((k) => (
              <div
                key={k}
                className="w-44 shrink-0 rounded-sm"
                style={{ aspectRatio: "2/3", background: "rgba(196,154,60,0.06)" }}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
