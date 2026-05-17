/**
 * Phase D Slice 2 — Device tier 판정.
 * low : Shader OFF / InstancedMesh OFF / 2D SVG fallback / MAX 60
 * mid : Instanced ON, shader 단순, MAX 100, dpr 1.5
 * high: Instanced ON, shader full, MAX 160, dpr 2
 */
export type DeviceTier = "low" | "mid" | "high";

interface NavExt {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  userAgent?: string;
}

let cached: DeviceTier | null = null;

export function detectDeviceTier(): DeviceTier {
  if (cached) return cached;
  if (typeof window === "undefined") return "mid";
  const n = navigator as unknown as NavExt;
  const ua = n.userAgent ?? "";
  const cores = n.hardwareConcurrency ?? 8;
  const mem = n.deviceMemory ?? 8;
  const dpr = window.devicePixelRatio ?? 1;

  // iPhone <=11 / Galaxy A 시리즈 강제 low
  const iphoneOld = /iPhone\s*OS\s*1[0-3]_/.test(ua) || /iPhone\s+(8|X|11)/i.test(ua);
  const galaxyA = /SM-A\d{3}/.test(ua);

  if (iphoneOld || galaxyA || cores <= 4 || mem <= 4 || dpr < 2) {
    cached = "low";
    return cached;
  }
  if (cores <= 6 || mem <= 6) {
    cached = "mid";
    return cached;
  }
  cached = "high";
  return cached;
}

export function maxAvatarsForTier(t: DeviceTier): number {
  return t === "low" ? 60 : t === "mid" ? 100 : 160;
}

export function dprForTier(t: DeviceTier): [number, number] {
  return t === "low" ? [1, 1] : t === "mid" ? [1, 1.5] : [1, 2];
}
