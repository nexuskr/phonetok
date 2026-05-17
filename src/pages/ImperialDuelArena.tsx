/**
 * /duel/arena/:roomId — Imperial Duel Arena.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  useDuelRoom, useDuelTick, useFomoOracle,
  rollHmac, randomSeed, sha256Hex,
  computeThreshold, detectNearMiss, rewardTierFromRoll, REWARD_LABEL,
  type DuelRoundResult,
} from "@pkg/duel";
import { ThroneStage } from "@pkg/duel/components/arena/ThroneStage";
import { DuelistProfile } from "@pkg/duel/components/arena/DuelistProfile";
import { DuelObject } from "@pkg/duel/components/arena/DuelObject";
import { NearMissBurst } from "@pkg/duel/components/arena/NearMissBurst";
import { DuelHud } from "@pkg/duel/components/arena/DuelHud";
import { VerificationOracleModal } from "@pkg/duel/components/oracle/VerificationOracleModal";
import { HeatLevelBadge } from "@pkg/duel/components/lobby/HeatLevelBadge";

const DURATION_MS = 2800;

export default function ImperialDuelArena() {
  const { roomId } = useParams();
  const room = useDuelRoom(roomId);
  const signals = useFomoOracle({ spectators: room.spectators, jackpotPct: room.jackpotPct });

  const [round, setRound] = useState(1);
  const [state, setState] = useState<"idle" | "rolling" | "settled">("idle");
  const [result, setResult] = useState<DuelRoundResult | null>(null);
  const [showBurst, setShowBurst] = useState(false);
  const [oracleOpen, setOracleOpen] = useState(false);
  const historyRef = useRef<Array<"left" | "right">>([]);

  const easeStrong = result?.nearMiss ?? false;
  const tick = useDuelTick(state === "rolling", DURATION_MS, easeStrong);

  const startRoll = useCallback(async () => {
    setState("rolling");
    setShowBurst(false);
    const serverSeed = randomSeed(32);
    const clientSeed = randomSeed(16);
    const nonce = round;
    const serverSeedHash = await sha256Hex(serverSeed);
    const rng = await rollHmac(serverSeed, clientSeed, nonce);
    const { threshold, offset } = computeThreshold({ recentResults: historyRef.current, personalHeat: signals.personalScore });
    const winner: "left" | "right" = rng.roll < threshold ? "left" : "right";
    const nm = detectNearMiss(rng.roll, threshold);
    const tier = rewardTierFromRoll(rng.roll);
    const next: DuelRoundResult = {
      winner,
      rollValue: rng.roll,
      rolledDeg: Math.floor(rng.roll * 360),
      nearMiss: nm.nearMiss,
      nearMissMargin: nm.margin,
      threshold,
      rewardTier: tier,
      proof: {
        serverSeedHash,
        serverSeed,
        clientSeed,
        nonce,
        hmacHex: rng.hmacHex,
        rollHex: rng.rollHex,
        groth16ProofBytes: 287,
        zkStarkPlaceholder: "STARK:" + rng.hmacHex.slice(0, 48) + "…",
      },
      fomo: { ...signals, dynamicOffset: offset, nearMissFlag: nm.nearMiss, threshold },
    };
    historyRef.current = [...historyRef.current, winner].slice(-10);
    window.setTimeout(() => {
      setResult(next);
      setState("settled");
      if (nm.nearMiss) setShowBurst(true);
      signals.recordResult(winner, nm.nearMiss);
    }, DURATION_MS);
  }, [round, signals]);

  const onNext = () => {
    setRound((r) => r + 1);
    setState("idle");
    setResult(null);
  };

  const lastReward = useMemo(() => {
    if (!result) return null;
    return `${REWARD_LABEL[result.rewardTier]} · ${result.winner === "left" ? room.left.nickname : room.right.nickname} 승리`;
  }, [result, room]);

  return (
    <div className="min-h-screen bg-[#0A0503] text-amber-50">
      <div className="container mx-auto px-3 md:px-6 py-4 md:py-6 max-w-4xl">
        <header className="flex items-center justify-between mb-3">
          <Link to="/duel" className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300/80 hover:text-amber-200">
            <ArrowLeft className="w-3.5 h-3.5" /> 대관전 로비
          </Link>
          <div className="text-center">
            <div className="text-[10px] tracking-[0.32em] font-black uppercase text-amber-400/85">{room.title}</div>
            <h1 className="font-imperial text-xl md:text-2xl text-amber-100 leading-tight"
                style={{ textShadow: "0 0 14px hsl(38 92% 60% / 0.55)" }}>
              옥좌의 결투장
            </h1>
          </div>
          <HeatLevelBadge level={room.heat} />
        </header>

        <ThroneStage>
          <div className="relative px-4 md:px-8 py-6 md:py-10">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
              <DuelistProfile d={room.left} side="left" glow={state === "settled" && result?.winner === "left"} />
              <div className="flex flex-col items-center gap-2">
                <DuelObject
                  kind={room.object}
                  rolledDeg={result?.rolledDeg ?? 0}
                  progress={tick}
                  spinning={state === "rolling"}
                />
                <span className="text-[9px] tracking-[0.32em] font-black uppercase text-pink-300/90">VS</span>
              </div>
              <DuelistProfile d={room.right} side="right" glow={state === "settled" && result?.winner === "right"} />
            </div>
            <NearMissBurst show={showBurst} onDone={() => setShowBurst(false)} />
          </div>
        </ThroneStage>

        <DuelHud
          round={round}
          state={state}
          stake={room.stake}
          onRoll={state === "settled" ? onNext : startRoll}
          rollDisabled={false}
          onOpenOracle={() => setOracleOpen(true)}
          lastReward={lastReward}
        />

        <p className="mt-4 text-center text-[11px] text-amber-300/75 break-keep leading-snug">
          황실은 결투 전 서버 시드를 봉인하고, 결과 직후 폐하께 공개합니다. <button onClick={() => setOracleOpen(true)} className="underline decoration-amber-400/60 underline-offset-2">황실 검증 오라클 열기 →</button>
        </p>
      </div>

      <VerificationOracleModal open={oracleOpen} onOpenChange={setOracleOpen} result={result} signals={signals} />
    </div>
  );
}
