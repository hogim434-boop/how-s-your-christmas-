"use client";

// 두 점 사이에 처지게 걸린 알록달록 전구 줄입니다. (가로등 사이, 집 지붕 테두리에 사용)
// 밤 모드에서는 전구가 스스로 빛나는 것처럼 밝아지고, 빛 번짐 효과로 주변에 은은히 퍼집니다.
// 전구는 작은 구슬이고, 한 줄 전체를 한 번에 그리는(InstancedMesh) 방식이라 가볍습니다.

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { VILLAGE_COLORS } from "@/lib/village/theme";
import { NIGHT_GLOW, useNight } from "./nightContext";

/** 전구 색 돌려쓰기 */
const BULB_COLORS = ["#e8504a", "#ffd45c", "#4fb477", "#6c9be8", ...VILLAGE_COLORS.ornaments];

interface BulbStringProps {
  from: [number, number, number];
  to: [number, number, number];
  /** 가운데가 아래로 처지는 정도 */
  sag?: number;
  /** 전구 개수 */
  count?: number;
  /** 전구 크기 */
  size?: number;
}

export function BulbString({ from, to, sag = 0.6, count = 9, size = 0.13 }: BulbStringProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const night = useNight();

  // 전구 위치·색을 한 번 정해 줍니다
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      // 직선 위의 점에서, 가운데일수록 아래로 내림 (포물선)
      const droop = sag * 4 * t * (1 - t);
      matrix.setPosition(
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t - droop,
        from[2] + (to[2] - from[2]) * t,
      );
      m.setMatrixAt(i, matrix);
      // 밤에는 색을 몇 배로 밝혀서 빛 번짐 효과가 불빛처럼 퍼뜨리게 합니다
      m.setColorAt(i, color.set(BULB_COLORS[i % BULB_COLORS.length]).multiplyScalar(night ? NIGHT_GLOW : 1));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [from, to, sag, count, night]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[size, 8, 8]} />
      {/* meshBasicMaterial: 조명과 상관없이 불 켜진 것처럼 밝게 보입니다 */}
      {/* toneMapped={false}: 밝기 정리 단계에서 빛이 눌리지 않게 → 밤에 더 또렷이 빛남 */}
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
