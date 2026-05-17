/**
 * HMAC-SHA512 결정적 RNG (Web Crypto subtle).
 * serverSeed + clientSeed||nonce → hex → [0,1) float.
 */
const enc = new TextEncoder();

async function hmacSha512(key: string, msg: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    // Test/SSR fallback — non-cryptographic but deterministic.
    let h = 0;
    const s = `${key}|${msg}`;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    const x = (h >>> 0).toString(16).padStart(8, "0");
    return (x + x + x + x + x + x + x + x).slice(0, 128);
  }
  const ck = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await window.crypto.subtle.sign("HMAC", ck, enc.encode(msg));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export interface RngResult {
  roll: number;       // [0,1)
  hmacHex: string;    // full hex
  rollHex: string;    // first 8 bytes
}

export async function rollHmac(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Promise<RngResult> {
  const hex = await hmacSha512(serverSeed, `${clientSeed}:${nonce}`);
  const slice = hex.slice(0, 16);
  const n = parseInt(slice, 16);
  const roll = n / 0xffffffffffffff;
  return { roll: Math.max(0, Math.min(0.9999999, roll)), hmacHex: hex, rollHex: slice };
}

export async function sha256Hex(input: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return input.slice(0, 64);
  const sig = await window.crypto.subtle.digest("SHA-256", enc.encode(input));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export function randomSeed(len = 32): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const a = new Uint8Array(len);
    window.crypto.getRandomValues(a);
    let h = "";
    for (let i = 0; i < a.length; i++) h += a[i].toString(16).padStart(2, "0");
    return h;
  }
  return Math.random().toString(16).slice(2).padEnd(len * 2, "0");
}
