"use client";

// 장식 단계(level 0~10)에 따라 마을에 장식을 얹는 컴포넌트입니다.
// 어떤 단계에 무엇이 보이는지는 lib/decor/decorTable.ts의 표(visibleStages, giftLayout)가 정합니다.
// 여기서는 "각 장식 이름 → 임시 3D 모양"만 연결합니다. (진짜 모델로 바꿀 때 이 파일의 모양만 교체)
// level 0이면 아무것도 그리지 않아서 트리와 광장이 완전히 비어 있습니다.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Kit } from "./Kit";
import { BULB_COLORS, BulbString } from "./BulbString";
import { InstancedKit, placement } from "./InstancedKit";
import { NIGHT_GLOW, useNight } from "./nightContext";
import { Firework } from "./Firework";
import { giftLayout, visibleStages, type DecorKey } from "@/lib/decor/decorTable";
import {
  LAMP_TOP_Y,
  TREE_HEIGHT,
  treeSurfaceRadius,
  lampPositions,
  type HouseSlot,
} from "@/lib/village/layout";

// ───────── 트리에 거는 장식(오너먼트) 위치 ─────────
// angle: 트리 둘레 방향(라디안, 0 = 카메라 쪽 정면), t: 높이 비율(0 = 바닥, 1 = 꼭대기)
type OrnamentSlot = { angle: number; t: number };

type OrnamentKey = Extract<DecorKey, "red_bauble" | "yellow_bell" | "stocking" | "snowflake" | "cookie">;

/** 종류별 3개씩의 고정 자리. 앞쪽에서 잘 보이도록 정면 근처에 많이 두고, 하나씩은 옆으로 돌려 놓았습니다. */
const ORNAMENT_SLOTS: Record<OrnamentKey, OrnamentSlot[]> = {
  red_bauble: [
    { angle: -0.55, t: 0.2 },
    { angle: 0.75, t: 0.34 },
    { angle: 2.5, t: 0.27 },
  ],
  yellow_bell: [
    { angle: 0.1, t: 0.46 },
    { angle: -1.45, t: 0.33 },
    { angle: 1.7, t: 0.48 },
  ],
  stocking: [
    { angle: -0.2, t: 0.14 },
    { angle: 1.2, t: 0.22 },
    { angle: -1.9, t: 0.2 },
  ],
  snowflake: [
    { angle: 0.45, t: 0.52 },
    { angle: -0.9, t: 0.5 },
    { angle: 2.2, t: 0.42 },
  ],
  cookie: [
    { angle: -0.05, t: 0.3 },
    { angle: 1.5, t: 0.38 },
    { angle: -2.3, t: 0.36 },
  ],
};


/** 오너먼트 한 개의 3D 좌표와 바깥 방향 */
function ornamentTransform({ angle, t }: OrnamentSlot) {
  const r = treeSurfaceRadius(t);
  return {
    position: [Math.sin(angle) * r, t * TREE_HEIGHT, Math.cos(angle) * r] as [number, number, number],
    // 장식 앞면이 트리 바깥을 보게 돌림
    rotationY: angle,
  };
}

const SNOWFLAKES = ["snowflake-a", "snowflake-b", "snowflake-c"] as const;
const STOCKINGS = ["sock-red", "sock-green", "sock-red-cane"] as const;

// ───────── 교체하기 쉬운 임시 모양들 ─────────
// Bauble·Bell·Cookie는 KayKit 모델, SpiralBeads·StarShape는 직접 만든 모양입니다.
// 모양을 바꾸고 싶으면 해당 함수 하나의 안쪽만 고치면 됩니다. (바깥 코드는 그대로)

/** 빨간 방울: KayKit 리본 공 모델(present_sphere_A_red)을 거는 방울로 씁니다 */
function Bauble() {
  return <Kit pack="kaykit" name="present_sphere_A_red" scale={1.5} position={[0, -0.1, 0.2]} />;
}

/** 노란 종: KayKit bell 모델 */
function Bell() {
  return <Kit pack="kaykit" name="bell" scale={1.3} position={[0, 0.1, 0.2]} />;
}

