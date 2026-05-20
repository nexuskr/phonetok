/**
 * P0-7 — Deposit idempotency cache (client-side UX layer).
 *
 * Server enforces final dedup (submit_deposit / create_crypto_deposit_intent).
 * This layer prevents the user from double-submitting the same payload from
 * the same tab (or any tab, via the localStorage shared bucket) within 10 min.
 *
 * Money-flow guardrail: this module never calls money-flow RPCs.
 */

const STORAGE_PREFIX = "phonara:dep:idem:";
const TTL_MS = 10 * 60 * 1000;

export interface IdemRecord {
  key: string;
  hash: string;
  ts: number;
  status?: "pending" | "filled" | "expired" | "rejected";
}

export interface DepositPayloadLike {
  method: "coin" | "bank" | "voucher";
  amount: number;
  bankAccount?: string | null;
  voucherPin?: string | null;
  voucherBrand?: string | null;
}

/** SHA-256 first 8 bytes (16 hex) — fingerprint only, not a secret. */
export async function hashDepositPayload(p: DepositPayloadLike): Promise<string> {
  const canon = JSON.stringify({
    m: p.method,
    a: Math.round(Number(p.amount) || 0),
    b: (p.bankAccount ?? "").replace(/\D/g, ""),
    v: p.voucherPin ?? "",
    vb: p.voucherBrand ?? "",
  });
  try {
    const buf = new TextEncoder().encode(canon);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(digest).slice(0, 8);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0x811c9dc5;
    for (let i = 0; i < canon.length; i++) {
      h ^= canon.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
}

function read(scope: string): IdemRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + scope);
    if (!raw) return null;
    const rec = JSON.parse(raw) as IdemRecord;
    if (!rec?.ts || Date.now() - rec.ts > TTL_MS) {
      localStorage.removeItem(STORAGE_PREFIX + scope);
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

function write(scope: string, rec: IdemRecord) {
  try { localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(rec)); } catch { /* noop */ }
}

/**
 * Returns idempotency record for `scope`. Reuses key if a fresh (≤10min)
 * record with the same payload hash exists; otherwise mints a new UUID.
 */
export function getOrMintIdemKey(scope: string, payloadHash: string): IdemRecord {
  const existing = read(scope);
  if (existing && existing.hash === payloadHash) return existing;
  const key =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const rec: IdemRecord = { key, hash: payloadHash, ts: Date.now(), status: "pending" };
  write(scope, rec);
  return rec;
}

/** True iff a fresh record with same hash exists and is still pending. */
export function isDuplicateInFlight(scope: string, payloadHash: string): boolean {
  const rec = read(scope);
  if (!rec || rec.hash !== payloadHash) return false;
  return rec.status === "pending";
}

export function markIdemStatus(scope: string, status: NonNullable<IdemRecord["status"]>) {
  const rec = read(scope);
  if (!rec) return;
  rec.status = status;
  if (status === "filled" || status === "rejected") {
    rec.ts = Date.now() - TTL_MS + 5_000;
  }
  write(scope, rec);
}

export function markIdemConsumed(scope: string) {
  try { localStorage.removeItem(STORAGE_PREFIX + scope); } catch { /* noop */ }
}

export function peekIdem(scope: string): IdemRecord | null {
  return read(scope);
}

export function depositScope(userId: string | null | undefined, method: string): string {
  return `${userId ?? "anon"}:${method}`;
}
