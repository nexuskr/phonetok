// SugarFeverCanvas — "Warm Sugar Luxury" candy world background.
// Pastel pink + warm gold + mint + strawberry red + creamy white.
// Zero overlap with Olympus visual language: no marble, no pillars, no
// lightning, no deep night blue. Pure candy dessert buffet.
//
// Layers (back → front):
//   1. Creamy pink → warm gold vertical wash (no cocoa, no berry darkness)
//   2. Mint radial mist top + strawberry radial halo bottom
//   3. Soft sugar clouds (2 parallax layers, pastel pink/cream)
//   4. Macaron tower silhouettes (replaces marble pillars)
//   5. Chocolate drip ribbon hanging from the top edge
//   6. Floating wrapped candies (rotating, drifting up)
//   7. Sugar sparkle field (gentle twinkle)
//
// Performance contract (Musk mode):
//  - Single RAF loop via useAnimatedCanvas (DPR cap / 60fps / pause on hidden)
//  - All counts auto-throttled on viewports <640px
//  - prefers-reduced-motion → static warm candy gradient via drawStaticFn
//  - Zero per-frame object allocations beyond gradient handles

import { useAnimatedCanvas, ANIMATED_CANVAS_STYLE } from "@/hooks/useAnimatedCanvas";

// ── Warm Sugar Luxury palette (creamy, never dark, never cold) ───────────────
const COLOR_CREAM_TOP    = "rgba(255,228,232,1)";   // creamy strawberry milk
const COLOR_CREAM_BOT    = "rgba(248,200,160,1)";   // warm gold caramel
const COLOR_PINK_HALO    = "rgba(255,182,193,0.55)"; // #FFB6C1 soft pink
const COLOR_STRAW_HALO   = "rgba(255,107,122,0.32)"; // #FF6B7A strawberry
const COLOR_GOLD_HALO    = "rgba(248,200,160,0.45)"; // #F8C8A0 warm gold
const COLOR_MINT_HALO    = "rgba(178,240,216,0.42)"; // #B2F0D8 mint
const COLOR_CREAM        = "rgba(255,245,235,0.55)"; // creamy white

// Candy wrappers (each floating candy picks one)
const CANDY_COLORS = [
  "#ffb6c1", // pastel pink
  "#f8c8a0", // warm gold
  "#b2f0d8", // mint
  "#ff6b7a", // strawberry red
  "#fff5eb", // creamy white
  "#ffd9e6", // marshmallow pink
];

// ── Tunables ─────────────────────────────────────────────────────────────────
const CLOUD_FAR  = { count: 4, vx: 0.010, blur: 38, alpha: 0.55 };
const CLOUD_NEAR = { count: 3, vx: 0.024, blur: 22, alpha: 0.55 };
const SPARKLE_COUNT_DESKTOP = 70;
const SPARKLE_COUNT_MOBILE  = 32;
const CANDY_COUNT_DESKTOP   = 16;
const CANDY_COUNT_MOBILE    = 8;
const MACARON_COUNT         = 3;

