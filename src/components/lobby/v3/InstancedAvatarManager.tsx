/**
 * InstancedAvatarManager — three.js InstancedMesh 로 N명 황제 1 draw call 렌더.
 * - LOD: 거리 > 18 → scale 축소, > 28 → 컬링
 * - Frustum culling 자동
 * - safeDispose on unmount
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { LobbyEmperor } from "./types";
import { safeDispose } from "@/components/avatar/v3/safeDispose";
import type { DeviceTier } from "./useDeviceTier";

interface Props {
  emperors: LobbyEmperor[];
  tier: DeviceTier;
}

export function InstancedAvatarManager({ emperors, tier }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const { camera } = useThree();

  // Layout positions on a swirl
  const positions = useMemo(() => {
    return emperors.map((_, i) => {
      const ring = Math.floor(i / 18);
      const radius = 3 + ring * 2.4;
      const ang = (i % 18) * (Math.PI * 2 / 18) + ring * 0.12;
      return new THREE.Vector3(
        Math.cos(ang) * radius,
        0,
        Math.sin(ang) * radius,
      );
    });
  }, [emperors]);

  // Geometry + material — single instance shared
  const geometry = useMemo(() => new THREE.CapsuleGeometry(0.45, 0.9, 4, 8), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.55,
      metalness: 0.15,
      vertexColors: false,
    }),
    [],
  );

  // Set per-instance color
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < emperors.length; i++) {
      tmpColor.set(emperors[i].color_hex);
      mesh.setColorAt(i, tmpColor);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [emperors, tmpColor]);

  // Cleanup
  useEffect(() => {
    return () => {
      const mesh = meshRef.current;
      if (mesh) safeDispose(mesh);
      try { geometry.dispose(); } catch { /**/ }
      try { material.dispose(); } catch { /**/ }
    };
  }, [geometry, material]);

  // Animate (shader-like breathing via instance matrix)
  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const animate = tier !== "low";
    for (let i = 0; i < emperors.length; i++) {
      const p = positions[i];
      const dist = camera.position.distanceTo(p);
      if (dist > 28) {
        dummy.scale.setScalar(0); // cull
      } else {
        const lod = dist > 18 ? 0.55 : 1;
        const breathe = animate ? 1 + Math.sin(t * 1.8 + i * 0.3) * 0.04 : 1;
        dummy.scale.setScalar(lod * breathe);
      }
      const bobY = animate ? Math.sin(t * 1.2 + i * 0.5) * 0.08 : 0;
      dummy.position.set(p.x, p.y + bobY, p.z);
      dummy.rotation.y = t * 0.15 + i;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, emperors.length]}
      frustumCulled
      castShadow={false}
      receiveShadow={false}
    />
  );
}
