// Lazy confetti burst — gold tone.
export async function rewardBurst() {
  try {
    const mod = await import("canvas-confetti");
    const confetti = mod.default;
    confetti({
      particleCount: 90,
      spread: 75,
      startVelocity: 38,
      ticks: 140,
      origin: { y: 0.6 },
      colors: ["#E8B923", "#FFD86B", "#FF4D8D", "#FFFFFF"],
      scalar: 1.05,
    });
  } catch { /* noop */ }
}