interface Cloud {
  x: number; y: number;
  rx: number; ry: number;
  vx: number; alpha: number;
  hueA: string; hueB: string;
}
interface Sparkle {
  x: number; y: number;
  r: number; phase: number; speed: number;
}
interface Candy {
  x: number; y: number;
  r: number; vy: number; vx: number;
  spin: number; spinV: number;
  color: string;
  kind: 0 | 1 | 2; // 0 = wrapped, 1 = swirl disc, 2 = lollipop
}
interface MacaronTower {
  cx: number; baseY: number; w: number;
  topColor: string; midColor: string; botColor: string;
}
interface State {
  far: Cloud[]; near: Cloud[];
  sparkles: Sparkle[]; candies: Candy[];
  macarons: MacaronTower[];
  chocCrest: number[];   // chocolate drip crest y-offsets across the top
  chocPhase: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function SugarFeverCanvas({ className = "" }: { className?: string }) {
  const ref = useAnimatedCanvas<State>(
    (_ctx, w, h) => {
      const isMobile = w < 640;
      const sparkleCount = isMobile ? SPARKLE_COUNT_MOBILE : SPARKLE_COUNT_DESKTOP;
      const candyCount   = isMobile ? CANDY_COUNT_MOBILE   : CANDY_COUNT_DESKTOP;

      // pastel clouds — pink↔cream and gold↔mint pairs
      const seedClouds = (cfg: typeof CLOUD_FAR): Cloud[] => {
        const arr: Cloud[] = [];
        for (let i = 0; i < cfg.count; i++) {
          const pair = Math.random() < 0.5
            ? { a: "rgba(255,228,232,0.85)", b: "rgba(255,182,193,0.0)" }
            : { a: "rgba(255,245,235,0.85)", b: "rgba(248,200,160,0.0)" };
          arr.push({
            x: Math.random() * w,
            y: rand(h * 0.05, h * 0.55),
            rx: rand(w * 0.22, w * 0.42),
            ry: rand(h * 0.07, h * 0.16),
            vx: cfg.vx * (0.85 + Math.random() * 0.3),
            alpha: cfg.alpha * (0.85 + Math.random() * 0.3),
            hueA: pair.a, hueB: pair.b,
          });
        }
        return arr;
      };

      const sparkles: Sparkle[] = [];
      for (let i = 0; i < sparkleCount; i++) {
        sparkles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: rand(0.7, 2.0),
          phase: Math.random() * Math.PI * 2,
          speed: rand(0.0009, 0.0024),
        });
      }

      const candies: Candy[] = [];
      for (let i = 0; i < candyCount; i++) {
        candies.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: rand(7, 14),
          vy: rand(-0.10, -0.26),
          vx: rand(-0.04, 0.04),
          spin: Math.random() * Math.PI * 2,
          spinV: rand(-0.005, 0.005),
          color: pick(CANDY_COLORS),
          kind: Math.floor(Math.random() * 3) as 0 | 1 | 2,
        });
      }

      // 3 macaron towers along the bottom — replaces marble pillars
      const macarons: MacaronTower[] = [];
      const mw = Math.max(56, w * 0.10);
      for (let i = 0; i < MACARON_COUNT; i++) {
        macarons.push({
          cx: w * (0.18 + (0.64 * i) / (MACARON_COUNT - 1)),
          baseY: h * 0.94,
          w: mw,
          topColor: pick(CANDY_COLORS),
          midColor: pick(CANDY_COLORS),
          botColor: pick(CANDY_COLORS),
        });
      }

      // chocolate drip — crest array of y-offsets along the top edge
      const crestSegments = 18;
      const chocCrest: number[] = [];
      for (let i = 0; i <= crestSegments; i++) {
        chocCrest.push(rand(0.6, 1.0)); // 0..1 multiplier of base drip height
      }

      return {
        far: seedClouds(CLOUD_FAR),
        near: seedClouds(CLOUD_NEAR),
        sparkles, candies, macarons,
        chocCrest, chocPhase: 0,
      };
    },
    (ctx, w, h, t, state) => {
      // 1) creamy pastel vertical wash — strawberry milk → caramel gold
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0,    COLOR_CREAM_TOP);
      base.addColorStop(0.55, "rgba(255,217,206,1)");
      base.addColorStop(1,    COLOR_CREAM_BOT);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      // 2) mint mist top + strawberry halo bottom + pink halo center
      const mistTop = ctx.createRadialGradient(
        w * 0.5, h * -0.05, 0,
        w * 0.5, h * -0.05, Math.max(w, h) * 0.7,
      );
      mistTop.addColorStop(0,   COLOR_MINT_HALO);
      mistTop.addColorStop(0.6, COLOR_CREAM);
      mistTop.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = mistTop;
      ctx.fillRect(0, 0, w, h);

      const haloBot = ctx.createRadialGradient(
        w * 0.5, h * 1.02, 0,
        w * 0.5, h * 1.02, Math.max(w, h) * 0.85,
      );
      haloBot.addColorStop(0,    COLOR_STRAW_HALO);
      haloBot.addColorStop(0.55, COLOR_GOLD_HALO);
      haloBot.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = haloBot;
      ctx.fillRect(0, 0, w, h);

      const haloMid = ctx.createRadialGradient(
        w * 0.5, h * 0.5, 0,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.55,
      );
      haloMid.addColorStop(0, COLOR_PINK_HALO);
      haloMid.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = haloMid;
      ctx.fillRect(0, 0, w, h);

      // 3) sugar clouds — far + near, blurred pastel cream/pink
      const drawClouds = (clouds: Cloud[], blurPx: number) => {
        ctx.save();
        ctx.filter = `blur(${blurPx}px)`;
        for (const c of clouds) {
          c.x += c.vx;
          if (c.x - c.rx > w) c.x = -c.rx;
          else if (c.x + c.rx < 0) c.x = w + c.rx;
          const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.rx);
          g.addColorStop(0, c.hueA);
          g.addColorStop(0.7, c.hueB);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.globalAlpha = c.alpha;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      };
      drawClouds(state.far,  CLOUD_FAR.blur);
      drawClouds(state.near, CLOUD_NEAR.blur);

      // 4) chocolate drip ribbon along the top — hand-drawn molten chocolate
      //    crest values are stable; we just wobble the lower edge slightly via time.
      const dripBase = Math.min(46, h * 0.07);
      ctx.save();
      const chocGrad = ctx.createLinearGradient(0, 0, 0, dripBase * 2.4);
      chocGrad.addColorStop(0,   "rgba(96, 56, 36, 0.92)");
      chocGrad.addColorStop(0.6, "rgba(140, 84, 54, 0.90)");
      chocGrad.addColorStop(1,   "rgba(176,112, 72, 0.65)");
      ctx.fillStyle = chocGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      const segs = state.chocCrest.length - 1;
      ctx.lineTo(w, dripBase * state.chocCrest[segs]);
      for (let i = segs; i >= 0; i--) {
        const x = (w * i) / segs;
        const wobble = Math.sin(t * 0.0006 + i * 0.7) * 2.5;
        const y = dripBase * state.chocCrest[i] + wobble;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      // glossy highlight band
      ctx.fillStyle = "rgba(255,230,210,0.18)";
      ctx.fillRect(0, dripBase * 0.25, w, 2);
      ctx.restore();

      // 5) macaron towers — three pastel discs stacked (replaces pillars)
      for (const m of state.macarons) {
        const discW = m.w;
        const discH = m.w * 0.45;
        const gap = discH * 0.55;
        const colors = [m.botColor, m.midColor, m.topColor];
        for (let i = 0; i < 3; i++) {
          const cy = m.baseY - i * (discH + gap);
          // shell
          ctx.save();
          ctx.globalAlpha = 0.55;
          const g = ctx.createLinearGradient(0, cy - discH / 2, 0, cy + discH / 2);
          g.addColorStop(0, colors[i]);
          g.addColorStop(1, "rgba(255,255,255,0.4)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(m.cx, cy, discW / 2, discH / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          // cream filling line
          ctx.fillStyle = "rgba(255,245,235,0.55)";
          ctx.fillRect(m.cx - discW / 2 + 3, cy + discH / 2 - 2, discW - 6, 3);
          ctx.restore();
        }
      }

      // 6) floating candies — wrapped, swirl disc, mini lollipops
      for (const c of state.candies) {
        c.x += c.vx;
        c.y += c.vy;
        c.spin += c.spinV;
        if (c.y + c.r < 0) { c.y = h + c.r; c.x = Math.random() * w; }
        if (c.x < -c.r) c.x = w + c.r;
        else if (c.x > w + c.r) c.x = -c.r;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.spin);

        if (c.kind === 0) {
          // wrapped candy: oval body + two triangular wrapper ends
          const bw = c.r * 1.7;
          const bh = c.r;
          // wrapper ends
          ctx.fillStyle = c.color;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.moveTo(-bw, -bh * 0.7); ctx.lineTo(-bw * 0.55, 0); ctx.lineTo(-bw, bh * 0.7); ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo( bw,  bh * 0.7); ctx.lineTo( bw * 0.55, 0); ctx.lineTo( bw, -bh * 0.7); ctx.closePath();
          ctx.fill();
          // body
          const bg = ctx.createLinearGradient(0, -bh, 0, bh);
          bg.addColorStop(0, "rgba(255,255,255,0.85)");
          bg.addColorStop(1, c.color);
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.ellipse(0, 0, bw * 0.55, bh, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (c.kind === 1) {
          // swirl disc
          ctx.globalAlpha = 0.85;
          const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, c.r);
          sg.addColorStop(0, "rgba(255,255,255,0.9)");
          sg.addColorStop(0.55, c.color);
          sg.addColorStop(1, "rgba(255,255,255,0.0)");
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(0, 0, c.r, 0, Math.PI * 2);
          ctx.fill();
          // 4-arm pinwheel hint
          ctx.strokeStyle = "rgba(255,107,122,0.55)";
          ctx.lineWidth = 1.4;
          for (let a = 0; a < 4; a++) {
            ctx.beginPath();
            ctx.arc(0, 0, c.r * 0.65, a * Math.PI / 2, a * Math.PI / 2 + 0.9);
            ctx.stroke();
          }
        } else {
          // mini lollipop — disc + short stick
          ctx.globalAlpha = 0.9;
          const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, c.r);
          lg.addColorStop(0, "rgba(255,255,255,0.95)");
          lg.addColorStop(0.6, c.color);
          lg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.arc(0, 0, c.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,245,235,0.9)";
          ctx.fillRect(-c.r * 0.10, c.r * 0.4, c.r * 0.20, c.r * 1.4);
        }
        // shared glossy highlight
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(-c.r * 0.4, -c.r * 0.4, c.r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 7) sugar sparkle field — twinkles via sin(phase)
      ctx.fillStyle = "rgba(255,250,240,1)";
      for (const s of state.sparkles) {
        const a = 0.30 + 0.55 * (0.5 + 0.5 * Math.sin(s.phase + t * s.speed));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    {
      // prefers-reduced-motion → static creamy pastel composition
      drawStaticFn: (ctx, w, h) => {
        const base = ctx.createLinearGradient(0, 0, 0, h);
        base.addColorStop(0,    COLOR_CREAM_TOP);
        base.addColorStop(0.55, "rgba(255,217,206,1)");
        base.addColorStop(1,    COLOR_CREAM_BOT);
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
        const halo = ctx.createRadialGradient(
          w * 0.5, h * 0.5, 0,
          w * 0.5, h * 0.5, Math.max(w, h) * 0.6,
        );
        halo.addColorStop(0, COLOR_PINK_HALO);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
      },
    },
  );

  return <canvas ref={ref} aria-hidden className={className} style={ANIMATED_CANVAS_STYLE} />;
}
