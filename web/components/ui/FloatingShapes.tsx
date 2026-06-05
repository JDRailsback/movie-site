import { Burst, Sparkle, Star } from "@/components/ui/Doodads";
import { HEX, PASTELS } from "@/lib/pastels";

// Big soft pastel blobs + scattered spinning doodads drifting behind everything.
const BLOBS = [
  { id: "b1", top: "5%", left: "-5%", size: 240, anim: "animate-float-slow" },
  { id: "b2", top: "55%", left: "-7%", size: 180, anim: "animate-wobble" },
  { id: "b3", top: "8%", left: "92%", size: 200, anim: "animate-float" },
  { id: "b4", top: "68%", left: "88%", size: 260, anim: "animate-float-slow" },
  { id: "b5", top: "38%", left: "45%", size: 150, anim: "animate-wobble" },
];

// Kept to the far side margins so they never peek through tile corners.
const DOODADS = [
  {
    id: "d1",
    top: "13%",
    left: "2.5%",
    el: <Star className="text-4xl" />,
    anim: "animate-spin-slow",
  },
  {
    id: "d2",
    top: "30%",
    left: "96%",
    el: <Sparkle className="text-5xl" fill="#5DC59C" />,
    anim: "animate-float",
  },
  {
    id: "d3",
    top: "55%",
    left: "1.5%",
    el: <Burst className="text-4xl" fill="#F49AC1" />,
    anim: "animate-spin-slow",
  },
  {
    id: "d4",
    top: "82%",
    left: "95%",
    el: <Star className="text-3xl" fill="#6FACDA" />,
    anim: "animate-wobble",
  },
  {
    id: "d5",
    top: "78%",
    left: "3%",
    el: <Sparkle className="text-4xl" fill="#9F86E2" />,
    anim: "animate-spin-slow",
  },
  {
    id: "d6",
    top: "40%",
    left: "97%",
    el: <Burst className="text-3xl" fill="#F3C53A" />,
    anim: "animate-float",
  },
];

export function FloatingShapes() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {BLOBS.map((s, i) => (
        <div
          key={s.id}
          className={s.anim}
          style={{
            position: "absolute",
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            background: HEX[PASTELS[i % PASTELS.length]].fill,
            opacity: 0.38,
            borderRadius:
              i % 2 === 0
                ? "42% 58% 56% 44% / 50% 44% 56% 50%"
                : "58% 42% 38% 62% / 44% 58% 42% 56%",
            filter: "blur(5px)",
          }}
        />
      ))}
      {DOODADS.map((d) => (
        <div
          key={d.id}
          className={d.anim}
          style={{ position: "absolute", top: d.top, left: d.left, opacity: 0.45 }}
        >
          {d.el}
        </div>
      ))}
    </div>
  );
}
