/**
 * Imperial notification thresholds (PHON 베이스).
 * 잭팟·대형 승리·청산·큰 출금 등 강력 알림 컷오프 한 곳에서 관리.
 */
export const JACKPOT_MIN_PHON = 50_000;
export const BIG_WIN_MIN_PHON = 10_000;
export const LIQ_LOSS_MIN_PHON = 5_000;
export const WITHDRAW_BIG_PHON = 100_000;
export const DEPOSIT_BIG_PHON = 100_000;

export type WinClass = "jackpot" | "big" | "normal" | "small";

export function classifyWinAmount(amountPhon: number): WinClass {
  if (amountPhon >= JACKPOT_MIN_PHON) return "jackpot";
  if (amountPhon >= BIG_WIN_MIN_PHON) return "big";
  if (amountPhon >= 1_000) return "normal";
  return "small";
}

export function classifyLossAmount(amountPhon: number): "liq" | "loss" | "small" {
  const abs = Math.abs(amountPhon);
  if (abs >= LIQ_LOSS_MIN_PHON) return "liq";
  if (abs >= 1_000) return "loss";
  return "small";
}