/** 쿠키: KayKit 진저브레드맨을 눕힌 모양에서 세워서 트리에 붙임 */
function Cookie() {
  return <Kit pack="kaykit" name="gingerbread_man" scale={2.6} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.25]} />;
}

/** 트리에 거는 오너먼트는 숲 속 큰 트리에서도 잘 보이도록 이 배율만큼 키웁니다 */
const ORNAMENT_SCALE = 1.5;

/** 오너먼트 종류별로 어떤 모양을 쓸지 연결합니다 */
function Ornament({ kind, slot, index }: { kind: OrnamentKey; slot: OrnamentSlot; index: number }) {
  const { position, rotationY } = ornamentTransform(slot);
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={ORNAMENT_SCALE}>
      {kind === "red_bauble" && <Bauble />}
      {kind === "yellow_bell" && <Bell />}
      {kind === "stocking" && <Kit name={STOCKINGS[index % 3]} scale={1.6} position={[0, -0.3, 0.1]} />}
      {kind === "snowflake" && <Kit name={SNOWFLAKES[index % 3]} scale={1.8} position={[0.3, -0.3, 0.2]} />}
      {kind === "cookie" && <Cookie />}
    </group>
  );
}

// ───────── 마을 장식 ─────────

/** 가로등 사이를 잇는 알전구 줄 (1단계) */
function StringLights() {
  const pairs = useMemo(() => {
    const lamps = lampPositions();
    return lamps.map((a, i) => {
      const b = lamps[(i + 1) % lamps.length];
      return {
        from: [a.x, LAMP_TOP_Y, a.z] as [number, number, number],
        to: [b.x, LAMP_TOP_Y, b.z] as [number, number, number],
      };
    });
  }, []);
  return (
    <group>
      {pairs.map((p, i) => (
        <BulbString key={i} from={p.from} to={p.to} sag={0.8} count={10} size={0.15} />
      ))}
    </group>
  );
}

/**
 * 집 지붕 테두리를 따라 다는 전구 줄 (집 안쪽 좌표 기준. 앞면이 +z) — 11.25 사용자 요청: 시안처럼
 * 지붕 부품을 재서 얻은 값입니다: 처마 끝 x ±2.45·높이 1.75, 용마루(꼭대기) 높이 4.3, 지붕 앞뒤 끝 z ±2.3
 * - 앞 박공(삼각형) 두 변: 왼쪽 처마 → 꼭대기 → 오른쪽 처마
 * - 양옆 처마: 앞에서 뒤로 곧게
 */
const EAVE = { x: 2.45, y: 1.75 };
const RIDGE_Y = 4.3;
const ROOF_Z = 2.3;
const ROOF_LIGHTS: { from: [number, number, number]; to: [number, number, number]; count: number }[] = [
  { from: [-EAVE.x, EAVE.y, ROOF_Z], to: [0, RIDGE_Y, ROOF_Z], count: 9 },
  { from: [0, RIDGE_Y, ROOF_Z], to: [EAVE.x, EAVE.y, ROOF_Z], count: 9 },
  { from: [-EAVE.x, EAVE.y, ROOF_Z], to: [-EAVE.x, EAVE.y, -ROOF_Z], count: 11 },
  { from: [EAVE.x, EAVE.y, ROOF_Z], to: [EAVE.x, EAVE.y, -ROOF_Z], count: 11 },
];

/** 집마다 번갈아 놓는 옆 장식: 장식된 작은 트리 / 눈사람 A / 눈사람 B (KayKit). 위치는 집 안쪽 좌표 */
const SIDE_PROPS = [
  { name: "christmas_tree_decorated", local: placement([3.1, 0, 1.4], 0, 0.6) },
  { name: "snowman_A", local: placement([3.0, 0, 1.6], -0.4, 0.9) },
  { name: "snowman_B", local: placement([3.0, 0, 1.6], -0.4, 0.8) },
] as const;
/** 현관문(왼쪽 칸) 위의 리스. 위치는 집 안쪽 좌표 */
const DOOR_WREATH = placement([-0.95, 1.7, 2.35], 0, 0.55);
/** 집 한 채의 지붕 전구 개수 */
const ROOF_BULBS = ROOF_LIGHTS.reduce((sum, l) => sum + l.count, 0);
const ROOF_BULB_SIZE = 0.09;
const ROOF_BULB_SAG = 0.08;

