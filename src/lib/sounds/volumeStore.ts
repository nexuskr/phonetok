// localStorage volume persistence + cross-tab sync.
// Single source of truth for master / sfx / bgm / voice / muted / reducedMotionRespect.
import { Howler } from "howler";
import { SoundManager } from "@/lib/sound/SoundManager";

const KEY_V1 = "phonara:sound_volume:v1";
const KEY = "phonara:audio:v2";

export interface VolumeState {
  master: number; // 0..1
  sfx: number;    // 0..1
  bgm: number;    // 0..1
  voice: number;  // 0..1
  muted: boolean;
  /** prefers-reduced-motion 일 때 voice 채널을 자동 mute. */
  reducedMotionRespect: boolean;
}

const DEFAULTS: VolumeState = {
  master: 0.8,
  sfx: 1.0,
  bgm: 0.6,
  voice: 0.95,
  muted: false,
  reducedMotionRespect: true,
};

const SSR = typeof window === "undefined";

function clamp(n: number) { return Math.max(0, Math.min(1, n)); }

function read(): VolumeState {
  if (SSR) return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        master: typeof p.master === "number" ? clamp(p.master) : DEFAULTS.master,
        sfx: typeof p.sfx === "number" ? clamp(p.sfx) : DEFAULTS.sfx,
        bgm: typeof p.bgm === "number" ? clamp(p.bgm) : DEFAULTS.bgm,
        voice: typeof p.voice === "number" ? clamp(p.voice) : DEFAULTS.voice,
        muted: !!p.muted,
        reducedMotionRespect: p.reducedMotionRespect !== false,
      };
    }
    // v1 마이그레이션
    const legacy = window.localStorage.getItem(KEY_V1);
    if (legacy) {
      const p = JSON.parse(legacy);
      return {
        master: typeof p.master === "number" ? clamp(p.master) : DEFAULTS.master,
        sfx: typeof p.sfx === "number" ? clamp(p.sfx) : DEFAULTS.sfx,
        bgm: typeof p.bgm === "number" ? clamp(p.bgm) : DEFAULTS.bgm,
        voice: DEFAULTS.voice,
        muted: !!p.muted,
        reducedMotionRespect: true,
      };
    }
    return { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

let state: VolumeState = read();
const listeners = new Set<(s: VolumeState) => void>();

function persist() {
  if (SSR) return;
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* */ }
}

function applyToEngines() {
  if (SSR) return;
  try { Howler.volume(state.master); } catch { /* */ }
  try { SoundManager.setMasterVolume?.(state.master); } catch { /* */ }
  try { SoundManager.setChannelVolume?.("bgm", state.bgm); } catch { /* */ }
  for (const ch of ["reel", "stop", "win", "bigwin", "scatter", "bonus_trigger", "bonus_loop", "mech"] as const) {
    try { SoundManager.setChannelVolume?.(ch, state.sfx); } catch { /* */ }
  }
  try { SoundManager.setChannelVolume?.("vo", state.voice); } catch { /* */ }
  try { SoundManager.setMuted(state.muted); } catch { /* */ }
}

function emit() {
  for (const fn of listeners) { try { fn(state); } catch { /* */ } }
}

export const volumeStore = {
  get(): VolumeState { return { ...state }; },
  set(patch: Partial<VolumeState>) {
    state = {
      master: patch.master !== undefined ? clamp(patch.master) : state.master,
      sfx: patch.sfx !== undefined ? clamp(patch.sfx) : state.sfx,
      bgm: patch.bgm !== undefined ? clamp(patch.bgm) : state.bgm,
      voice: patch.voice !== undefined ? clamp(patch.voice) : state.voice,
      muted: patch.muted !== undefined ? !!patch.muted : state.muted,
      reducedMotionRespect:
        patch.reducedMotionRespect !== undefined
          ? !!patch.reducedMotionRespect
          : state.reducedMotionRespect,
    };
    persist();
    applyToEngines();
    emit();
  },
  subscribe(fn: (s: VolumeState) => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  hydrate() { applyToEngines(); emit(); },
};

if (!SSR) {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const p = JSON.parse(e.newValue);
      state = {
        master: clamp(p.master ?? DEFAULTS.master),
        sfx: clamp(p.sfx ?? DEFAULTS.sfx),
        bgm: clamp(p.bgm ?? DEFAULTS.bgm),
        voice: clamp(p.voice ?? DEFAULTS.voice),
        muted: !!p.muted,
        reducedMotionRespect: p.reducedMotionRespect !== false,
      };
      applyToEngines();
      emit();
    } catch { /* */ }
  });
  applyToEngines();
}
