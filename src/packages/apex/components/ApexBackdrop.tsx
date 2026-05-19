import { useEffect, useRef } from "react";

/** ApexBackdrop — neon particle field, 60fps cap, visibility-paused. */
export function ApexBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    const N = reduced ? 20 : 55;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25, vy: -0.1 - Math.random() * 0.4,
      r: 0.6 + Math.random() * 1.9, hue: Math.random() < 0.5 ? 152 : 300,
      a: 0.15 + Math.random() * 0.5,
    }));
    let raf = 0; let running = true;
    const onVis = () => { running = document.visibilityState === "visible"; if (running) raf = requestAnimationFrame(tick); };
    document.addEventListener("visibilitychange", onVis);
    function tick() {
      if (!running || !ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue},100%,60%,${p.a})`;
        ctx.shadowColor = `hsla(${p.hue},100%,55%,0.9)`;
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-70" />;
}
