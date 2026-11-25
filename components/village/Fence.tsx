"use client";

// 마을을 빙 둘러싼 통나무 울타리입니다. (11.25 사용자 요청)
// Kenney의 울타리 모델(cabin-fence, CC0) 한 칸을 원을 따라 이어 붙입니다.
// 기본 도형이 아니라 사람이 만든 모델을 써서 마을 분위기와 맞춥니다.

import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { Kit, modelUrl } from "./Kit";

/** 울타리 한 칸을 몇 배로 키울지 (집 크기에 맞춤) */
const FENCE_SCALE = 1.9;

interface FenceProps {
  /** 울타리가 놓일 원의 반지름 */
  radius: number;
}

export function Fence({ radius }: FenceProps) {
  // 모델의 실제 폭을 재서, 원 둘레를 빈틈없이 채우려면 몇 칸이 필요한지 계산합니다
  const { scene } = useGLTF(modelUrl("kenney", "cabin-fence"));
  // 이 모델은 기준점이 가운데가 아니라 모서리에 있어서, 가운데로 옮길 거리(center)도 함께 잽니다.
  // 울타리는 모델의 x축 방향으로 길게 뻗어 있습니다.
  const { segmentWidth, center } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    return { segmentWidth: size.x * FENCE_SCALE, center: mid.multiplyScalar(FENCE_SCALE) };
  }, [scene]);

  const pieces = useMemo(() => {
    // 칸 사이에 틈이 생기지 않도록 폭보다 조금 촘촘하게(5% 겹치게) 놓습니다
    const count = Math.max(8, Math.ceil((2 * Math.PI * radius) / (segmentWidth * 0.95)));
    return Array.from({ length: count }, (_, i) => {
      const angle = ((i + 0.5) / count) * Math.PI * 2;
      return {
        x: Math.sin(angle) * radius,
        z: Math.cos(angle) * radius,
        // 울타리 칸(모델의 x축)이 원의 접선 방향(옆으로 이어지는 방향)을 향하게 돌립니다
        rotation: angle,
      };
    });
  }, [radius, segmentWidth]);

  return (
    <group>
      {pieces.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rotation, 0]}>
          {/* 모델의 가운데가 이 자리에 오도록 모서리 기준점만큼 되돌려 놓습니다 */}
          <Kit name="cabin-fence" position={[-center.x, 0, -center.z]} scale={FENCE_SCALE} />
        </group>
      ))}
    </group>
  );
}
