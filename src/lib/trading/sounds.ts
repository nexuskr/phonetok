// Lightweight sound synthesis — no external assets needed.
let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
  }
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.18, when = 0) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export const sfx = {
  click: () => tone(820, 0.06, "square", 0.12),
  open:  () => { tone(440, 0.08, "triangle", 0.18); tone(660, 0.08, "triangle", 0.16, 0.05); },
  win:   () => {
    tone(523, 0.12, "triangle", 0.22, 0);
    tone(659, 0.12, "triangle", 0.22, 0.10);
    tone(784, 0.18, "triangle", 0.24, 0.20);
    tone(1046, 0.30, "triangle", 0.26, 0.34);
  },
  legendary: () => {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, "sawtooth", 0.20, i * 0.10));
    tone(1568, 0.5, "triangle", 0.28, 0.55);
  },
  loss:  () => { tone(220, 0.18, "sawtooth", 0.20); tone(110, 0.32, "sine", 0.24, 0.10); },
  liquidate: () => {
    tone(160, 0.25, "sawtooth", 0.28);
    tone(90, 0.55, "sine", 0.30, 0.12);
    tone(60, 0.7, "sine", 0.24, 0.30);
  },
  heartbeat: () => { tone(70, 0.08, "sine", 0.30); tone(70, 0.10, "sine", 0.22, 0.18); },
};
