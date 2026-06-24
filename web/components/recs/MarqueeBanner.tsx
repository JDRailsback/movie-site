"use client";

import { useEffect, useRef, useState } from "react";

interface Dot {
  x: number;
  y: number;
  phase: number;
  dur: number;
}

const FONT_FAMILY = "Broadway, Anton, serif";

function seed(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Broadway 3D Filled has circular holes cut into the letter body.
// We render white-on-black, then find dark pixels that are *surrounded*
// by bright letter-body pixels — those are the holes where lights go.
function computeHoles(
  fs: number,
  w: number,
  h: number,
): { dots: Dot[]; dotR: number } {
  const grid = Math.max(8, Math.round(fs * 0.07));
  const check = Math.max(grid + 2, Math.round(fs * 0.085));
  const dotR = Math.max(3, Math.round(fs * 0.03));

  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return { dots: [], dotR };

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${fs}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText("WATCH NEXT", w / 2, h / 2);

  const px = ctx.getImageData(0, 0, w, h).data;

  const dirs: [number, number][] = [
    [-check, 0],
    [check, 0],
    [0, -check],
    [0, check],
    [-check, -check],
    [check, check],
    [-check, check],
    [check, -check],
  ];

  const dots: Dot[] = [];

  for (let y = check; y < h - check; y += grid) {
    for (let x = check; x < w - check; x += grid) {
      // This pixel must be dark — inside a hole (background showing through)
      if (px[(y * w + x) * 4] > 80) continue;

      // Count how many neighbours in 8 directions are part of the bright letter body
      let bright = 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (px[(ny * w + nx) * 4] > 150) bright++;
      }

      // If enclosed on enough sides, it's inside a letter hole
      if (bright >= 4) {
        const s = (x / grid) * 1000 + y / grid;
        dots.push({
          x,
          y,
          phase: seed(s) * 2.5,
          dur: 0.5 + seed(s + 99) * 1.2,
        });
      }
    }
  }

  return { dots, dotR };
}

interface BannerState {
  w: number;
  h: number;
  fs: number;
  dots: Dot[];
  dotR: number;
}

export function MarqueeBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<BannerState | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const w = Math.floor(ref.current.getBoundingClientRect().width);

    // Explicitly wait for Broadway before measuring — font-display:swap
    // can defer actual loading past fonts.ready in some browsers.
    document.fonts.load(`100px Broadway`).finally(() => {
      const cv0 = document.createElement("canvas");
      const c0 = cv0.getContext("2d");
      if (!c0) return;
      c0.font = `100px ${FONT_FAMILY}`;
      const tw = c0.measureText("WATCH NEXT").width;
      // Fill 92% of container, no upper cap — user wants it big
      const fs = Math.floor(((w * 0.92) / tw) * 100);
      const h = Math.ceil(fs * 1.45);
      const { dots, dotR } = computeHoles(fs, w, h);
      setState({ w, h, fs, dots, dotR });
    });
  }, []);

  return (
    <>
      <style>{`@keyframes db{from{opacity:1}to{opacity:.06}}`}</style>
      <div
        ref={ref}
        style={{
          width: "100%",
          background: "#1c1108",
          overflow: "hidden",
          minHeight: 160,
        }}
      >
        {state && (
          <svg width={state.w} height={state.h} style={{ display: "block" }}>
            {/* Depth shadow */}
            <text
              x={state.w / 2 + 6}
              y={state.h / 2 + 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={FONT_FAMILY}
              fontSize={state.fs}
              fill="#3a2005"
            >
              WATCH NEXT
            </text>
            {/* Letter body — warm gold */}
            <text
              x={state.w / 2}
              y={state.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={FONT_FAMILY}
              fontSize={state.fs}
              fill="#c9a84c"
            >
              WATCH NEXT
            </text>
            {/* Twinkling lights at hole positions */}
            {state.dots.map((d, i) => (
              <circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={state.dotR}
                fill="#fff5c8"
                style={{
                  animation: `db ${d.dur}s ${d.phase}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </svg>
        )}
      </div>
    </>
  );
}
