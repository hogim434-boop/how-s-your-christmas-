"use client";

// 밤 = 예전 시안의 "미니어처 밤" 분위기입니다. (11.25 사용자 요청: 시안 느낌 그대로)
// 출처: _archive/prototypes/island-3d/src/VillageApp.tsx(Lights night), Village.tsx(불빛·눈), styles.ts(night)
//
// 들어 있는 것
//  - 하늘: 짙은 남색 + 별
//  - 빛: 푸른 달빛(하늘빛 + 달 방향 빛, 그림자를 만듦)
//  - 따뜻한 불빛: 트리 앞, 가로등마다, 집 앞마다 (시안 값 그대로, 집·가로등 크기 차이만 맞춤)
//  - 마을 안에만 내리는 눈
// 시안처럼 따뜻한 빛은 "불빛"이 만들고, 달빛은 마을 모양만 보이게 은은하게 비춥니다.

import { Stars } from "@react-three/drei";
import { lampPositions, type HouseSlot } from "@/lib/village/layout";
import { HOUSE_SCALE } from "./House";
import { VillageSnow } from "./VillageSnow";

/** 시안의 집 크기 배율(1.25). 우리 집(1.9)이 몇 배 큰지 계산해 집 앞 불빛 위치·범위를 맞춥니다 */
const PROTO_HOUSE_SCALE = 1.25;
const HOUSE_RATIO = HOUSE_SCALE / PROTO_HOUSE_SCALE;

const LAMPS = lampPositions();

// ───────── 전체 묶음 ─────────

interface NightAtmosphereProps {
  /** 울타리까지의 반지름 */
  villageRadius: number;
  /** 집 자리 (집 앞 불빛 위치) */
  slots: HouseSlot[];
}

export function NightAtmosphere({ villageRadius, slots }: NightAtmosphereProps) {
  // 그림자가 마을 전체에 드리우도록 그림자 범위를 마을 크기만큼
  const shadowRange = villageRadius + 4;

  return (
    <>
      {/* 별: 시안과 같은 값 */}
      <Stars radius={120} depth={40} count={1400} factor={5} saturation={0} fade speed={0.6} />

      {/* 푸른 달빛: 마을 모양은 보이게, 따뜻한 빛은 불빛이 만듭니다 */}
      <hemisphereLight args={["#9fb2f0", "#2c3566", 1.0]} />
      <directionalLight
        position={[-6, 12, 5]}
        color="#b9c7ff"
        intensity={0.9}
        castShadow
        // 시안은 4096이지만 휴대폰 메모리를 생각해 2048
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowRange}
        shadow-camera-right={shadowRange}
        shadow-camera-top={shadowRange}
        shadow-camera-bottom={-shadowRange}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />

      {/* 트리 앞 따뜻한 불빛 */}
      <pointLight position={[0, 4, 3]} color="#ffd38a" intensity={22} distance={14} />

      {/* 가로등마다 따뜻한 불빛 (등불 높이) */}
      {LAMPS.map((p, i) => (
        <pointLight key={i} position={[p.x, 3.0, p.z]} color="#ffd9a0" intensity={9} distance={7} />
      ))}

      {/* 집 앞마다 창문 불빛 (시안: 집 안쪽 좌표 (0, 1, 1.9) × 집 배율) */}
      {slots.map((s, i) => {
        const x = 0;
        const z = 1.9 * HOUSE_SCALE;
        const cos = Math.cos(s.rotation);
        const sin = Math.sin(s.rotation);
        return (
          <pointLight
            key={i}
            position={[s.x + x * cos + z * sin, 1.0 * HOUSE_SCALE, s.z - x * sin + z * cos]}
            color="#ffc98a"
            intensity={5 * HOUSE_RATIO * HOUSE_RATIO}
            distance={5 * HOUSE_RATIO}
          />
        );
      })}

      {/* 마을 안에 내리는 눈 (아침과 같은 눈, 밤에는 살짝 푸른빛) */}
      <VillageSnow villageRadius={villageRadius} color="#e8eeff" opacity={0.9} />
    </>
  );
}
