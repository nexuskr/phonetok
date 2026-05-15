import { supabase } from "@/integrations/supabase/client";

export function isInvalidSessionError(error: unknown): boolean {
  const e = error as { code?: string; message?: string; status?: number; error_description?: string };
  const code = String(e?.code ?? "").toLowerCase();
  const message = String(e?.message ?? e?.error_description ?? "").toLowerCase();
  const status = Number(e?.status ?? 0);

  return (
    code === "bad_jwt" ||
    /bad_jwt|missing sub claim|invalid claim|invalid jwt|jwt.*invalid|invalid.*token|invalid refresh token|refresh token.*invalid/.test(message) ||
    ((status === 401 || status === 403) && /jwt|claim|token/.test(message))
  );
}

export async function clearBrokenLocalSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // noop
  }
}

export async function getVerifiedUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (isInvalidSessionError(error)) {
      await clearBrokenLocalSession();
    }
    return null;
  }

  return data.user ?? null;
}

export async function hasVerifiedSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    if (isInvalidSessionError(error)) {
      await clearBrokenLocalSession();
    }
    return false;
  }

  if (!data.session) {
    return false;
  }

  const user = await getVerifiedUser();
  return !!user?.id;
}