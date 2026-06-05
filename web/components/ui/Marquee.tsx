// An infinite horizontal scrolling banner (ink bar, cream chunky type).
export function Marquee({ items }: { items: string[] }) {
  return (
    <div className="relative overflow-hidden border-y-[3px] border-ink bg-ink py-2">
      <div className="flex w-max animate-marquee gap-6 whitespace-nowrap pr-6">
        {["a", "b"].map((copy) =>
          // repeat enough times that one half always exceeds the viewport width,
          // so the -50% loop is seamless with no visible end.
          ["r1", "r2", "r3", "r4"].map((rep) =>
            items.map((t) => (
              <span
                key={`${copy}-${rep}-${t}`}
                className="font-display text-sm font-black uppercase tracking-wider text-paper"
              >
                {t} <span className="text-coral">✦</span>
              </span>
            )),
          ),
        )}
      </div>
    </div>
  );
}
