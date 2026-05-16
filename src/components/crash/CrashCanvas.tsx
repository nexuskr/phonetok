import { useEffect, useRef } from "react";

interface Props {
  multiplier: number;
  status: "none" | "pending" | "running" | "crashed";
  crashedAt?: number | null;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; }

export default function CrashCanvas({ multiplier, status, crashedAt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ multiplier, status, crashedAt, particles: [] as Particle[], stars: [] as { x: number; y: number; z: number }[], t: 0, crashFlash: 0 });

  useEffect(() => { stateRef.current.multiplier = multiplier; }, [multiplier]);
  useEffect(() => {
    stateRef.current.status = status;
    if (status === "crashed") stateRef.current.crashFlash = 1;
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lowEnd = dpr < 2 && window.innerWidth < 480;
    const particleCap = lowEnd ? 40 : 80;
    let raf = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Stars
    stateRef.current.stars = Array.from({ length: lowEnd ? 50 : 100 }, () => ({
      x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7,
    }));

    const lerpColor = (m: number) => {
      // 1→3 gold, 3→10 orange, 10+ pink
      if (m < 3) return [255, 196, 80];
      if (m < 10) {
        const t = (m - 3) / 7;
        return [255, Math.round(196 - 96 * t), Math.round(80 - 50 * t)];
      }
      return [255, 80, 140];
    };

    const draw = () => {
      const w = canvas.width / dpr, h = canvas.height / dpr;
      const s = stateRef.current;
      s.t += 1;

      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "hsl(240 40% 6%)");
      grad.addColorStop(1, "hsl(260 30% 3%)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stars (parallax)
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (const star of s.stars) {
        const sx = (star.x * w + s.t * 0.1 * star.z) % w;
        const sy = (star.y * h) % h;
        ctx.globalAlpha = 0.3 + star.z * 0.5;
        ctx.fillRect(sx, sy, star.z * 1.5, star.z * 1.5);
      }
      ctx.globalAlpha = 1;

      // Rocket position
      const m = Math.max(1, s.multiplier);
      const progress = Math.min(1, Math.log(m) / Math.log(20));
      const rocketX = 60 + progress * (w - 120);
      const rocketY = h - 80 - progress * (h - 160);

      // Trail curve
      const [r, g, b] = lerpColor(m);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.6)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(60, h - 80);
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const px = 60 + t * (rocketX - 60);
        const py = (h - 80) + t * (rocketY - (h - 80));
        ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Spawn particles on running
      if (s.status === "running" && s.particles.length < particleCap && s.t % 2 === 0) {
        s.particles.push({
          x: rocketX, y: rocketY,
          vx: -1.5 - Math.random() * 1.5, vy: 1 + Math.random() * 1.5,
          life: 0, max: 30 + Math.random() * 20,
        });
      }

      // Draw + update particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        const a = 1 - p.life / p.max;
        if (a <= 0) { s.particles.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.8})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * a + 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rocket body
      ctx.save();
      ctx.translate(rocketX, rocketY);
      ctx.rotate(-Math.PI / 4);
      ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(8, 10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Crash flash
      if (s.crashFlash > 0) {
        ctx.fillStyle = `rgba(255,200,80,${s.crashFlash * 0.5})`;
        ctx.fillRect(0, 0, w, h);
        s.crashFlash -= 0.04;
        // Explosion particles
        if (s.crashFlash > 0.9 && s.particles.length < particleCap) {
          for (let i = 0; i < 12; i++) {
            const ang = Math.random() * Math.PI * 2;
            s.particles.push({
              x: rocketX, y: rocketY,
              vx: Math.cos(ang) * (2 + Math.random() * 4),
              vy: Math.sin(ang) * (2 + Math.random() * 4),
              life: 0, max: 40 + Math.random() * 30,
            });
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full aspect-[16/10] rounded-2xl border border-border/40"
      style={{ background: "hsl(240 40% 5%)" }}
    />
  );
}
