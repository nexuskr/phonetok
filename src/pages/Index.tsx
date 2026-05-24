import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Index() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-card flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-2xl space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          PHONARA · 무료 부업 플랫폼
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight">
          매일 들어와서<br />
          <span className="text-primary">무료로</span> 돈 버는 곳
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          출석, 미션, 친구 추천만으로 시작합니다. 가입 즉시 보너스를 받고, 3초 안에 첫 보상을 경험하세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:opacity-90 transition"
          >
            지금 무료 시작
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            to="/home"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-border font-semibold text-lg hover:bg-card transition"
          >
            둘러보기
          </Link>
        </div>
      </div>
    </main>
  );
}
