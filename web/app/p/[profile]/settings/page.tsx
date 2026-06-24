"use client";

import {
  type FilmCard,
  type ProfileSummary,
  getDismissed,
  getProfileSummary,
  posterUrl,
  refreshProfile,
  removeDismissed,
} from "@/lib/api";
import { type Settings, useSettings } from "@/lib/settings";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EDGE = "rgba(255,255,255,0.06)";
const DIM = "rgba(255,255,255,0.25)";
const FAINT = "rgba(255,255,255,0.12)";

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t pt-8 mb-8" style={{ borderColor: EDGE }}>
      <p
        className="text-[10px] uppercase tracking-[0.22em] font-medium"
        style={{ color: "rgba(255,255,255,0.22)" }}
      >
        {children}
      </p>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex items-center rounded-full p-0.5"
      style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${EDGE}` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className="rounded-full px-4 py-1.5 text-[13px] transition-all duration-150"
            style={{
              background: active ? "#fff" : "transparent",
              color: active ? "#0a0a0a" : DIM,
              fontWeight: active ? 500 : 400,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-10 py-5"
      style={{ borderBottom: `1px solid ${EDGE}` }}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-white">{label}</p>
        <p
          className="text-[12px] mt-0.5 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function SettingsPage() {
  const { profile } = useParams<{ profile: string }>();
  const router = useRouter();
  const [settings, updateSettings] = useSettings();
  const [dismissed, setDismissed] = useState<FilmCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    Promise.all([
      getDismissed(profile).catch(() => [] as FilmCard[]),
      getProfileSummary(profile).catch(() => null),
    ]).then(([d, s]) => {
      setDismissed(d);
      setSummary(s);
      setLoading(false);
    });
  }, [profile]);

  function restore(tmdbId: number) {
    removeDismissed(profile, tmdbId).catch(() => null);
    setDismissed((prev) => prev.filter((f) => f.tmdbId !== tmdbId));
  }

  function sync() {
    setSyncing(true);
    refreshProfile(profile)
      .then(({ importId, profileId }) => router.push(`/import/${importId}?profile=${profileId}`))
      .catch(() => setSyncing(false));
  }

  return (
    <main style={{ background: "#0a0a0a" }} className="min-h-screen pb-32">
      {/* Hero */}
      <div className="mx-auto max-w-3xl px-8 pt-14 pb-4">
        <h1 className="font-display text-[5.5rem] italic font-light text-white leading-none tracking-tight">
          Settings.
        </h1>
      </div>

      <div className="mx-auto max-w-3xl px-8 mt-10">
        {/* Display */}
        <section>
          <SectionDivider>Display</SectionDivider>
          <div>
            <SettingRow
              label="Card size"
              description="Comfortable shows larger posters with more detail. Compact fits more films on screen."
            >
              <SegmentedControl<Settings["cardDensity"]>
                value={settings.cardDensity}
                options={[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" },
                ]}
                onChange={(v) => updateSettings({ cardDensity: v })}
              />
            </SettingRow>

            <SettingRow
              label="Fit badge"
              description="Shows the percentage match score on each recommended film."
            >
              <SegmentedControl<"on" | "off">
                value={settings.showFitBadge ? "on" : "off"}
                options={[
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
                onChange={(v) => updateSettings({ showFitBadge: v === "on" })}
              />
            </SettingRow>
          </div>
        </section>

        {/* Dismissed films */}
        <section className="mt-14">
          <SectionDivider>Dismissed films</SectionDivider>
          <p className="text-[13px] mb-7 -mt-2 leading-relaxed" style={{ color: DIM }}>
            Films you've hidden. Hover a poster and click{" "}
            <strong style={{ color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Restore</strong> to
            bring them back to your recommendations.
          </p>

          {loading ? (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
            >
              {Array.from({ length: 10 }, (_, i) => i).map((i) => (
                <div
                  key={i}
                  className="rounded-sm"
                  style={{ aspectRatio: "2/3", background: "rgba(255,255,255,0.04)" }}
                />
              ))}
            </div>
          ) : dismissed.length === 0 ? (
            <div
              className="rounded-sm px-6 py-8 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${EDGE}` }}
            >
              <p className="text-[13px]" style={{ color: DIM }}>
                Nothing dismissed yet.
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "rgba(255,255,255,0.15)" }}>
                Press ✕ on any recommendation to hide a film.
              </p>
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
            >
              {dismissed.map((film) => {
                const url = posterUrl(film.posterPath);
                return (
                  <div key={film.tmdbId} className="group relative flex flex-col gap-1.5">
                    <div
                      className="relative overflow-hidden rounded-sm"
                      style={{ aspectRatio: "2/3", background: FAINT }}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={film.title}
                          className="h-full w-full object-cover opacity-35 transition-opacity group-hover:opacity-55"
                        />
                      ) : (
                        <div className="flex h-full items-end p-2">
                          <span
                            className="line-clamp-3 text-[9px] leading-tight"
                            style={{ color: DIM }}
                          >
                            {film.title}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => restore(film.tmdbId)}
                        className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ background: "rgba(0,0,0,0.55)" }}
                      >
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-medium"
                          style={{ background: "rgba(255,255,255,0.92)", color: "#0a0a0a" }}
                        >
                          Restore
                        </span>
                      </button>
                    </div>
                    <p className="truncate text-[11px] font-medium text-white leading-tight">
                      {film.title}
                    </p>
                    {film.year && (
                      <p className="text-[10px]" style={{ color: DIM }}>
                        {film.year}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Library */}
        <section className="mt-14">
          <SectionDivider>Library</SectionDivider>

          {/* Stats row */}
          <div
            className="flex items-center gap-8 py-5 mb-1"
            style={{ borderBottom: `1px solid ${EDGE}` }}
          >
            <div>
              <p className="text-[22px] font-light text-white tabular-nums">
                {summary ? summary.filmCount.toLocaleString() : "—"}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>
                films imported
              </p>
            </div>
            <div className="self-stretch w-px" style={{ background: EDGE }} />
            <div>
              <p className="text-[22px] font-light text-white">
                {summary ? formatDate(summary.lastImportAt) : "—"}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>
                last sync
              </p>
            </div>
          </div>

          <div>
            <SettingRow
              label="Sync from Letterboxd"
              description="Pull your latest watches and ratings directly from your public Letterboxd profile."
            >
              <button
                type="button"
                onClick={sync}
                disabled={syncing}
                className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-opacity"
                style={{
                  background: "#fff",
                  color: "#0a0a0a",
                  opacity: syncing ? 0.4 : 1,
                }}
              >
                {syncing ? "Starting…" : "Sync now"}
              </button>
            </SettingRow>
            <SettingRow
              label="Import from export"
              description="Upload a Letterboxd data export ZIP for the most complete history including diary dates."
            >
              <Link
                href="/"
                className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-80"
                style={{
                  background: "transparent",
                  color: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                Upload ZIP
              </Link>
            </SettingRow>
          </div>
        </section>
      </div>
    </main>
  );
}
