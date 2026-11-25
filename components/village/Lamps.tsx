"use client";

// 광장 가장자리를 빙 둘러 서 있는 가로등입니다. (KayKit lantern 모델)
// 위치는 layout.ts의 lampPositions()가 정해 줍니다. (알전구 줄 장식도 같은 위치를 씁니다)
// 밤 모드에서는 등불 유리 안에 따뜻한 빛 덩어리를 넣어, 빛 번짐 효과로 진짜 불이 켜진 것처럼 보이게 합니다.

import { Kit } from "./Kit";
import { useNight } from "./nightContext";
import { LAMP_SCALE, lampPositions } from "@/lib/village/layout";
import * as THREE from "three";

const POSITIONS = lampPositions();

/** 등불 유리 부분의 높이와 크기 (모델을 재서 얻은 값: 높이 3.16~3.51, 반지름 0.3) */
const GLASS = { y: 3.34, size: 0.4 };

/** 불빛 색 (밤에 몇 배로 밝힌 따뜻한 노란색) */
// 시안의 등불 유리: 따뜻한 #ffc77a를 4배(lampGlow 5 × 0.8)로 빛나게
const GLOW_COLOR = new THREE.Color("#ffc77a").multiplyScalar(4);

export function Lamps() {
  const night = useNight();
  return (
    <group>
      {POSITIONS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} scale={LAMP_SCALE}>
          <Kit pack="kaykit" name="lantern" />
          {night && (
            <mesh position={[0, GLASS.y, 0]}>
              <boxGeometry args={[GLASS.size, GLASS.size * 0.85, GLASS.size]} />
              <meshBasicMaterial color={GLOW_COLOR} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