/** 모든 집의 지붕 테두리 전구를 한 번에 그립니다 (집이 많아져도 그리기 명령은 1번) */
function RoofLights({ houses }: { houses: THREE.Matrix4[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const night = useNight();
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new THREE.Matrix4();
    const point = new THREE.Vector3();
    const color = new THREE.Color();
    let n = 0;
    for (const house of houses) {
      for (const { from, to, count } of ROOF_LIGHTS) {
        for (let i = 0; i < count; i++) {
          const t = (i + 0.5) / count;
          // 직선 위의 점에서, 가운데일수록 아래로 살짝 내림 (BulbString과 같은 계산)
          const droop = ROOF_BULB_SAG * 4 * t * (1 - t);
          point
            .set(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - droop, from[2] + (to[2] - from[2]) * t)
            .applyMatrix4(house);
          m.setMatrixAt(n, matrix.setPosition(point));
          // 밤에는 색을 몇 배로 밝혀서 빛 번짐 효과가 불빛처럼 퍼뜨리게 합니다
          m.setColorAt(n, color.set(BULB_COLORS[i % BULB_COLORS.length]).multiplyScalar(night ? NIGHT_GLOW : 1));
          n++;
        }
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [houses, night]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, houses.length * ROOF_BULBS]} frustumCulled={false}>
      <sphereGeometry args={[ROOF_BULB_SIZE, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * 집 옆 장식 + 현관 리스 + 지붕 테두리 전구 줄 (4단계)
 * ⚡ 집마다 따로 그리지 않고, 같은 모델끼리 모아 한 번에 그립니다 (InstancedKit)
 */
function HouseDecor({ slots }: { slots: HouseSlot[] }) {
  const { houses, wreaths, props } = useMemo(() => {
    // 집마다 "집 안쪽 좌표 → 마을 좌표"로 바꾸는 행렬
    const houses = slots.map((s) => placement([s.x, 0, s.z], s.rotation));
    return {
      houses,
      wreaths: houses.map((h) => h.clone().multiply(DOOR_WREATH)),
      // 옆 장식 종류별로 그 장식을 놓을 집들만 모읍니다
      props: SIDE_PROPS.map((prop, kind) =>
        houses.filter((_, i) => i % SIDE_PROPS.length === kind).map((h) => h.clone().multiply(prop.local)),
      ),
    };
  }, [slots]);

  return (
    <group>
      <InstancedKit pack="kaykit" name="wreath" matrices={wreaths} />
      {SIDE_PROPS.map((prop, kind) => (
        <InstancedKit key={prop.name} pack="kaykit" name={prop.name} matrices={props[kind]} />
      ))}
      <RoofLights key={houses.length} houses={houses} />
    </group>
  );
}

/** 광장에 놓는 분위기용 소품 (1단계부터): 눈사람과 눈덩이 더미 (KayKit). 0단계는 완전히 비워 둡니다 */
function AmbientProps() {
  const snowman = { a: -1.75, r: 6.4 };
  const pile = { a: -2.5, r: 6.2 };
  return (
    <group>
      <Kit
        pack="kaykit"
        name="snowman_A"
        scale={1.1}
        position={[Math.sin(snowman.a) * snowman.r, 0, Math.cos(snowman.a) * snowman.r]}
        rotation={[0, Math.PI / 3, 0]}
      />
      <Kit
        pack="kaykit"
        name="snowball_pile"
        scale={1.2}
        position={[Math.sin(pile.a) * pile.r, 0, Math.cos(pile.a) * pile.r]}
      />
    </group>
  );
}

/** 썰매에 실린 선물 더미 (KayKit 선물 모델) */
function SledLoad() {
  return (
    <group position={[0, 0.3, -0.2]}>
      <Kit pack="kaykit" name="present_D_green" scale={0.9} position={[0, 0, -0.1]} />
      <Kit pack="kaykit" name="present_A_red" scale={0.8} position={[0.1, 0.9, -0.1]} rotation={[0, 0.5, 0]} />
      <Kit pack="kaykit" name="present_sphere_B_green" scale={0.8} position={[0.1, 0, 0.7]} />
    </group>
  );
}

/** 광장의 루돌프 썰매 (8단계): 루돌프·썰매는 Kenney, 선물 짐은 KayKit */
const SANTA_ANGLE = -0.95; // 광장 왼쪽 앞
const SANTA_RADIUS = 6.4;
function SantaRudolph() {
  const x = Math.sin(SANTA_ANGLE) * SANTA_RADIUS;
  const z = Math.cos(SANTA_ANGLE) * SANTA_RADIUS;
  // 광장 둘레를 따라(접선 방향) 서 있게 돌림
  const rotation = Math.atan2(Math.cos(SANTA_ANGLE), -Math.sin(SANTA_ANGLE));
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <Kit name="reindeer" scale={1.8} position={[0, 0, 1.9]} />
      <Kit name="sled" scale={1.8} position={[0, 0, -0.2]} />
      <SledLoad />
    </group>
  );
}

/** 구슬 줄 색: 크림색 줄에 빨강·파랑·금색 구슬이 섞임 (KayKit 트리 느낌) */
const BEAD_COLORS = ["#ead7a6", "#ead7a6", "#d9a441", "#ead7a6", "#c0394a", "#ead7a6", "#3f7fc0"];
const BEAD_COUNT = 150;

/** 트리를 감싸는 나선 구슬 줄 (9단계). 교체할 때 이 함수만 바꾸면 됩니다 */
function TreeGarland() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // 밤에는 구슬이 작은 전구처럼 스스로 빛납니다
  const night = useNight();
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const TURNS = 4.5;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < BEAD_COUNT; i++) {
      const f = i / (BEAD_COUNT - 1);
      const t = 0.07 + f * 0.8; // 높이 비율
      const angle = f * TURNS * Math.PI * 2;
      const r = treeSurfaceRadius(t) + 0.15;
      matrix.setPosition(Math.sin(angle) * r, t * TREE_HEIGHT, Math.cos(angle) * r);
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, color.set(BEAD_COLORS[i % BEAD_COLORS.length]).multiplyScalar(night ? NIGHT_GLOW * 0.55 : 1));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [night]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BEAD_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[0.28, 10, 10]} />
      {night ? <meshBasicMaterial toneMapped={false} /> : <meshStandardMaterial roughness={0.55} />}
    </instancedMesh>
  );
}

