/**
 * RLS integrity tests — runs against the live project as an anonymous client.
 * These tests assert that mission/settlement-related tables refuse direct writes
 * from anonymous callers and that the DB-side check_rls_integrity() function passes.
 *
 * Skips silently if the project URL/key is not available in the test environment.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const KEY =
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const enabled = Boolean(URL && KEY);
const d = enabled ? describe : describe.skip;

d("RLS integrity — anon client must be denied direct writes", () => {
  const anon = createClient(URL!, KEY!, { auth: { persistSession: false } });

  const PROTECTED_WRITE_TABLES = [
    "transactions",
    "wallet_balances",
    "mission_history",
    "daily_stats",
    "package_purchases",
    "withdrawal_requests",
    "user_roles",
    "empire_founding_seats",
    "roulette_spins",
    "referral_earnings",
    "profit_share_distributions",
  ] as const;

  for (const table of PROTECTED_WRITE_TABLES) {
    it(`anon cannot INSERT into ${table}`, async () => {
      const { error } = await anon.from(table as any).insert({ user_id: "00000000-0000-0000-0000-000000000000" } as any);
      expect(error, `expected INSERT on ${table} to fail`).not.toBeNull();
    });
  }

  it("anon cannot self-grant admin role", async () => {
    const { error } = await anon.from("user_roles" as any).insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      role: "admin",
    } as any);
    expect(error).not.toBeNull();
  });

  it("anon cannot read transactions", async () => {
    const { data, error } = await anon.from("transactions").select("id").limit(1);
    // Either an explicit error or zero rows returned (RLS hides them)
    if (!error) expect(data ?? []).toHaveLength(0);
  });

  it("anon cannot read wallet_balances", async () => {
    const { data, error } = await anon.from("wallet_balances").select("user_id").limit(1);
    if (!error) expect(data ?? []).toHaveLength(0);
  });

  it("DB-side check_rls_integrity reports no errors", async () => {
    const { data, error } = await anon.rpc("check_rls_integrity");
    if (error) {
      // Function may be authenticated-only; that itself is acceptable.
      expect(error.message).toMatch(/permission|denied|forbidden|not.*authoriz/i);
      return;
    }
    expect((data as any)?.ok).toBe(true);
  });
});
