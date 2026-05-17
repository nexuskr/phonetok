/**
 * VerificationOracleModal — 4-Tab 검증 오라클.
 */
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { DuelRoundResult, FomoSignals } from "@pkg/duel";

const TRIGGER_LABEL: Record<string, string> = {
  near_miss_streak: "황제의 운이 가까이",
  win_drought: "승리가 그리워질 때",
  royal_pass_milestone: "황실 패스 임박",
  session_resurrection: "다시 강림하신 폐하",
  heat_surge: "황실이 끓어오릅니다",
};

export function VerificationOracleModal({
  open,
  onOpenChange,
  result,
  signals,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: DuelRoundResult | null;
  signals: FomoSignals;
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={<span className="font-imperial tracking-[0.18em] text-amber-100">황실 검증 오라클</span>} description="폐하의 결투, 황실이 직접 증명합니다">
      <div className="px-4 pb-4">
        <Tabs defaultValue="classic">
          <TabsList className="grid grid-cols-4 w-full bg-black/45 border border-amber-400/25">
            <TabsTrigger value="classic" className="text-[11px]">Classic</TabsTrigger>
            <TabsTrigger value="groth16" className="text-[11px]">Groth16</TabsTrigger>
            <TabsTrigger value="stark" className="text-[11px]">zk-STARK</TabsTrigger>
            <TabsTrigger value="personal" className="text-[11px]">Personal</TabsTrigger>
          </TabsList>

          <TabsContent value="classic" className="space-y-2">
            <Row k="Server Seed Hash" v={result?.proof.serverSeedHash} mono />
            <Row k="Server Seed" v={result?.proof.serverSeed} mono />
            <Row k="Client Seed" v={result?.proof.clientSeed} mono />
            <Row k="Nonce" v={String(result?.proof.nonce ?? "—")} />
            <Row k="HMAC-SHA512" v={result?.proof.hmacHex.slice(0, 64) + "…"} mono />
            <Row k="Roll Hex" v={result?.proof.rollHex} mono />
            <Row k="Roll" v={result ? result.rollValue.toFixed(8) : "—"} />
            <p className="text-[11px] text-amber-300/80 leading-snug break-keep mt-2">
              황실은 결투 전 서버 시드를 봉인하고, 결과 직후 공개합니다. 폐하가 직접 HMAC-SHA512로 검증하실 수 있습니다.
            </p>
          </TabsContent>

          <TabsContent value="groth16" className="space-y-2">
            <div className="rounded-xl p-3 bg-gradient-to-br from-[#160a05] to-[#0A0503] border border-amber-400/25">
              <div className="text-[10px] tracking-[0.24em] font-black uppercase text-amber-300/80">Circuit Flow</div>
              <pre className="text-[10px] text-amber-100/80 mt-1 leading-snug">{`seed → poseidon → R1CS → Groth16
public: [dynamicOffset, fomo, nearMiss, trigger]`}</pre>
            </div>
            <Row k="Proof Size" v="287 bytes" />
            <Row k="Dynamic Offset" v={signals.dynamicOffset.toFixed(5)} />
            <Row k="Personal FOMO" v={String(signals.personalScore)} />
            <Row k="Near-Miss Flag" v={signals.nearMissFlag ? "TRUE" : "false"} />
            <Row k="Trigger" v={signals.triggers[0] ?? "—"} />
            <p className="text-[11px] text-amber-300/80 mt-2 break-keep leading-snug">
              황실의 모든 가변 임계는 Groth16 회로의 public signals 로 노출되어, 폐하의 결투를 누구도 조작할 수 없습니다.
            </p>
          </TabsContent>

          <TabsContent value="stark" className="space-y-2">
            <div className="rounded-xl p-4 bg-gradient-to-br from-[#1a0a14] to-[#0A0503] border border-pink-400/30 text-center">
              <div className="text-[10px] tracking-[0.28em] font-black uppercase text-pink-300/90">Quantum Shield</div>
              <div className="font-imperial text-2xl text-amber-100 mt-1">zk-STARK</div>
              <div className="text-[11px] text-amber-200/80 mt-1 break-keep">
                양자 시대에도 무너지지 않는 황실의 방패
              </div>
            </div>
            <Row k="Placeholder" v={result?.proof.zkStarkPlaceholder ?? "—"} mono />
            <p className="text-[11px] text-amber-300/80 break-keep leading-snug">
              Phase 2 에서 WASM Verifier 가 도입되며, 폐하의 결투를 양자 내성으로 영원히 봉인합니다.
            </p>
          </TabsContent>

          <TabsContent value="personal" className="space-y-2">
            <div className="rounded-xl p-3 bg-gradient-to-br from-[#160a05] to-[#1a0a14] border border-amber-400/30">
              <div className="text-[10px] tracking-[0.28em] font-black uppercase text-amber-300/85">Personal FOMO</div>
              <div className="font-imperial text-3xl text-amber-100 tabular-nums">{signals.personalScore}</div>
              <div className="h-2 rounded-full bg-black/55 overflow-hidden mt-1.5">
                <div className="h-full" style={{ width: `${signals.personalScore}%`, background: "linear-gradient(90deg,#F5C518,#F472B6)" }} />
              </div>
            </div>
            <Row k="Global Heat" v={`Lv.${signals.globalHeat}`} />
            <Row k="Threshold" v={signals.threshold.toFixed(5)} />
            <div className="rounded-xl p-3 bg-black/40 border border-amber-400/20">
              <div className="text-[10px] tracking-[0.24em] font-black uppercase text-amber-300/80 mb-1">Active Triggers</div>
              {signals.triggers.length === 0 && <div className="text-[11px] text-amber-200/70">고요한 황궁입니다</div>}
              <ul className="space-y-1">
                {signals.triggers.map((t) => (
                  <li key={t} className="text-[11px] text-amber-100/90">• {TRIGGER_LABEL[t] ?? t}</li>
                ))}
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </BottomSheet>
  );
}

function Row({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg px-3 py-2 bg-black/35 border border-amber-400/15">
      <span className="text-[10px] tracking-[0.22em] font-black uppercase text-amber-300/80 shrink-0">{k}</span>
      <span className={`text-[11px] text-amber-100/95 text-right break-all ${mono ? "font-mono" : ""}`}>{v ?? "—"}</span>
    </div>
  );
}

export default VerificationOracleModal;
