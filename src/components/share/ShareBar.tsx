import { useState } from "react";
import { Share2, Link2, Check } from "lucide-react";
import { notify } from "@/lib/notify";
import { track } from "@/lib/analytics";

type Props = {
  url?: string;
  title?: string;
  text?: string;
  className?: string;
};

/**
 * Multi-platform share bar — KakaoTalk(link copy fallback), X, LINE, native share, copy.
 * No external SDKs required. Korean-first ordering.
 */
export default function ShareBar({
  url,
  title = "폰 하나로 세우는 지구 단위 AI 제국 · Phonara",
  text = "1만 8천 명 규모 시뮬레이션 제국. 첫 충전 +30% 보너스 받기.",
  className = "",
}: Props) {
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.origin : "https://phonara.world");
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      setCopied(true);
      notify.success("링크가 복사되었습니다");
      track("share", { channel: "copy_link" });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      notify.error("복사 실패");
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try { await navigator.share({ title, text, url: shareUrl }); track("share", { channel: "native" }); } catch {}
    } else {
      copyLink();
    }
  }

  const enc = encodeURIComponent;
  const xUrl = `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(shareUrl)}`;
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${enc(shareUrl)}&text=${enc(text)}`;

  const btnBase =
    "press min-h-[40px] min-w-[40px] px-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold inline-flex items-center justify-center gap-1.5";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button onClick={copyLink} className={btnBase} aria-label="링크 복사">
        {copied ? <Check className="w-3.5 h-3.5 text-secondary" /> : <Link2 className="w-3.5 h-3.5" />}
        <span>{copied ? "복사됨" : "링크 복사"}</span>
      </button>
      <a
        href={`https://story.kakao.com/share?url=${enc(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("share", { channel: "kakao" })}
        className={`${btnBase} text-[#3c1e1e] bg-[#fee500] hover:bg-[#ffe300] border-[#fee500]`}
        aria-label="카카오 공유"
      >
        Kakao
      </a>
      <a
        href={lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("share", { channel: "line" })}
        className={`${btnBase} text-white bg-[#06c755] hover:bg-[#05b34c] border-[#06c755]`}
        aria-label="LINE 공유"
      >
        LINE
      </a>
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("share", { channel: "x" })}
        className={`${btnBase} text-foreground`}
        aria-label="X 공유"
      >
        X
      </a>
      <button onClick={nativeShare} className={btnBase} aria-label="공유하기">
        <Share2 className="w-3.5 h-3.5" />
        <span>공유</span>
      </button>
    </div>
  );
}
