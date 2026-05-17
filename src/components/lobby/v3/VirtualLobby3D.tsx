/**
 * VirtualLobby3D — Phase D Slice 2.
 * R3F Canvas + InstancedAvatarManager + Context Lost 자동 복구.
 * 모바일 극한 최적화: powerPreference high-perf, antialias off on low, dpr cap by tier.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { InstancedAvatarManager } from "./InstancedAvatarManager";
import { ProximityFomoToast } from "./ProximityFomoToast";
import { useLobbyEmperors } from "./useLobbyEmperors";
import { detectDeviceTier, dprForTier, maxAvatarsForTier } from "./useDeviceTier";

export default function VirtualLobby3D({ myPhon = 0 }: { myPhon?: number }) {
  const tier = detectDeviceTier();
  const maxCount = maxAvatarsForTier(tier);
  const emperors = useLobbyEmperors(maxCount);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [version, setVersion] = useState(0);

  // Context Lost recovery
  const handleCreated = useCallback((state: { gl: { domElement: HTMLCanvasElement } }) => {
    canvasRef.current = state.gl.domElement;
    const c = state.gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
    };
    const restored = () => {
      // remount scene → state restored within next frame
      setVersion((v) => v + 1);
    };
    c.addEventListener("webglcontextlost", lost, false);
    c.addEventListener("webglcontextrestored", restored, false);
  }, []);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      const c = canvasRef.current;
      if (!c) return;
      // listeners auto-GC with element; nothing else to do
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <Canvas
        key={version}
        dpr={dprForTier(tier)}
        gl={{
          antialias: tier === "high",
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 5.5, 12], fov: 55 }}
        onCreated={handleCreated}
        frameloop="always"
      >
        <color attach="background" args={["#0B0E1A"]} />
        <fog attach="fog" args={["#0B0E1A", 14, 32]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 10, 6]} intensity={0.9} color="#F5C518" />
        <directionalLight position={[-8, 6, -4]} intensity={0.35} color="#A78BFA" />
        <Suspense fallback={null}>
          <InstancedAvatarManager emperors={emperors} tier={tier} />
        </Suspense>
        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow={false}>
          <circleGeometry args={[20, 48]} />
          <meshStandardMaterial color="#13182B" roughness={0.95} />
        </mesh>
      </Canvas>

      <ProximityFomoToast emperors={emperors} myPhon={myPhon} />

      <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-start justify-between">
        <div className="rounded-full bg-black/45 backdrop-blur px-3 py-1.5 text-xs text-amber-300 border border-amber-500/30">
          👑 황제 {emperors.length}명 입장 중 · {tier.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
