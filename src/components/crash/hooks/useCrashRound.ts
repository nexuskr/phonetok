import { useEffect, useRef, useState } from "react";
import { getCurrentRound, type CurrentRound, liveMultiplier } from "@/lib/crash";

export function useCrashRound() {
  const [round, setRound] = useState<CurrentRound>({ status: "none" });
  const offsetRef = useRef(0);
  const [mult, setMult] = useState(1);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    const poll = async () => {
      try {
        const r = await getCurrentRound();
        if (!alive) return;
        if (r.server_time) offsetRef.current = Date.now() - new Date(r.server_time).getTime();
        setRound(r);
      } catch { /* noop */ }
    };
    void poll();
    const id = setInterval(poll, 1500);
    const tick = () => {
      setRound((cur) => {
        if (cur.status === "running" && cur.started_at) {
          const m = liveMultiplier(new Date(cur.started_at).getTime(), offsetRef.current);
          setMult(m);
        }
        return cur;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; clearInterval(id); cancelAnimationFrame(raf); };
  }, []);

  return { round, mult, refresh: getCurrentRound };
}
