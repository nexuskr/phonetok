// P0-3 — AuthErrorBoundary
//
// 자식 트리에서 auth 관련 throw 가 발생하면 "자동 재연결 중..." UI 를 띄우고
// 3초 후 자동 복구 시도. 실패 시 "다시 로그인" CTA.
// 정상 흐름에선 0 영향.

import React from "react";
import { Button } from "@/components/ui/button";
import { isInvalidSessionError, clearBrokenLocalSession } from "@/lib/auth-recovery";
import { invalidateSessionCache } from "@/lib/auth/authSingleFlight";

type State = { error: Error | null; recovering: boolean };

export class AuthErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): State {
    if (isInvalidSessionError(error)) return { error, recovering: true };
    // 비-auth 에러는 그대로 throw 시켜 상위 ErrorBoundary 에 위임
    throw error;
  }

  componentDidCatch(error: Error) {
    if (this.state.recovering) {
      // 자동 복구 시도
      setTimeout(async () => {
        try {
          await clearBrokenLocalSession();
          invalidateSessionCache();
          this.setState({ error: null, recovering: false });
        } catch {
          this.setState({ recovering: false });
        }
      }, 3000);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="text-center max-w-sm space-y-3">
            <div className="text-2xl font-black text-foreground">
              {this.state.recovering ? "자동 재연결 중…" : "세션이 만료됐어요"}
            </div>
            <p className="text-sm text-muted-foreground">
              {this.state.recovering
                ? "잠시만 기다려 주세요. 자동으로 복구합니다."
                : "다시 로그인하면 바로 이어서 사용할 수 있습니다."}
            </p>
            {!this.state.recovering && (
              <Button
                variant="default"
                onClick={() => { window.location.href = "/secure-auth"; }}
              >
                다시 로그인
              </Button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
