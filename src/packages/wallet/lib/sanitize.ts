/**
 * sanitize — paste/input 정제 유틸. zero-width 제거 + trim.
 * 상품권 PIN / 지갑 주소 / 메모 입력 시 invisible char 누수 차단.
 */
const ZW = /[\u200B-\u200D\uFEFF\u00A0]/g;

export function sanitizeText(input: string): string {
  return input.replace(ZW, "").trim();
}

/** 모든 whitespace 제거 (PIN/주소 전용). */
export function sanitizeCompact(input: string): string {
  return input.replace(ZW, "").replace(/\s+/g, "");
}

export function sanitizeDigits(input: string, maxLen = 32): string {
  return sanitizeCompact(input).replace(/\D/g, "").slice(0, maxLen);
}

/** SHA-256 with user-scoped salt (v1). 24h TTL fraud throttle 용. */
export async function hashVoucherPin(pin: string, userId: string): Promise<string> {
  const enc = new TextEncoder().encode(`${pin}:${userId}:phonara-v1`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
