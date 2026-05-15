// WinCelebrationManager — 싱글톤 pub/sub.
// triggerWin → tier 분류 → SoundManager.playWinSound + ducking + 화면 흔들림 + overlay state push.
// SSR-safe, 메모리 누수 방지, 단일 in-flight 보장.
import { soundManager } from "@/lib/sounds/SlotSoundManager";
import {
  classifyWinTier,
  TIER_DURATION_MS,
  type WinTier,
} from "@/lib/sounds/soundConfig";
import { SoundManager } from "@/lib/sound/SoundManager";

export interface CelebrationData {
  tier: WinTier;
  multiplier: number;
  totalWin: number;
  unitLabel: string;
  themeKey?: string; // "cosmic" 등 — themed extras
  startedAt: number;
  durationMs: number;
}

type Listener = (state: CelebrationData | null) => void;

const SSR = typeof window === "undefined";

class WinCelebrationManagerImpl {
  private current: CelebrationData | null = null;
  private listeners = new Set<Listener>();
  private autoEndTimer: number | null = null;
  private duckRestoreTimer: number | null = null;
  private prefersReduced = false;

  constructor() {
    if (!SSR) {
      try {
        this.prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", (e) => {
          this.prefersReduced = e.matches;
        });
      } catch { /* */ }
    }
  }

  classifyWinTier(multiplier: number): WinTier | null {
    return classifyWinTier(multiplier);
  }

  /** 메인 진입점. multiplier(=payout/bet) + total win. */
  triggerWin(
    multiplier: number,
    totalWin: number,
    opts: { unitLabel?: string; themeKey?: string } = {},
  ): WinTier | null {
    if (SSR) return null;
    const tier = classifyWinTier(multiplier);
    if (!tier) return null;
    this.cancelCurrent();
    const baseDuration = TIER_DURATION_MS[tier];
    const durationMs = this.prefersReduced ? Math.min(1800, baseDuration) : baseDuration;

    const data: CelebrationData = {
      tier,
      multiplier,
      totalWin,
      unitLabel: opts.unitLabel ?? "PHON",
      themeKey: opts.themeKey,
      startedAt: performance.now(),
      durationMs,
    };
    this.current = data;
    this.emit();
    this.playTierCelebration(data);

    // 자동 종료
    this.autoEndTimer = window.setTimeout(() => this.endCurrent(), durationMs);
    return tier;
  }

  private playTierCelebration(data: CelebrationData) {
    // 1) Sound — Win cue (자산 → procedural 자동 폴백)
    try { soundManager.playWinSound(data.tier, 1.0); } catch { /* */ }
    // 2) BGM ducking — -6dB (≈0.5x) 동안 cue 길이만큼
    try {
      SoundManager.setChannelVolume?.("bgm", 0.5);
      if (this.duckRestoreTimer) clearTimeout(this.duckRestoreTimer);
      this.duckRestoreTimer = window.setTimeout(() => {
        try { SoundManager.setChannelVolume?.("bgm", 1); } catch { /* */ }
        this.duckRestoreTimer = null;
      }, data.durationMs);
    } catch { /* */ }
    // 3) Screen shake intensity (CSS 변수)
    if (!this.prefersReduced) {
      const intensity = ({ big: 4, mega: 8, epic: 12, legendary: 18 } as const)[data.tier];
      try {
        document.documentElement.style.setProperty("--win-shake-px", `${intensity}px`);
        document.documentElement.classList.add("win-shake-active");
        window.setTimeout(() => {
          document.documentElement.classList.remove("win-shake-active");
        }, Math.min(900, data.durationMs * 0.4));
      } catch { /* */ }
    }
  }

  /** 사용자가 클릭하거나 슬롯이 다음 스핀을 시작할 때. */
  endCurrent() {
    if (!this.current) return;
    this.current = null;
    if (this.autoEndTimer) { clearTimeout(this.autoEndTimer); this.autoEndTimer = null; }
    if (this.duckRestoreTimer) {
      clearTimeout(this.duckRestoreTimer);
      this.duckRestoreTimer = null;
      try { SoundManager.setChannelVolume?.("bgm", 1); } catch { /* */ }
    }
    if (!SSR) {
      try { document.documentElement.classList.remove("win-shake-active"); } catch { /* */ }
    }
    this.emit();
  }

  /** 슬롯 변경/언마운트 시. */
  cancelCurrent() {
    this.endCurrent();
  }

  getCurrent() { return this.current; }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit() {
    for (const fn of this.listeners) {
      try { fn(this.current); } catch { /* */ }
    }
  }
}

export const WinCelebrationManager = new WinCelebrationManagerImpl();
export type { WinTier };
