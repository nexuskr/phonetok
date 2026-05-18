/**
 * /duel — Imperial Duel Lobby.
 */
import { useState } from "react";
import { Crown } from "lucide-react";
import { useDuelRooms, useFomoOracle } from "@pkg/duel";
import { LobbyShell } from "@pkg/duel/components/lobby/LobbyShell";
import { HallOfSovereigns } from "@pkg/duel/components/lobby/HallOfSovereigns";
import { LiveDuelGates } from "@pkg/duel/components/lobby/LiveDuelGates";
import { QuickAscensionRail } from "@pkg/duel/components/lobby/QuickAscensionRail";
import { FomoFloatingOracle } from "@pkg/duel/components/lobby/FomoFloatingOracle";
import { HeatLevelBadge } from "@pkg/duel/components/lobby/HeatLevelBadge";
import { VerificationOracleModal } from "@pkg/duel/components/oracle/VerificationOracleModal";
import { ImperialHeaderHero } from "@pkg/duel/components/lobby/v2/ImperialHeaderHero";

export default function ImperialDuelLobby() {
  const rooms = useDuelRooms(4);
  const totalSpec = rooms.reduce((s, r) => s + r.spectators, 0);
  const avgJackpot = rooms.reduce((s, r) => s + r.jackpotPct, 0) / Math.max(1, rooms.length);
  const signals = useFomoOracle({ spectators: totalSpec, jackpotPct: avgJackpot });
  const [oracleOpen, setOracleOpen] = useState(false);

  return (
    <>
      <LobbyShell
        header={
          <header className="flex items-center justify-between gap-3">
            <Link to="/home" className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300/80 hover:text-amber-200">
              <ArrowLeft className="w-3.5 h-3.5" /> 황궁으로
            </Link>
            <div className="text-center">
              <div className="text-[10px] tracking-[0.36em] font-black uppercase text-amber-400/85">
                Imperial Duel Lobby
              </div>
              <h1 className="font-imperial text-2xl md:text-4xl text-amber-100 leading-tight"
                  style={{ textShadow: "0 0 18px hsl(38 92% 60% / 0.6), 0 0 32px hsl(330 90% 60% / 0.3)" }}>
                황제의 대관전 — 폐하의 순간이 기다립니다
              </h1>
              <p className="text-[11px] text-amber-200/80 mt-1">
                관전 {totalSpec.toLocaleString()}명 · 평균 잭팟 {Math.round(avgJackpot)}%
              </p>
            </div>
            <HeatLevelBadge level={signals.globalHeat} />
          </header>
        }
        left={<HallOfSovereigns />}
        center={<LiveDuelGates rooms={rooms} />}
        right={<QuickAscensionRail rooms={rooms} />}
      />
      <FomoFloatingOracle signals={signals} onOpenOracle={() => setOracleOpen(true)} />
      <VerificationOracleModal open={oracleOpen} onOpenChange={setOracleOpen} result={null} signals={signals} />
      {/* SR-only Empire CTA */}
      <span className="sr-only"><Crown /></span>
    </>
  );
}
