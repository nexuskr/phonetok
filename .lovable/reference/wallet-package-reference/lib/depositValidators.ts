/**
 * depositValidators — method별 최소금/PIN 형식 검증.
 */
import type { DepositMethod, VoucherBrand } from "@/lib/deposits-rpc";

export const DEPOSIT_MIN: Record<DepositMethod, number> = {
  coin: 10_000,
  bank: 10_000,
  voucher: 5_000,
};

export const VOUCHER_BRANDS: VoucherBrand[] = ["culture", "happy", "cultureland"];

export function validateAmount(method: DepositMethod, amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "amount_required";
  if (amount < DEPOSIT_MIN[method]) return "amount_below_min";
  return null;
}

export function validateVoucherPin(pin: string): string | null {
  const clean = pin.replace(/\D/g, "");
  if (clean.length < 16 || clean.length > 18) return "voucher_pin_invalid";
  return null;
}

/** 상태 우선순위 (L1): race-proof merge. */
export const DEPOSIT_STATUS_PRIORITY = {
  draft: 0,
  intent_created: 1,
  awaiting_payment: 2,
  matching: 3,
  manual_review: 4,
  expired: 5,
  filled: 6,
} as const;

export type DepositStatus = keyof typeof DEPOSIT_STATUS_PRIORITY;

export function statusPriority(s: string | null | undefined): number {
  if (!s) return 0;
  return (DEPOSIT_STATUS_PRIORITY as Record<string, number>)[s] ?? 0;
}

export function shouldOverwriteStatus(next: string, current: string): boolean {
  return statusPriority(next) >= statusPriority(current);
}

/** Telemetry amount band (PII 제외). */
export function amountBand(amount: number): "<50k" | "50k-200k" | "200k-1m" | "1m+" {
  if (amount < 50_000) return "<50k";
  if (amount < 200_000) return "50k-200k";
  if (amount < 1_000_000) return "200k-1m";
  return "1m+";
}
