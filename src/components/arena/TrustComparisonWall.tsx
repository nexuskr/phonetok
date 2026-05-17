import { memo } from "react";
import { Shield } from "lucide-react";

type Row = { label: string; stock: string; jeonse: string; mlm: string; ours: string };

const ROWS: Row[] = [
  { label: "원금 손실 한도",   stock: "무제한",        jeonse: "100%",       mlm: "100% + 채무",      ours: "베팅한 금액만" },
  { label: "결과까지 걸리는 시간", stock: "수개월~수년",   jeonse: "수년",       mlm: "수개월~수년",       ours: "60초 ~ 24시간" },
  { label: "사람을 모아야 하나",   stock: "아니오",        jeonse: "—",          mlm: "예 (강제)",          ours: "아니오 (혼자 가능)" },
  { label: "출금 보장",         stock: "증권사 의존",     jeonse: "보장 없음",   mlm: "보장 없음",          ours: "자동 출금 + 보험금" },
  { label: "가족·지인 피해",     stock: "없음",          jeonse: "없음",        mlm: "있음 (다단계)",       ours: "절대 없음" },
];

function Cell({ value, ours }: { value: string; ours?: boolean }) {
  return (
    <div
      className={`text-xs sm:text-sm font-bold tabular-nums leading-snug ${
        ours ? "text-gold" : "text-muted-foreground"
      }`}
    >
      {value}
    </div>
  );
}

function TrustComparisonWallInner() {
  return (
    <section className="glass-strong rounded-2xl p-4 sm:p-5 mt-4" aria-labelledby="trust-wall-title">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-5 h-5 text-gold" aria-hidden />
        <h3
          id="trust-wall-title"
          className="font-imperial text-base sm:text-lg tracking-[0.14em] text-gradient-imperial"
        >
          우리는 사람을 모으라 하지 않습니다 · 군대만 보내면 됩니다
        </h3>
      </div>

      {/* Desktop / tablet: table; mobile: stacked cards */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="py-2 pr-3">항목</th>
              <th className="py-2 px-3">주식</th>
              <th className="py-2 px-3">전세사기</th>
              <th className="py-2 px-3">MLM · 다단계</th>
              <th className="py-2 pl-3 text-gold">Phonara 트레이딩</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {ROWS.map((r) => (
              <tr key={r.label}>
                <td className="py-2.5 pr-3 text-xs sm:text-sm text-foreground/90 font-bold">{r.label}</td>
                <td className="py-2.5 px-3"><Cell value={r.stock} /></td>
                <td className="py-2.5 px-3"><Cell value={r.jeonse} /></td>
                <td className="py-2.5 px-3"><Cell value={r.mlm} /></td>
                <td className="py-2.5 pl-3"><Cell value={r.ours} ours /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-2">
        {ROWS.map((r) => (
          <li key={r.label} className="glass rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{r.label}</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">주식</dt><dd>{r.stock}</dd>
              <dt className="text-muted-foreground">전세사기</dt><dd>{r.jeonse}</dd>
              <dt className="text-muted-foreground">MLM</dt><dd>{r.mlm}</dd>
              <dt className="text-gold font-bold">Phonara</dt>
              <dd className="text-gold font-black">{r.ours}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
        ※ 본 비교는 일반적 위험 구조에 대한 설명이며, 어떠한 투자 권유나 수익 보장도 포함하지 않습니다.
      </p>
    </section>
  );
}

export default memo(TrustComparisonWallInner);
