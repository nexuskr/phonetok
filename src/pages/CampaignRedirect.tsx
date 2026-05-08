import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const CACHE_PREFIX = "ugc:cr:";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30min — server still dedupes for 1h
const ANON_KEY = "ugc:anon_id";

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 64);
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function readCache(slug: string): string | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return null;
    const { url, exp } = JSON.parse(raw);
    if (typeof url !== "string" || typeof exp !== "number") return null;
    if (Date.now() > exp) return null;
    if (!/^https?:\/\//i.test(url)) return null;
    return url;
  } catch {
    return null;
  }
}

function writeCache(slug: string, url: string) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + slug,
      JSON.stringify({ url, exp: Date.now() + CACHE_TTL_MS }),
    );
  } catch {
    /* ignore */
  }
}

export default function CampaignRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug || !SLUG_RE.test(slug)) {
        setError("잘못된 캠페인 링크입니다.");
        return;
      }

      // Client cache fast path: if we already resolved this slug recently,
      // still ping the server (fire-and-forget) so the click counts, but
      // navigate immediately so users don't wait on a round-trip.
      const cached = readCache(slug);
      if (cached) {
        // Fire-and-forget click registration — server dedupes within 1h.
        void supabase.rpc("track_campaign_click", { _slug: slug, _anon_id: getAnonId() });
        window.location.replace(cached);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("track_campaign_click", {
          _slug: slug,
          _anon_id: getAnonId(),
        });
        if (cancelled) return;
        if (error) {
          setError("리다이렉트 중 오류가 발생했습니다.");
          return;
        }
        const url = typeof data === "string" ? data : null;
        if (!url || !/^https?:\/\//i.test(url)) {
          setError("캠페인을 찾을 수 없거나 비활성화되었습니다.");
          return;
        }
        writeCache(slug, url);
        window.location.replace(url);
      } catch {
        if (!cancelled) setError("네트워크 오류가 발생했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="glass rounded-2xl border border-border p-6 max-w-sm w-full text-center space-y-3">
        {!error ? (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <h1 className="font-display font-black text-lg">이동 중…</h1>
            <p className="text-xs text-muted-foreground font-mono break-all">/c/{slug}</p>
          </>
        ) : (
          <>
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
            <h1 className="font-display font-black text-lg">링크를 열 수 없어요</h1>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Link to="/" className="inline-block mt-2 text-xs text-primary underline">
              홈으로 돌아가기
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
