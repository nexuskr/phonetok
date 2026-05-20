// Phase 4 P4-D — VRF v2.5 oracle.
// Combines Drand (League of Entropy) public randomness with an Ed25519 server signature
// and the optional client seed → SHA-256 composed seed → recorded into apex_randomness_requests.
//
// MODES:
//   POST /apex-vrf-oracle  body { game, round_ref, client_seed? }  → sync attest (returns trace row)
//   POST /apex-vrf-oracle  body { mode: "backfill" }                → cron backfill (no-op stub for now)
//
// MONEY FLOW: 0 touch. Pure attestation layer; settlements happen elsewhere.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ED25519_SK_B64 = Deno.env.get("APEX_VRF_ED25519_SK") ?? "";

const DRAND_URLS = [
  "https://api.drand.sh/public/latest",
  "https://drand.cloudflare.com/public/latest",
];

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Ed25519 key handling ---
type KeySet = { sk: CryptoKey; pkB64: string };
let __keysCache: KeySet | null = null;

async function getKeys(): Promise<KeySet> {
  if (__keysCache) return __keysCache;
  if (ED25519_SK_B64) {
    try {
      // Expect pkcs8 base64
      const sk = await crypto.subtle.importKey(
        "pkcs8",
        b64decode(ED25519_SK_B64),
        "Ed25519",
        true,
        ["sign"],
      );
      // Derive public from a freshly-generated pair? pkcs8 has no public.
      // Instead, allow APEX_VRF_ED25519_PK to override; otherwise sign with sk and report pk as unknown.
      const pkB64 = Deno.env.get("APEX_VRF_ED25519_PK") ?? "";
      __keysCache = { sk, pkB64 };
      return __keysCache;
    } catch (e) {
      console.warn("[apex-vrf-oracle] invalid APEX_VRF_ED25519_SK, falling back to ephemeral:", e);
    }
  }
  // Ephemeral keypair (stable per cold start).
  const kp = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = await crypto.subtle.exportKey("raw", kp.publicKey);
  __keysCache = { sk: kp.privateKey, pkB64: b64encode(raw) };
  return __keysCache;
}

async function signEd25519(sk: CryptoKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign("Ed25519", sk, new TextEncoder().encode(message));
  return b64encode(sig);
}

async function fetchDrand(): Promise<{ round: number; randomness: string } | null> {
  for (const url of DRAND_URLS) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!r.ok) continue;
      const j = (await r.json()) as { round?: number; randomness?: string };
      if (typeof j.round === "number" && typeof j.randomness === "string") {
        return { round: j.round, randomness: j.randomness };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

async function attest(game: string, roundRef: string, clientSeed: string | null) {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const drand = await fetchDrand();
  if (!drand) return { ok: false, error: "drand_unavailable" as const };

  const { sk, pkB64 } = await getKeys();
  const payload = `${game}|${roundRef}|${drand.round}|${drand.randomness}|${clientSeed ?? ""}`;
  const sig = await signEd25519(sk, payload);
  const composed = await sha256Hex(`${drand.randomness}|${sig}|${clientSeed ?? ""}`);

  const { data, error } = await supabase.rpc("apex_record_randomness", {
    _game: game,
    _round_ref: roundRef,
    _drand_round: drand.round,
    _drand_randomness: drand.randomness,
    _server_signature: sig,
    _server_pubkey: pkB64,
    _client_seed: clientSeed,
    _composed_seed: composed,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    id: data as string,
    drand_round: drand.round,
    drand_randomness: drand.randomness,
    server_signature: sig,
    server_pubkey: pkB64,
    composed_seed: composed,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      mode?: string;
      game?: string;
      round_ref?: string;
      client_seed?: string;
    };

    if (body.mode === "backfill") {
      // Stub: future backfill walks recent crash rounds / play_history without attestation.
      return new Response(JSON.stringify({ ok: true, backfilled: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.game || !body.round_ref) {
      return new Response(JSON.stringify({ ok: false, error: "missing_game_or_round_ref" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out = await attest(body.game, body.round_ref, body.client_seed ?? null);
    return new Response(JSON.stringify(out), {
      status: out.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
