import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 튜토리얼/온보딩 진행 상태 저장 & 재개 훅
 * - 로그인 시: user_onboarding_progress 테이블 우선
 * - 비로그인: localStorage fallback
 * - 로그인 직후: 로컬 진행이 있고 DB가 비어있으면 머지
 */
export type OnboardingState = {
  step: number;
  data: Record<string, any>;
  completedAt: string | null;
  hydrated: boolean;
};

const LS_KEY = (flow: string) => `pm_onboarding_${flow}`;

export function useOnboardingFlow(flow: string) {
  const [state, setState] = useState<OnboardingState>({
    step: 0,
    data: {},
    completedAt: null,
    hydrated: false,
  });
  const userIdRef = useRef<string | null>(null);

  // hydrate
  useEffect(() => {
    let alive = true;
    (async () => {
      const local = (() => {
        try {
          const raw = localStorage.getItem(LS_KEY(flow));
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      })();

      const { data: { user } } = await supabase.auth.getUser();
      userIdRef.current = user?.id ?? null;

      if (user) {
        const { data: row } = await supabase
          .from("user_onboarding_progress")
          .select("step, data, completed_at")
          .eq("user_id", user.id)
          .eq("flow", flow)
          .maybeSingle();

        if (row) {
          if (!alive) return;
          setState({
            step: row.step ?? 0,
            data: (row.data as any) ?? {},
            completedAt: row.completed_at ?? null,
            hydrated: true,
          });
          return;
        }

        // DB empty + local exists → migrate
        if (local) {
          await supabase.from("user_onboarding_progress").upsert({
            user_id: user.id, flow,
            step: local.step ?? 0, data: local.data ?? {},
            completed_at: local.completedAt ?? null,
          });
          if (!alive) return;
          setState({ ...local, hydrated: true });
          return;
        }
      }

      if (!alive) return;
      setState(local
        ? { ...local, hydrated: true }
        : { step: 0, data: {}, completedAt: null, hydrated: true });
    })();
    return () => { alive = false; };
  }, [flow]);

  const persist = useCallback((next: Partial<OnboardingState>) => {
    setState((prev) => {
      const merged: OnboardingState = {
        step: next.step ?? prev.step,
        data: { ...prev.data, ...(next.data ?? {}) },
        completedAt: next.completedAt ?? prev.completedAt,
        hydrated: true,
      };
      try {
        localStorage.setItem(LS_KEY(flow), JSON.stringify({
          step: merged.step, data: merged.data, completedAt: merged.completedAt,
        }));
      } catch {/* */}
      const uid = userIdRef.current;
      if (uid) {
        void supabase.from("user_onboarding_progress").upsert({
          user_id: uid, flow,
          step: merged.step, data: merged.data,
          completed_at: merged.completedAt,
        });
      }
      return merged;
    });
  }, [flow]);

  const setStep = useCallback((step: number, data?: Record<string, any>) => {
    persist({ step, data });
  }, [persist]);

  const complete = useCallback((data?: Record<string, any>) => {
    persist({ completedAt: new Date().toISOString(), data });
  }, [persist]);

  const reset = useCallback(() => {
    try { localStorage.removeItem(LS_KEY(flow)); } catch {/* */}
    const uid = userIdRef.current;
    if (uid) {
      void supabase.from("user_onboarding_progress")
        .delete()
        .eq("user_id", uid).eq("flow", flow);
    }
    setState({ step: 0, data: {}, completedAt: null, hydrated: true });
  }, [flow]);

  return { ...state, setStep, complete, reset };
}
