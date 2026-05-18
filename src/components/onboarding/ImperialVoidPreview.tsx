/**
 * Phase 4 P1 Hyperion — Imperial Void cosmetic preview.
 * Pure CSS — no three.js, no canvas. Layer-1 safe, 60fps even on low-end.
 */
export default function ImperialVoidPreview() {
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-xl border border-amber-400/20 bg-[radial-gradient(ellipse_at_center,hsl(45_90%_55%/0.18),transparent_60%),linear-gradient(180deg,hsl(45_60%_8%),hsl(0_0%_3%))]">
      <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_30%,hsl(45_100%_70%/0.45)_0,transparent_2px),radial-gradient(circle_at_70%_55%,hsl(35_100%_60%/0.4)_0,transparent_2px),radial-gradient(circle_at_45%_80%,hsl(45_100%_75%/0.35)_0,transparent_2px),radial-gradient(circle_at_85%_25%,hsl(45_100%_65%/0.4)_0,transparent_2px)]" />
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent animate-pulse" />
      <div className="relative z-10 flex h-full items-center justify-center">
        <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-xs font-bold tracking-[0.4em] text-transparent">
          IMPERIAL VOID · 입장 준비
        </span>
      </div>
    </div>
  );
}
