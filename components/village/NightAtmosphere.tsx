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
//
// ⚡ 11.25 성능 개선 (밤에 렉이 걸린다는 사용자 요청으로 측정: 20명일 때 22 FPS → 원인 1순위가 불빛)
//  - 진짜 불빛(pointLight)은 화면의 모든 점이 "이 불빛이 나를 비추나?"를 매번 계산해서, 개수만큼 무거워집니다.
//    집마다 1개씩이라 사람이 늘수록 점점 느려졌습니다.
//  - 그래서 가로등·집 앞 불빛은 "가짜 빛"(눈밭에 깔린 따뜻한 빛 번짐 그림)으로 바꿨습니다.
//    그림 한 묶음을 한 번에 그려서(InstancedMesh) 집이 많아져도 부담이 거의 늘지 않습니다.
//  - 진짜 불빛은 트리 앞 1개만 남깁니다.
//  - 달빛 그림자는 그림자 지도 크기를 2048 → 1024로 줄이고, 집·트리가 바뀔 때만 다시 그립니다 (ShadowFlags.tsx)

import { useLayoutEffect, useMemo, useRef } from "react";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { lampPositions, type HouseSlot } from "@/lib/village/layout";
import { HOUSE_SCALE } from "./House";
import { VillageSnow } from "./VillageSnow";
import { softDot } from "./particles";

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
        // 시안은 4096. 휴대폰 부담을 생각해 1024 (그림자 가장자리는 부드럽게 처리돼 차이가 크지 않습니다)
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-shadowRange}
        shadow-camera-right={shadowRange}
        shadow-camera-top={shadowRange}
        shadow-camera-bottom={-shadowRange}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />

      {/* 트리 앞 따뜻한 불빛 */}
      <pointLight position={[0, 4, 3]} color="#ffd38a" intensity={22} distance={14} />

      {/* 가로등 아래·집 앞 눈밭에 비친 따뜻한 빛 (가짜 빛, 한 번에 그림) */}
      <GroundGlows slots={slots} />

      {/* 마을 안에 내리는 눈 (아침과 같은 눈, 밤에는 살짝 푸른빛) */}
      <VillageSnow villageRadius={villageRadius} color="#e8eeff" opacity={0.9} />
    </>
  );
}

// ───────── 가짜 빛: 눈밭에 비친 불빛 ─────────

/** 빛 번짐 한 장의 정보: 위치, 반지름, 색 */
type Glow = { x: number; z: number; radius: number; color: string };

/** 가로등 아래 빛 (예전 진짜 불빛: 범위 7) */
const LAMP_GLOW = { radius: 3.2, color: "#ffcf8a" };
/** 집 앞 창문 빛 (예전 진짜 불빛: 범위 5 × 집 배율) */
const HOUSE_GLOW = { radius: 2.4 * HOUSE_RATIO, color: "#ffb870" };
/** 빛 번짐의 진하기 (더하기 방식이라 아래 눈 색에 이만큼 따뜻한 색이 더해집니다) */
const GLOW_OPACITY = 0.5;

function GroundGlows({ slots }: { slots: HouseSlot[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const glows = useMemo<Glow[]>(() => {
    const list: Glow[] = LAMPS.map((p) => ({ x: p.x, z: p.z, ...LAMP_GLOW }));
    for (const s of slots) {
      // 집 앞(광장 쪽)으로 집 크기만큼 떨어진 곳 = 예전 집 앞 불빛 바로 아래
      const front = 1.9 * HOUSE_SCALE;
      list.push({ x: s.x + Math.sin(s.rotation) * front, z: s.z + Math.cos(s.rotation) * front, ...HOUSE_GLOW });
    }
    return list;
  }, [slots]);

  // 각 빛 번짐의 자리·크기·색을 한 번만 적어 둡니다 (매 장면 계산 없음)
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const color = new THREE.Color();
    glows.forEach((g, i) => {
      // 광장(높이 0.04) 위에도 보이게 살짝 띄움
      m.compose(new THREE.Vector3(g.x, 0.06, g.z), flat, new THREE.Vector3(g.radius * 2, g.radius * 2, 1));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(g.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [glows]);

  return (
    <instancedMesh key={glows.length} ref={ref} args={[undefined, undefined, glows.length]} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={softDot()}
        transparent
        opacity={GLOW_OPACITY}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
