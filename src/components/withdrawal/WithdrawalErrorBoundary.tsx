/**
 * PR-P0-4 — WithdrawalErrorBoundary
 *
 * Scoped React error boundary for withdrawal subtrees. Catches unexpected
 * throws (network, JSON parse, downstream component bugs) and shows a
 * Warm-King recovery card with manual retry. Does NOT replace AuthErrorBoundary.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}
interface State {
  error: Error | null;
}

export default class WithdrawalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[WithdrawalErrorBoundary]", error, info);
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-6 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 mx-auto text-amber-400" />
        <h3 className="text-base font-semibold">출금 화면을 다시 불러올게요</h3>
        <p className="text-sm text-muted-foreground">
          일시적인 오류가 발생했어요. 잔액과 거래는 안전합니다.
        </p>
        <Button onClick={this.reset} variant="default" size="sm">
          다시 시도
        </Button>
      </div>
    );
  }
}
