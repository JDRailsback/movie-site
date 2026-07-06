"use client";

import { PosterRow } from "@/components/recs/PosterRow";
import { WatchlistWheel } from "@/components/watchlist/WatchlistWheel";
import {
  type FilmCard,
  type ImportState,
  type RecItem,
  getFilms,
  getImportStatus,
  getRecs,
  getWatchlist,
  importByUsername,
} from "@/lib/api";
import { useRef, useState } from "react";

const PER_SECTION = 40; // max posters per scrollable row

const SURFACES = [
  { key: "overall", title: "Top Picks" },
  { key: "blind_spots", title: "Blind Spots" },
  { key: "hidden_gems", title: "Hidden Gems" },
] as const;

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  fetching: "Reading Letterboxd",
  matching: "Matching films",
  enriching: "Enriching catalogue",
  profiling: "Analysing taste",
  precomputing_recs: "Computing recommendations",
};

interface Stats {
  count: number;
  avg: number | null;
  topGenre: string | null;
}

const headingStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--muted)",
  margin: "0 0 8px",
  flexShrink: 0,
};

export default function Dashboard() {
  const [username, setUsername] = useState("");
  const [stage, setStage] = useState<ImportState | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recs, setRecs] = useState<Record<string, RecItem[]> | null>(null);
  const [watchlist, setWatchlist] = useState<FilmCard[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  async function startImport(e?: React.FormEvent) {
    e?.preventDefault();
    const uname = username.trim();
    if (!uname || importing) return;
    setImporting(true);
    setError(null);
    setStage("queued");
    try {
      const { importId, profileId } = await importByUsername(uname);
      let ready = false;
      for (let i = 0; i < 180; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await getImportStatus(importId);
        if (st.status === "ready") { ready = true; break; }
        if (st.status === "failed") throw new Error(st.error ?? "Import failed — check the username.");
        setStage(st.status);
      }
      if (!ready) throw new Error("Import timed out.");

      const [sets, wl, films] = await Promise.all([
        Promise.all(SURFACES.map((s) => getRecs(profileId, s.key))),
        getWatchlist(profileId),
        getFilms(profileId),
      ]);

      const next: Record<string, RecItem[]> = {};
      sets.forEach((set, i) => { next[SURFACES[i].key] = set.items; });
      setRecs(next);
      setWatchlist(wl);

      const rated = films.filter((f) => f.rating != null);
      const avg = rated.length
        ? rated.reduce((a, f) => a + (f.rating as number), 0) / rated.length
        : null;
      const counts: Record<string, number> = {};
      films.forEach((f) => f.genres?.forEach((g) => { counts[g] = (counts[g] ?? 0) + 1; }));
      const topGenre = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      setStats({ count: films.length, avg, topGenre });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setImporting(false);
      setStage(null);
    }
  }

  const hasResults = recs !== null;

  return (
    <main
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "24px 34px 28px",
      }}
    >
      {/* Masthead + import (always at top) */}
      <header style={{ textAlign: "center", flexShrink: 0, marginBottom: hasResults ? 18 : 0 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "0.01em", margin: 0 }}>Recs</h1>
        {!hasResults && (
          <p style={{ fontSize: 16, color: "var(--muted)", margin: "10px 0 22px" }}>
            Enter your Letterboxd username for personalized recommendations.
          </p>
        )}
        <form
          onSubmit={startImport}
          style={{ display: "flex", justifyContent: "center", marginTop: hasResults ? 12 : 0 }}
        >
          <input
            ref={inputRef}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="letterboxd username"
            autoComplete="off"
            spellCheck={false}
            disabled={importing}
            style={{
              width: 260,
              padding: "10px 15px",
              border: "1px solid var(--line)",
              borderRight: "none",
              background: "#fff",
              font: "inherit",
              fontWeight: 500,
              fontSize: 15,
              color: "var(--text)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={importing || !username.trim()}
            style={{
              padding: "10px 24px",
              border: "1px solid var(--text)",
              background: importing || !username.trim() ? "transparent" : "var(--text)",
              color: importing || !username.trim() ? "var(--muted)" : "var(--bg)",
              font: "inherit",
              fontWeight: 600,
              fontSize: 15,
              cursor: importing || !username.trim() ? "default" : "pointer",
            }}
          >
            {importing ? "…" : "Import"}
          </button>
        </form>

        {importing && stage && (
          <p style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>
            {STAGE_LABELS[stage] ?? "Working"}…
          </p>
        )}
        {error && <p style={{ marginTop: 12, fontSize: 14, color: "#9a3b34" }}>{error}</p>}

        {/* Stats */}
        {stats && !importing && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "center",
              gap: 28,
              fontSize: 14,
              color: "var(--muted)",
            }}
          >
            <span>
              <strong style={{ color: "var(--text)", fontWeight: 700 }}>{stats.count}</strong> films
            </span>
            {stats.avg != null && (
              <span>
                <strong style={{ color: "var(--text)", fontWeight: 700 }}>★ {stats.avg.toFixed(1)}</strong> average
              </span>
            )}
            {stats.topGenre && (
              <span>
                top genre <strong style={{ color: "var(--text)", fontWeight: 700 }}>{stats.topGenre}</strong>
              </span>
            )}
          </div>
        )}
      </header>

      {/* Dashboard: recs left, spinner right */}
      {hasResults && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 34 }}>
          {/* Left: scrollable recommendation rows */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            {SURFACES.map((s) => (
              <section
                key={s.key}
                style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
              >
                <h2 style={headingStyle}>{s.title}</h2>
                {recs?.[s.key]?.length ? (
                  <PosterRow items={recs[s.key].slice(0, PER_SECTION)} />
                ) : (
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                    No recommendations.
                  </p>
                )}
              </section>
            ))}
          </div>

          {/* Right: watchlist wheel */}
          <aside
            style={{
              width: 220,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid var(--line)",
              paddingLeft: 28,
            }}
          >
            <h2 style={headingStyle}>Watchlist</h2>
            {watchlist.length >= 2 ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <WatchlistWheel films={watchlist} />
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                Add at least two films to your watchlist to spin.
              </p>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
