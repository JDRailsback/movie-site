"use client";

import { RecRow } from "@/components/recs/RecRow";
import { type ProfileSummary, type RecItem, getProfileSummary, getRecs } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const SURFACES = [
  {
    key: "overall",
    eyebrow: "Top picks",
    title: "Made for you.",
    blurb: "Scored against your taste profile — the films most likely to become favourites.",
  },
  {
    key: "blind_spots",
    eyebrow: "Blind spots",
    title: "You should have seen these.",
    blurb: "Acclaimed, widely-loved films you haven't watched yet.",
  },
  {
    key: "hidden_gems",
    eyebrow: "Hidden gems",
    title: "Under the radar.",
    blurb: "Smaller films with strong critical standing that flew under the radar.",
  },
];

const EDGE = "rgba(255,255,255,0.06)";

export default function RecsPage() {
  const { profile } = useParams<{ profile: string }>();
  const [recs, setRecs] = useState<Record<string, RecItem[]>>({});
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getProfileSummary(profile).catch(() => null),
      ...SURFACES.map((s) => getRecs(profile, s.key).catch(() => null)),
    ]).then(([prof, ...sets]) => {
      setSummary(prof as ProfileSummary | null);
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

  const name = summary?.displayName || summary?.username || null;

  return (
    <div className="min-h-screen pb-32">
      {/* Hero */}
      <div className="mx-auto max-w-7xl px-8 pt-14 pb-4">
        <h1 className="font-display text-[5.5rem] italic font-light text-white leading-none tracking-tight">
          {name ? (
            <>
              Watch next,{" "}
              <span style={{ color: "rgba(255,255,255,0.42)" }}>{name}.</span>
            </>
          ) : (
            "Watch next."
          )}
        </h1>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        SURFACES.map((s) => {
          const items = recs[s.key] ?? [];
          return (
            <section key={s.key} className="mx-auto max-w-7xl px-8 mt-14">
              <div className="border-t pt-8 mb-7" style={{ borderColor: EDGE }}>
                <p
                  className="text-[10px] uppercase tracking-[0.22em] font-medium mb-3"
                  style={{ color: "rgba(255,255,255,0.22)" }}
                >
                  {s.eyebrow}
                </p>
                <h2 className="font-display text-[2.6rem] italic font-light text-white leading-tight">
                  {s.title}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.28)" }}>
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
                  style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${EDGE}` }}
                >
                  <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Nothing here yet.
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: "rgba(255,255,255,0.14)" }}>
                    Import more of your Letterboxd history to populate this section.{" "}
                    <Link href="/" className="underline underline-offset-2 hover:opacity-70 transition-opacity">
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
          <div className="border-t pt-8 mb-7" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="h-2.5 w-16 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.05)" }} />
            <div className="h-10 w-64 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
            <div className="h-3 w-80 rounded mt-3" style={{ background: "rgba(255,255,255,0.03)" }} />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }).map((_, k) => (
              <div
                key={k}
                className="w-44 shrink-0 rounded-sm"
                style={{ aspectRatio: "2/3", background: "rgba(255,255,255,0.04)" }}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