/** 별 모양 (뾰족한 5각형을 두껍게 늘린 것) */
function createStarGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const OUTER = 1.0;
  const INNER = 0.5;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? OUTER : INNER;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2; // 첫 뾰족한 끝이 위를 보게
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  shape.closePath();
  // bevel: 모서리를 둥글게 깎아 통통한 장난감 별처럼 만듭니다
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.16,
    bevelSegments: 4,
  });
  geo.center();
  return geo;
}

const FIREWORKS = [
  { offset: [-4.5, 3.5, 1] as [number, number, number], color: "#ff6b6b", delay: 0 },
  { offset: [4.8, 5, 0] as [number, number, number], color: "#ffd45c", delay: 0.8 },
];

/** 트리 꼭대기 별 (임시 모양: 별 모양을 두껍게 늘린 것). 교체할 때 이 함수만 바꾸면 됩니다 */
function StarShape() {
  const geometry = useMemo(() => createStarGeometry(), []);
  return (
    <mesh geometry={geometry} position={[0, TREE_HEIGHT + 0.6, 0]} scale={1.6}>
      {/* KayKit 별과 비슷한 부드러운 금색, 윤기 적게 */}
      <meshStandardMaterial color="#e9b23c" emissive="#c98a1b" emissiveIntensity={0.35} roughness={0.6} />
    </mesh>
  );
}

/** 트리 꼭대기의 큰 별과 폭죽 (10단계) */
function StarAndFireworks() {
  return (
    <group>
      <StarShape />
      {FIREWORKS.map((f, i) => (
        <Firework key={i} position={[f.offset[0], TREE_HEIGHT + f.offset[1], f.offset[2]]} color={f.color} delay={f.delay} />
      ))}
    </group>
  );
}

// ───────── 트리 아래 선물 ─────────

