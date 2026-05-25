import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

export function useProfile() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nickname,referral_code,attendance_streak,last_attendance,has_seen_guide,tier")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useBalance() {
  const { user } = useSession();
  const qc = useQueryClient();
  const q = useQuery({
    enabled: !!user,
    queryKey: ["phon_balance", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("phon_balances")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`wallet:balance:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "phon_balances", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["phon_balance", user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return q;
}
