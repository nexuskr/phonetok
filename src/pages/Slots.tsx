import { Gem, Play } from "lucide-react";

export default function Slots() {
  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Gem className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">Olympus 1000</h1>
      </header>

      <section className="rounded-2xl bg-gradient-to-br from-primary/20 to-card border border-primary/20 p-6 text-center space-y-4">
        <div className="text-6xl">⚡</div>
        <h2 className="text-xl font-black">제우스의 번개를 노려라</h2>
        <p className="text-sm text-muted-foreground">3-매치 페이라인 · 자유회전 · 잭팟</p>
        <button className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold">
          <Play className="h-5 w-5" /> 게임 시작
        </button>
      </section>

      <p className="text-xs text-muted-foreground text-center">
        슬롯 엔진 통합 준비 중입니다
      </p>
    </main>
  );
}