/** 단계별 선물 모델(KayKit)과 모델 높이. 쌓는 선물(4·7·10단계)은 아래 선물보다 작은 모델을 골랐습니다. */
const GIFT_BY_LEVEL: { model: string; height: number }[] = [
  { model: "present_A_red", height: 0.66 }, // 1
  { model: "present_B_blue", height: 1.06 }, // 2
  { model: "present_D_green", height: 1.06 }, // 3
  { model: "present_C_yellow", height: 0.46 }, // 4 (3번 위에 쌓음)
  { model: "present_A_green", height: 0.66 }, // 5
  { model: "present_C_white", height: 0.46 }, // 6
  { model: "present_sphere_A_red", height: 0.44 }, // 7 (6번 위에 쌓음)
  { model: "present_B_red", height: 1.06 }, // 8
  { model: "present_E_red", height: 0.46 }, // 9
  { model: "present_sphere_B_green", height: 0.57 }, // 10 (9번 위에 쌓음)
];
/** 바닥 선물이 놓이는 자리 (트리 둘레와 가로등 사이, 광장 오른쪽 앞부터). 반지름은 번갈아 달리해 자연스럽게 */
const GIFT_FLOOR_SPOTS: { angle: number; radius: number }[] = [
  { angle: 0.55, radius: 6.0 },
  { angle: 0.95, radius: 6.4 },
  { angle: 1.35, radius: 5.9 },
  { angle: 1.75, radius: 6.3 },
  { angle: 2.15, radius: 5.9 },
  { angle: 2.55, radius: 6.3 },
  { angle: 0.2, radius: 6.5 },
];
const GIFT_SCALE = 1.1;

function Gifts({ level }: { level: number }) {
  const placed = useMemo(() => {
    const list: { x: number; y: number; z: number; rot: number; model: string; height: number }[] = [];
    let floorIndex = 0;
    giftLayout(level).forEach((gift, i) => {
      const { model, height } = GIFT_BY_LEVEL[i % GIFT_BY_LEVEL.length];
      const prev = list[i - 1];
      if (gift.stacked && prev) {
        // 바로 앞 선물 위에 올림 (살짝 비틀어서 자연스럽게)
        list.push({ x: prev.x, z: prev.z, y: prev.y + prev.height * GIFT_SCALE, rot: prev.rot + 0.6, model, height });
      } else {
        const spot = GIFT_FLOOR_SPOTS[floorIndex % GIFT_FLOOR_SPOTS.length];
        floorIndex++;
        list.push({
          x: Math.sin(spot.angle) * spot.radius,
          z: Math.cos(spot.angle) * spot.radius,
          y: 0,
          rot: spot.angle * 2,
          model,
          height,
        });
      }
    });
    return list;
  }, [level]);

  return (
    <group>
      {placed.map((g, i) => (
        <Kit key={i} pack="kaykit" name={g.model} position={[g.x, g.y, g.z]} rotation={[0, g.rot, 0]} scale={GIFT_SCALE} />
      ))}
    </group>
  );
}

// ───────── 전체 ─────────

interface DecorationsProps {
  /** 장식 단계 (0~10). 0이면 아무것도 그리지 않음 */
  level: number;
  /** 집 자리 (집 옆 장식용) */
  slots: HouseSlot[];
}

const ORNAMENT_KEYS = Object.keys(ORNAMENT_SLOTS) as OrnamentKey[];

export function Decorations({ level, slots }: DecorationsProps) {
  const keys = new Set(visibleStages(level).map((s) => s.key));
  if (level <= 0) return null;

  return (
    <group>
      {keys.has("string_lights") && <StringLights />}
      <AmbientProps />
      {ORNAMENT_KEYS.filter((k) => keys.has(k)).map((kind) =>
        ORNAMENT_SLOTS[kind].map((slot, i) => <Ornament key={`${kind}-${i}`} kind={kind} slot={slot} index={i} />),
      )}
      {keys.has("house_decor") && <HouseDecor slots={slots} />}
      {keys.has("santa_rudolph") && <SantaRudolph />}
      {keys.has("tree_garland") && <TreeGarland />}
      {keys.has("star") && <StarAndFireworks />}
      <Gifts level={level} />
    </group>
  );
}
