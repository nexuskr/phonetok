import { useEffect, useState } from "react";
import { Bell, BellOff, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  isPushSupported,
  isPushActive,
  subscribePush,
  unsubscribePush,
} from "@/lib/push";
import { notify } from "@/lib/notify";

function isPreviewIframe(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const inIframe = window.self !== window.top;
    const host = window.location.hostname;
    const isPreviewHost =
      host.includes("id-preview--") || host.includes("lovableproject.com");
    return inIframe || isPreviewHost;
  } catch {
    return true;
  }
}

export default function PushNotificationCard() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewBlocked] = useState(isPreviewIframe());

  useEffect(() => {
    const ok = isPushSupported() && !previewBlocked;
    setSupported(ok);
    if (ok) void isPushActive().then(setActive);
  }, [previewBlocked]);

  async function toggle() {
    setLoading(true);
    try {
      if (active) {
        await unsubscribePush();
        setActive(false);
        notify.success("푸시 알림을 껐어요");
      } else {
        const r = await subscribePush();
        if (r.ok) {
          setActive(true);
          notify.success("🔔 푸시 알림을 켰어요 — 미션 보상·승인 즉시 알림");
        } else {
          notify.error(r.reason ?? "알림 등록 실패");
        }
      }
    } catch (e: any) {
      notify.error(e?.message ?? "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4 glass-strong">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            active ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"
          }`}
        >
          {active ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm">푸시 알림</div>
          <div className="text-xs text-muted-foreground mt-0.5 break-keep">
            미션 보상 지급·출금 승인·랭킹 상승을 즉시 받아보세요.
          </div>
          {previewBlocked && (
            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-500 break-keep">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              미리보기에서는 푸시가 제한됩니다. 설치된 앱/배포 도메인에서 이용해 주세요.
            </div>
          )}
          {!supported && !previewBlocked && (
            <div className="mt-2 text-[11px] text-muted-foreground break-keep">
              이 브라우저는 푸시 알림을 지원하지 않습니다.
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant={active ? "outline" : "default"}
          disabled={!supported || loading}
          onClick={toggle}
        >
          {loading ? "처리 중…" : active ? "끄기" : "켜기"}
        </Button>
      </div>
    </Card>
  );
}
