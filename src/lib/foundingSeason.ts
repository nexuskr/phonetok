import { supabase } from "@/integrations/supabase/client";

export type FoundingSeasonAdminRow = {
  id: string;
  code: string;
  title: string;
  subtitle: string | null;
  total_seats: number;
  claimed: number;
  perks: string[] | any;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  settled_at: string | null;
};

export async function adminListFoundingSeasons() {
  const { data, error } = await supabase.rpc("admin_list_founding_seasons");
  if (error) throw error;
  return (data ?? []) as FoundingSeasonAdminRow[];
}

export async function adminCreateFoundingSeason(p: {
  code: string; title: string; subtitle: string; total: number;
  perks: string[]; ends_at: string | null;
}) {
  const { data, error } = await supabase.rpc("admin_create_founding_season", {
    _code: p.code, _title: p.title, _subtitle: p.subtitle,
    _total: p.total, _perks: p.perks as any, _ends_at: p.ends_at,
  });
  if (error) throw error;
  return data;
}

export async function adminUpdateFoundingSeason(p: {
  id: string; title?: string; subtitle?: string;
  perks?: string[]; ends_at: string | null;
}) {
  const { data, error } = await supabase.rpc("admin_update_founding_season", {
    _id: p.id, _title: p.title ?? null, _subtitle: p.subtitle ?? null,
    _perks: (p.perks ?? null) as any, _ends_at: p.ends_at,
  });
  if (error) throw error;
  return data;
}

export async function adminEndFoundingSeason(id: string) {
  const { data, error } = await supabase.rpc("admin_end_founding_season", { _id: id });
  if (error) throw error;
  return data;
}

export async function adminReleaseFoundingSeat(season_id: string, seat_no: number, reason: string) {
  const { data, error } = await supabase.rpc("admin_release_founding_seat", {
    _season_id: season_id, _seat_no: seat_no, _reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function getMyFoundingSeat(season_id?: string) {
  const { data, error } = await supabase.rpc("get_my_founding_seat", {
    _season_id: season_id ?? null,
  });
  if (error) throw error;
  return data as any;
}

export async function getMyFoundingSeatHistory(limit = 50) {
  const { data, error } = await supabase.rpc("get_my_founding_seat_history", { _limit: limit });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; season_id: string; season_code: string; season_title: string;
    seat_no: number | null; event_type: string; note: string | null;
    payload: any; created_at: string;
  }>;
}
