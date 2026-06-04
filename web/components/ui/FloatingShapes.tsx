import { HEX, PASTELS } from "@/lib/pastels";

// A few large, soft pastel blobs drifting behind the content. Low opacity and
// sparse so it reads as atmosphere, not clutter. Pure CSS animation (no JS).
const SHAPES = [
  { id: "tl", top: "8%", left: "-6%", size: 220, radius: "blob", anim: "animate-float-slow" },
  { id: "bl", top: "62%", left: "4%", size: 150, radius: "blob2", anim: "animate-float" },
  { id: "tr", top: "12%", right: "-4%", size: 180, radius: "blob2", anim: "animate-float" },
  { id: "br", top: "70%", right: "2%", size: 240, radius: "blob", anim: "animate-float-slow" },
];

export function FloatingShapes() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {SHAPES.map((s, i) => {
        const pastel = PASTELS[i % PASTELS.length];
        return (
          <div
            key={s.id}
            className={s.anim}
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              right: s.right,
              width: s.size,
              height: s.size,
              background: HEX[pastel].fill,
              opacity: 0.32,
              borderRadius:
                s.radius === "blob"
                  ? "42% 58% 56% 44% / 50% 44% 56% 50%"
                  : "58% 42% 38% 62% / 44% 58% 42% 56%",
              filter: "blur(6px)",
            }}
          />
        );
      })}
    </div>
  );
}
