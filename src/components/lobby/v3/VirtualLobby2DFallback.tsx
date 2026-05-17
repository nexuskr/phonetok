/**
 * VirtualLobby2DFallback — Low-end / WebGL 미지원 단말용 SVG 그리드.
 * 60명 황제를 정적 swirl 로 보여주고 hover 시 펄스.
 */
import { useLobbyEmperors } from "./useLobbyEmperors";
import { ProximityFomoToast } from "./ProximityFomoToast";

export default function VirtualLobby2DFallback({ myPhon = 0 }: { myPhon?: number }) {
  const emperors = useLobbyEmperors(60);

  return (
    <div className="relative w-full h-full bg-[#0B0E1A] overflow-hidden">
      <div className="absolute inset-0 grid grid-cols-6 gap-2 p-4 content-start overflow-y-auto">
        {emperors.map((e) => (
          <div
            key={e.id}
            className="aspect-square rounded-xl flex flex-col items-center justify-center text-center border border-white/10"
            style={{
              background: `linear-gradient(160deg, ${e.color_hex}22, transparent)`,
              boxShadow: `0 0 0 1px ${e.color_hex}33 inset`,
            }}
          >
            <span className="text-2xl leading-none">{e.emoji}</span>
            <span className="mt-1 text-[10px] text-white/70">T{e.tier}</span>
            {e.vip && (
              <span className="mt-0.5 text-[9px] font-bold text-amber-400">VIP</span>
            )}
          </div>
        ))}
      </div>
      <ProximityFomoToast emperors={emperors} myPhon={myPhon} />
      <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-start justify-between">
        <div className="rounded-full bg-black/45 backdrop-blur px-3 py-1.5 text-xs text-amber-300 border border-amber-500/30">
          👑 황제 {emperors.length}명 · 안정 모드
        </div>
      </div>
    </div>
  );
}
