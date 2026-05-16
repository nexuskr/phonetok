// OlympusLegacyPaytableSheet — warm amber luxury paytable (BasePaytableSheet).
import { Crown } from "lucide-react";
import BasePaytableSheet, {
  type PaytableSection,
  type SymRow,
} from "@/components/slots/BasePaytableSheet";

const HIGH: SymRow[] = [
  { emoji: "👑", name: "Zeus", pay: "5x: ×500 · 4x: ×150 · 3x: ×40" },
  { emoji: "⚡", name: "Golden Bolt", pay: "5x: ×200 · 4x: ×80 · 3x: ×20" },
  { emoji: "🏛️", name: "Marble Temple", pay: "5x: ×120 · 4x: ×40 · 3x: ×12" },
  { emoji: "🦅", name: "Eagle of Olympus", pay: "5x: ×80 · 4x: ×25 · 3x: ×8" },
];

const LOW: SymRow[] = [
  { emoji: "A", name: "A", pay: "5x: ×30 · 4x: ×10 · 3x: ×4" },
  { emoji: "K", name: "K", pay: "5x: ×25 · 4x: ×8 · 3x: ×3" },
  { emoji: "Q", name: "Q", pay: "5x: ×20 · 4x: ×6 · 3x: ×2" },
  { emoji: "J", name: "J", pay: "5x: ×15 · 4x: ×5 · 3x: ×2" },
];

const SECTIONS: PaytableSection[] = [
  {
    title: "고배당 심볼",
    toneClass: "from-amber-400/35 to-transparent border-amber-400/50",
    rows: HIGH,
  },
  {
    title: "저배당 심볼",
    toneClass: "from-amber-200/20 to-transparent border-amber-300/40",
    rows: LOW,
  },
  {
    title: "특수 심볼",
    toneClass: "from-yellow-500/30 to-transparent border-yellow-400/50",
    rows: [
      { emoji: "⚡", name: "Lightning Wild", pay: "모든 일반 심볼 대체 + 등장 시 인접 칸 ×2 골든 부스트." },
      { emoji: "🔱", name: "SCATTER (Trident)", pay: "3개 이상 등장 시 Free Spins 발동." },
    ],
  },
  {
    title: "Zeus Multiplier Ladder",
    toneClass: "from-amber-500/35 to-transparent border-amber-500/55",
    extra: (
      <div className="space-y-2 text-sm text-amber-100/95 leading-relaxed">
        <p>
          Cluster Tumble 연쇄가 진행될수록 Zeus의 멀티플라이어가 단계적으로 상승합니다.
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold">
          {[2, 5, 12, 30, 80, 200, 500].map((m, i) => (
            <div
              key={m}
              className="rounded-md py-1 border border-amber-400/40 bg-amber-950/40 text-amber-100"
              style={{ boxShadow: `0 0 ${6 + i * 2}px rgba(255,196,90,${0.18 + i * 0.06})` }}
            >
              ×{m}
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-200/80">
          최종 단계 도달 시 단일 스핀 최대 <b className="text-yellow-200">×5,000</b> 배율까지 폭발합니다.
        </p>
      </div>
    ),
  },
  {
    title: "Free Spins — Zeus의 축복",
    toneClass: "from-yellow-400/30 to-transparent border-yellow-400/50",
    extra: (
      <div className="grid grid-cols-4 gap-2 text-center text-amber-100">
        {[
          { s: "🔱×3", n: 10 },
          { s: "🔱×4", n: 15 },
          { s: "🔱×5", n: 20 },
          { s: "🔱×6", n: 25 },
        ].map((t) => (
          <div
            key={t.n}
            className="rounded-lg py-2 border border-amber-400/50 bg-gradient-to-b from-amber-950/50 to-amber-950/20"
          >
            <div className="text-[11px] text-amber-200/80">{t.s}</div>
            <div className="font-bold text-lg text-yellow-200">{t.n} FS</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Cluster Tumble 규칙",
    toneClass: "from-amber-700/30 to-transparent border-amber-600/45",
    extra: (
      <ul className="text-sm text-amber-100/90 space-y-1.5 list-disc list-inside">
        <li>6×5 그리드에서 같은 심볼이 인접 5개 이상이면 클러스터 당첨.</li>
        <li>당첨 심볼이 사라지고 위에서 새 심볼이 떨어져 연쇄 발생 — Tumble.</li>
        <li>매 연쇄마다 Zeus Multiplier Ladder가 한 단계씩 상승.</li>
        <li>Lightning Wild는 클러스터를 잇는 다리 역할 + 인접 칸 ×2.</li>
      </ul>
    ),
  },
  {
    title: "MAX WIN ×5,000",
    toneClass: "from-yellow-300/40 to-transparent border-yellow-300/60",
    extra: (
      <>
        <p className="text-sm text-amber-100/95 leading-relaxed">
          단일 스핀 최대 배율 도달 시 <b className="text-yellow-200">Olympus Legacy</b> 시네마틱과{" "}
          <b className="text-amber-200">Crown 자동 보상</b>이 발동됩니다.
        </p>
        <p className="text-xs text-amber-300/80 mt-2">
          RTP 96.0% (Real) · Demo 모드는 학습용으로 RTP가 다를 수 있습니다.
        </p>
      </>
    ),
  },
];

export default function OlympusLegacyPaytableSheet() {
  return (
    <BasePaytableSheet
      title="Olympus Legacy 5000 — 배당표"
      TitleIcon={Crown}
      titleIconClassName="text-amber-200"
      titleClassName="text-amber-100"
      triggerClassName="border-amber-400/60 bg-amber-950/40 text-amber-100 hover:bg-amber-900/50 hover:text-amber-50 backdrop-blur-sm"
      contentClassName="bg-gradient-to-b from-[#0a1228] via-[#1a1408] to-[#0a1228] border-l border-amber-400/40 text-amber-50"
      rowBgClass="bg-amber-950/30"
      rowIconBgClass="bg-amber-900/40"
      rowIconTextClass="text-amber-100"
      rowNameClass="text-amber-50"
      rowPayClass="text-amber-200/80"
      sectionTitleClass="text-amber-100"
      sections={SECTIONS}
      footer={
        <p className="text-[11px] text-amber-300/70 text-center">
          결과는 RNG로 결정되며, 실시간 통계는 서버 RPC가 권한합니다.
        </p>
      }
    />
  );
}
