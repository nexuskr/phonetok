// IMPERIAL-SINGULARITY v3.5-H: WebAudio thunder + convolution reverb.
// Procedural impulse response — no external assets.
import { useCallback, useRef } from "react";

let _ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
  }
  return _ctx;
}

function makeImpulse(ctx: AudioContext, seconds = 2.5, decay = 3.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buf;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export type ThunderIntensity = "soft" | "normal" | "mythic";

export function useImperialThunderWithReverb() {
  const irRef = useRef<AudioBuffer | null>(null);

  const strike = useCallback((intensity: ThunderIntensity = "normal") => {
    if (prefersReducedMotion()) return;
    const ctx = ac(); if (!ctx) return;
    const now = ctx.currentTime;
    if (!irRef.current) irRef.current = makeImpulse(ctx, intensity === "mythic" ? 3.6 : 2.2, 3.0);

    // Master + reverb
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.value = intensity === "mythic" ? 0.55 : 0.4;
    wetGain.gain.value = intensity === "mythic" ? 0.75 : 0.5;
    const convolver = ctx.createConvolver();
    convolver.buffer = irRef.current;

    // Noise burst (the lightning crack)
    const dur = intensity === "mythic" ? 1.6 : 0.9;
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 1.5);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(intensity === "mythic" ? 4200 : 2400, now);
    lp.frequency.exponentialRampToValueAtTime(180, now + dur);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, now);
    nGain.gain.exponentialRampToValueAtTime(intensity === "mythic" ? 0.9 : 0.55, now + 0.04);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    noise.connect(lp).connect(nGain);
    nGain.connect(dryGain);
    nGain.connect(convolver);

    // Sub-bass rumble
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(intensity === "mythic" ? 38 : 55, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + dur + 0.4);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.exponentialRampToValueAtTime(intensity === "mythic" ? 0.42 : 0.22, now + 0.12);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.4);
    sub.connect(sg).connect(dryGain);
    sub.connect(sg); sg.connect(convolver);

    convolver.connect(wetGain);
    dryGain.connect(ctx.destination);
    wetGain.connect(ctx.destination);

    noise.start(now); noise.stop(now + dur + 0.05);
    sub.start(now); sub.stop(now + dur + 0.45);
  }, []);

  return { strike };
}
