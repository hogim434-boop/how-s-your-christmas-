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
//  - 진짜 불빛은 하나도 쓰지 않습니다. 트리 앞 불빛도 가짜 빛으로 바꿨습니다 (사용자 요청: 모든 조명은 가짜 빛으로)
//  - 달빛 그림자는 그림자 지도 크기를 2048 → 1024로 줄이고, 집·트리가 바뀔 때만 다시 그립니다 (ShadowFlags.tsx)

import { useEffect, useMemo } from "react";
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
  /** (x, z) 위치의 땅 높이. 바닥에 비친 빛이 땅의 굴곡을 따라가게 하는 데 씁니다 (안 주면 평평한 땅으로 봅니다: 첫 화면) */
  heightAt?: (x: number, z: number) => number;
}

/** 평평한 땅 (높이를 안 줬을 때) */
const FLAT_GROUND = () => 0;

export function NightAtmosphere({ villageRadius, slots, heightAt = FLAT_GROUND }: NightAtmosphereProps) {
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

      {/* 가로등 아래·집 앞 눈밭에 비친 따뜻한 빛 (가짜 빛, 한 번에 그림) */}
      <GroundGlows slots={slots} heightAt={heightAt} />

      {/* 마을 안에 내리는 눈 (아침과 같은 눈, 밤에는 살짝 푸른빛) */}
      <VillageSnow villageRadius={villageRadius} color="#e8eeff" opacity={0.9} />
    </>
  );
}

// ───────── 가짜 빛: 눈밭에 비친 불빛 ─────────

/** 빛 번짐 한 장의 정보: 위치, 반지름, 색 */
type Glow = { x: number; z: number; radius: number; color: string };

/** 트리 밑 빛 (예전 진짜 불빛: 트리 앞 범위 14). 트리 자체는 GiantTree.tsx에서 스스로 살짝 빛납니다 */
const TREE_GLOW = { x: 0, z: 1.5, radius: 6.5, color: "#ffc98a" };
/** 가로등 아래 빛 (예전 진짜 불빛: 범위 7) */
const LAMP_GLOW = { radius: 3.2, color: "#ffcf8a" };
/** 집 앞 창문 빛 (예전 진짜 불빛: 범위 5 × 집 배율) */
const HOUSE_GLOW = { radius: 2.4 * HOUSE_RATIO, color: "#ffb870" };
/** 빛 번짐의 진하기 (더하기 방식이라 아래 눈 색에 이만큼 따뜻한 색이 더해집니다) */
const GLOW_OPACITY = 0.5;

/** 빛 번짐 한 장을 이루는 그물의 촘촘함 (둘레 방향 칸 수, 바깥 방향 칸 수) */
const GLOW_GRID = { around: 32, outward: 10 };
/** 땅에서 띄우는 높이 (땅과 겹쳐 떨리지 않을 만큼만) */
const GLOW_LIFT = 0.07;
/** 광장 돌바닥의 높이 (PlazaFloor). 빛 번짐이 이보다 아래로 내려가지 않게 합니다 */
const PLAZA_FLOOR_Y = 0.04;

function GroundGlows({ slots, heightAt }: { slots: HouseSlot[]; heightAt: (x: number, z: number) => number }) {
  // 💡 예전에는 평평한 종이 한 장을 높이 0.06에 깔았습니다. 그런데 광장 테두리의 눈 둔덕(높이 0.3)이 그 종이를 가려서
  //    "둔덕만 어둡고 그 밑에 빛이 깔린" 것처럼 보였습니다. (11.29 사용자 피드백)
  //    → 빛 번짐을 땅 높이를 따라 굽은 그물로 만들어, 둔덕 위에도 빛이 그대로 비치게 합니다.
  //    모든 빛 번짐을 한 덩어리로 합쳐 두므로 그리기는 여전히 1번이고, 처음 한 번만 계산합니다.
  const geometry = useMemo(() => {
    const glows: Glow[] = [TREE_GLOW, ...LAMPS.map((p) => ({ x: p.x, z: p.z, ...LAMP_GLOW }))];
    for (const s of slots) {
      // 집 앞(광장 쪽)으로 집 크기만큼 떨어진 곳 = 예전 집 앞 불빛 바로 아래
      const front = 1.9 * HOUSE_SCALE;
      glows.push({ x: s.x + Math.sin(s.rotation) * front, z: s.z + Math.cos(s.rotation) * front, ...HOUSE_GLOW });
    }
    const { around, outward } = GLOW_GRID;
    const perGlow = 1 + around * outward; // 가운데 점 1개 + 동심원 위의 점들
    const positions = new Float32Array(glows.length * perGlow * 3);
    const uvs = new Float32Array(glows.length * perGlow * 2);
    const colors = new Float32Array(glows.length * perGlow * 3);
    const index: number[] = [];
    const color = new THREE.Color();
    glows.forEach((g, n) => {
      const base = n * perGlow;
      color.set(g.color);
      const put = (i: number, dx: number, dz: number) => {
        const x = g.x + dx * g.radius;
        const z = g.z + dz * g.radius;
        positions.set([x, Math.max(heightAt(x, z), PLAZA_FLOOR_Y) + GLOW_LIFT, z], (base + i) * 3);
        // 빛 번짐 그림(가운데가 밝고 가장자리로 사라지는 동그라미)의 어느 자리인지
        uvs.set([0.5 + dx / 2, 0.5 + dz / 2], (base + i) * 2);
        colors.set([color.r, color.g, color.b], (base + i) * 3);
      };
      put(0, 0, 0);
      for (let r = 1; r <= outward; r++) {
        for (let a = 0; a < around; a++) {
          const angle = (a / around) * Math.PI * 2;
          put(1 + (r - 1) * around + a, (Math.cos(angle) * r) / outward, (Math.sin(angle) * r) / outward);
        }
      }
      // 점들을 세모로 잇기: 가운데 부채꼴 + 동심원 사이의 띠
      for (let a = 0; a < around; a++) {
        const next = (a + 1) % around;
        index.push(base, base + 1 + next, base + 1 + a);
        for (let r = 1; r < outward; r++) {
          const inner = base + 1 + (r - 1) * around;
          const outer = inner + around;
          index.push(inner + a, inner + next, outer + next, inner + a, outer + next, outer + a);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(index);
    return geo;
  }, [slots, heightAt]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial
        map={softDot()}
        vertexColors
        transparent
        opacity={GLOW_OPACITY}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
