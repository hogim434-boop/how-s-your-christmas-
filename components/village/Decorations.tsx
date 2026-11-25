"use client";

// 장식 단계(level 0~10)에 따라 마을에 장식을 얹는 컴포넌트입니다.
// 어떤 단계에 무엇이 보이는지는 lib/decor/decorTable.ts의 표(visibleStages, giftLayout)가 정합니다.
// 여기서는 "각 장식 이름 → 임시 3D 모양"만 연결합니다. (진짜 모델로 바꿀 때 이 파일의 모양만 교체)
// level 0이면 아무것도 그리지 않아서 트리와 광장이 완전히 비어 있습니다.

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Kit } from "./Kit";
import { BULB_COLORS, BulbString } from "./BulbString";
import { InstancedKit, placement } from "./InstancedKit";
import { NIGHT_GLOW, useNight } from "./nightContext";
import { Fireworks } from "./Firework";
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

/**
 * 트리에 거는 오너먼트 종류.
 * 앞의 5가지는 장식표의 단계와 이름이 같고, 뒤의 2가지(초록 방울·지팡이 사탕)는
 * 트리 위쪽을 채우려고 더한 짝꿍 장식입니다. 짝꿍은 ORNAMENT_STAGE에 적힌 단계에 함께 나타납니다.
 * (11.25 사용자 요청: 장식이 부족해 보임, 특히 위쪽. 같은 장식을 늘리지 않고 새 장식으로)
 */
type OrnamentKey = "red_bauble" | "yellow_bell" | "stocking" | "snowflake" | "cookie" | "green_bauble" | "candy_cane";

/** 각 오너먼트가 어느 장식 단계에 나타나는지 */
const ORNAMENT_STAGE: Record<OrnamentKey, DecorKey> = {
  red_bauble: "red_bauble",
  yellow_bell: "yellow_bell",
  stocking: "stocking",
  snowflake: "snowflake",
  cookie: "cookie",
  // 초록 방울은 빨간 방울과 함께(2단계), 지팡이 사탕은 산타 양말과 함께(5단계)
  green_bauble: "red_bauble",
  candy_cane: "stocking",
};

/**
 * 종류별 3개씩의 고정 자리.
 * 원래 5가지는 아래쪽·정면 근처에, 새로 더한 초록 방울·지팡이 사탕은 위쪽에 답니다.
 * 둘레 방향은 정면·좌우에 고르게 돌려 놓았습니다.
 */
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
  green_bauble: [
    { angle: -1.15, t: 0.6 },
    { angle: 0.7, t: 0.71 },
    { angle: -0.3, t: 0.83 },
  ],
  candy_cane: [
    { angle: 1.1, t: 0.61 },
    { angle: -0.55, t: 0.68 },
    { angle: 0.15, t: 0.76 },
  ],
};

/**
 * 높이에 따른 크기 배율: 위쪽 가지는 좁아서 같은 크기로 달면 커 보입니다.
 * 중간(높이 45%)까지는 원래 크기, 꼭대기 쪽(90%)으로 갈수록 65%까지 작아집니다.
 */
function sizeAtHeight(t: number): number {
  const f = Math.min(1, Math.max(0, (t - 0.45) / 0.45));
  return 1 - 0.35 * f;
}

/**
 * 오너먼트를 거는 자리: 잎 표면에서 이만큼 바깥(가지 끝).
 * 트리는 아래로 갈수록 넓어지므로, 조금 띄워야 늘어진 장식이 아래층 잎에 파묻히지 않습니다.
 */
const HANG_OUT = 0.5;

/** 오너먼트가 걸리는 점(끈의 위쪽 끝)의 3D 좌표와 바깥 방향 */
function ornamentTransform({ angle, t }: OrnamentSlot) {
  const r = treeSurfaceRadius(t) + HANG_OUT;
  return {
    position: [Math.sin(angle) * r, t * TREE_HEIGHT, Math.cos(angle) * r] as [number, number, number],
    // 장식 앞면이 트리 바깥을 보게 돌림
    rotationY: angle,
  };
}

const SNOWFLAKES = ["snowflake-a", "snowflake-b", "snowflake-c"] as const;
const STOCKINGS = ["sock-red", "sock-green", "sock-red-cane"] as const;

// ───────── 오너먼트 모양 ─────────
// 11.25 사용자 요청: 장식이 너무 커서 트리에 붙인 스티커처럼 보임 → 실제로 가지에 매단 것처럼
//  - 크기를 절반 정도로 (쿠키는 특히 컸어서 더 많이)
//  - 가지 끝에서 "끈"으로 아래로 늘어뜨림
//  - 바람에 살랑살랑 흔들림 (장식마다 박자가 조금씩 다름)
//
// 표의 값은 모델을 재서 정했습니다.
//  scale: 크기 배율, top: 모델에서 끈을 묶는 꼭대기 높이, centerX: 모델의 좌우 가운데(끈 바로 아래로 오게 맞춤)
type OrnamentLook = { pack: "kenney" | "kaykit"; scale: number; top: number; centerX?: number; rotationX?: number };
const ORNAMENT_LOOK: Record<OrnamentKey, OrnamentLook> = {
  // 빨간 방울: KayKit 리본 공 (지름 약 0.75)
  red_bauble: { pack: "kaykit", scale: 1.3, top: 0.44 },
  // 노란 종: KayKit bell (폭 약 0.85)
  yellow_bell: { pack: "kaykit", scale: 1.05, top: 0.6 },
  // 양말: Kenney sock (길이 약 0.9)
  stocking: { pack: "kenney", scale: 1.4, top: 0.64 },
  // 눈꽃: Kenney snowflake (약 0.7). 모델이 한쪽으로 치우쳐 있어 가운데를 맞춤
  snowflake: { pack: "kenney", scale: 1.75, top: 0.4, centerX: -0.175 },
  // 쿠키: KayKit 진저브레드맨 (키 약 1.0). 누워 있는 모델이라 세워서 얼굴이 바깥을 보게 함
  cookie: { pack: "kaykit", scale: 1.35, top: 0.4, rotationX: Math.PI / 2 },
  // 초록 방울: KayKit 리본 공 초록 (지름 약 0.75)
  green_bauble: { pack: "kaykit", scale: 0.95, top: 0.57 },
  // 지팡이 사탕: Kenney candy-cane (길이 약 0.8). 빨강·초록을 번갈아 답니다
  candy_cane: { pack: "kenney", scale: 1.8, top: 0.45 },
};

/** 종류와 순번으로 모델 이름을 정합니다 */
function ornamentModel(kind: OrnamentKey, index: number): string {
  if (kind === "red_bauble") return "present_sphere_A_red";
  if (kind === "yellow_bell") return "bell";
  if (kind === "cookie") return "gingerbread_man";
  if (kind === "green_bauble") return "present_sphere_B_green";
  if (kind === "candy_cane") return index % 2 === 0 ? "candy-cane-red" : "candy-cane-green";
  if (kind === "stocking") return STOCKINGS[index % 3];
  return SNOWFLAKES[index % 3];
}

/**
 * 밤의 오너먼트 빛 (가짜 빛, 11.25 사용자 요청: 밤에 장식이 밋밋함)
 * self: 장식이 자기 색으로 스스로 빛나는 정도.
 * (장식 뒤에 둥근 빛 번짐 그림도 깔아 봤지만, 사용자 요청으로 뺐습니다)
 */
const ORNAMENT_NIGHT = { self: 0.55 };

/** 끈 길이와 굵기, 색 */
const CORD = { length: 0.28, radius: 0.014, color: "#d9b25a" };
/** 흔들림: 좌우·앞뒤로 기우는 최대 각도(라디안)와 빠르기 */
const SWAY = { side: 0.09, front: 0.05, speed: 1.2 };

/** 가지 끝에 끈으로 매달려 살랑살랑 흔들리는 오너먼트 한 개 */
function Ornament({ kind, slot, index }: { kind: OrnamentKey; slot: OrnamentSlot; index: number }) {
  const { position, rotationY } = ornamentTransform(slot);
  const look = ORNAMENT_LOOK[kind];
  // 위쪽 장식일수록 작게 (끈 길이도 함께)
  const size = sizeAtHeight(slot.t);
  const scale = look.scale * size;
  const cord = CORD.length * size;
  // 초록 지팡이 사탕 모델은 한쪽으로 치우쳐 있어서 가운데를 따로 맞춥니다
  const centerX = kind === "candy_cane" && index % 2 === 1 ? -0.1 : (look.centerX ?? 0);
  const swing = useRef<THREE.Group>(null);
  const night = useNight();
  // 장식마다 흔들리는 박자와 돌아간 방향을 다르게 (자리 값으로 정해 새로고침해도 같음)
  const phase = slot.angle * 3.1 + slot.t * 17 + index;

  useFrame(({ clock }) => {
    const g = swing.current;
    if (!g) return;
    const time = clock.elapsedTime * SWAY.speed;
    // 끈을 묶은 점(이 그룹의 원점)을 축으로 진자처럼 흔들립니다
    g.rotation.z = Math.sin(time + phase) * SWAY.side;
    g.rotation.x = Math.sin(time * 0.73 + phase * 1.7) * SWAY.front;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group ref={swing}>
        {/* 끈 */}
        <mesh position={[0, -cord / 2, 0]}>
          <cylinderGeometry args={[CORD.radius, CORD.radius, cord, 5]} />
          <meshStandardMaterial color={CORD.color} roughness={0.6} />
        </mesh>
        {/* 장식: 꼭대기가 끈 아래 끝에 오도록 내려 달고, 살짝 틀어서 손으로 단 느낌을 냅니다 */}
        <group position={[0, -cord, 0]} rotation={[0, Math.sin(phase) * 0.35, 0]}>
          <Kit
            pack={look.pack}
            name={ornamentModel(kind, index)}
            // 밤에는 장식이 자기 색으로 살짝 빛납니다
            glow={night ? ORNAMENT_NIGHT.self : 0}
            scale={scale}
            rotation={[look.rotationX ?? 0, 0, 0]}
            position={[-centerX * scale, -look.top * scale, 0]}
          />
        </group>
      </group>
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

/** 꼬마전구 줄: 전구 수, 크기, 몇 바퀴 감는지 */
const FAIRY = { count: 280, radius: 0.085, turns: 6.5 };

/**
 * 트리를 꼭대기까지 감는 꼬마전구 줄 (9단계, 구슬 줄과 함께). — 11.25 사용자 요청
 * 구슬 줄과 반대 방향으로 감아서 서로 엇갈리고, 트리 위쪽의 빈 곳을 채웁니다.
 * 밤에는 전구가 스스로 빛나서(빛 번짐) 트리와 오너먼트 둘레가 반짝입니다.
 * 전구 280개를 한 번에 그리므로(InstancedMesh) 부담이 거의 없습니다.
 */
function TreeFairyLights() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const night = useNight();
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < FAIRY.count; i++) {
      const f = i / (FAIRY.count - 1);
      const t = 0.1 + f * 0.84; // 높이 비율: 아래(10%)부터 꼭대기 바로 밑(94%)까지
      // 구슬 줄과 반대 방향(-)으로 감고, 줄이 가지에 걸쳐 살짝 늘어진 것처럼 높이를 조금 출렁이게 합니다
      const angle = -f * FAIRY.turns * Math.PI * 2;
      const r = treeSurfaceRadius(t) + 0.12;
      const droop = Math.sin(f * FAIRY.turns * 14) * 0.07;
      matrix.setPosition(Math.sin(angle) * r, t * TREE_HEIGHT + droop, Math.cos(angle) * r);
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, color.set(BULB_COLORS[i % BULB_COLORS.length]).multiplyScalar(night ? NIGHT_GLOW : 1));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [night]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, FAIRY.count]} frustumCulled={false}>
      <sphereGeometry args={[FAIRY.radius, 8, 8]} />
      {/* 조명과 상관없이 불 켜진 것처럼 밝게 */}
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** 구슬 줄 색: 크림색 줄에 빨강·파랑·금색 구슬이 섞임 (KayKit 트리 느낌) */
const BEAD_COLORS = ["#ead7a6", "#ead7a6", "#d9a441", "#ead7a6", "#c0394a", "#ead7a6", "#3f7fc0"];
/** 구슬 수와 크기. 오너먼트를 줄이면서 구슬도 방울(지름 약 0.75)보다 작게 맞췄습니다 (11.25) */
const BEAD_COUNT = 320;
const BEAD_RADIUS = 0.13;

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
      const r = treeSurfaceRadius(t) + 0.1;
      matrix.setPosition(Math.sin(angle) * r, t * TREE_HEIGHT, Math.cos(angle) * r);
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, color.set(BEAD_COLORS[i % BEAD_COLORS.length]).multiplyScalar(night ? NIGHT_GLOW * 0.55 : 1));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [night]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BEAD_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[BEAD_RADIUS, 8, 8]} />
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

/** 십자 모양으로 뻗는 빛살 그림 (별이 반짝일 때의 ✦ 모양). 한 번만 만들어 둡니다 */
let sparkleTexture: THREE.CanvasTexture | null = null;
function sparkle() {
  if (sparkleTexture) return sparkleTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  // 가로·세로로 길쭉한 빛 두 줄을 겹쳐 십자 빛살을 만듭니다
  for (const [sx, sy] of [
    [1, 0.07],
    [0.07, 1],
  ]) {
    ctx.save();
    ctx.translate(c, c);
    ctx.scale(sx, sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, c);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  sparkleTexture = new THREE.CanvasTexture(canvas);
  return sparkleTexture;
}

/** 별 둘레에서 깜빡이는 작은 반짝임들의 자리 (별 기준 좌표)와 박자 */
const TWINKLES = [
  { x: -1.9, y: 1.1, size: 0.9, phase: 0.0 },
  { x: 1.8, y: 1.4, size: 1.1, phase: 1.7 },
  { x: -1.3, y: -1.0, size: 0.7, phase: 3.1 },
  { x: 1.5, y: -0.8, size: 0.8, phase: 4.4 },
  { x: 0.2, y: 2.3, size: 1.0, phase: 2.3 },
  { x: -2.4, y: 0.1, size: 0.6, phase: 5.2 },
  { x: 2.5, y: 0.3, size: 0.7, phase: 0.9 },
];
/** 별 색: 낮의 부드러운 금색 / 밤의 밝게 빛나는 금색 */
const STAR_COLORS = { body: "#e9b23c", glow: "#ffcf5c", ray: "#fff2b8" };

/**
 * 트리 꼭대기 별: 반짝반짝 빛납니다. (11.25 사용자 요청)
 * 모두 가짜 빛입니다(진짜 조명 없음).
 *  - 별 몸통: 스스로 빛나는 밝기가 숨 쉬듯 커졌다 작아짐 (밤에는 빛 번짐 효과가 받아서 환하게 퍼짐)
 *  - 큰 빛살(✦): 별 뒤에서 천천히 돌며 커졌다 작아짐
 *  - 작은 반짝임들: 별 둘레에서 저마다 다른 박자로 깜빡임
 * 별 모양을 교체할 때는 이 함수만 바꾸면 됩니다.
 */
function StarShape() {
  const geometry = useMemo(() => createStarGeometry(), []);
  const night = useNight();
  const body = useRef<THREE.Mesh>(null);
  const rays = useRef<THREE.Sprite>(null);
  const twinkles = useRef<(THREE.Sprite | null)[]>([]);
  // 낮에는 밝은 하늘 위라서 빛을 "더하는" 방식이 잘 안 보입니다 → 낮은 보통 방식, 밤은 더하는 방식
  const blending = night ? THREE.AdditiveBlending : THREE.NormalBlending;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // 숨 쉬듯 천천히 + 가끔 빠르게 반짝 (두 박자를 섞어 기계적이지 않게)
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    const flick = Math.max(0, Math.sin(t * 5.3 + 1)) ** 6;
    const shine = 0.55 * pulse + 0.45 * flick; // 0~1

    if (body.current) {
      const material = body.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = (night ? 1.3 : 0.4) + shine * (night ? 1.6 : 0.5);
      // 별이 좌우로 천천히 돌아 여러 각도에서 반짝여 보입니다
      body.current.rotation.y = Math.sin(t * 0.6) * 0.5;
    }
    if (rays.current) {
      rays.current.scale.setScalar(4.2 + shine * 3.2);
      rays.current.material.rotation = t * 0.35;
      rays.current.material.opacity = (night ? 0.55 : 0.75) + shine * 0.3;
    }
    twinkles.current.forEach((sprite, i) => {
      if (!sprite) return;
      const { size, phase } = TWINKLES[i];
      // 대부분은 꺼져 있다가 잠깐씩 반짝 켜집니다
      const on = Math.max(0, Math.sin(t * 2.6 + phase)) ** 4;
      sprite.scale.setScalar(size * (0.3 + on));
      sprite.material.opacity = on;
      sprite.material.rotation = phase + t * 0.5;
    });
  });

  return (
    <group position={[0, TREE_HEIGHT + 0.6, 0]}>
      {/* 큰 십자 빛살 */}
      <sprite ref={rays} scale={5}>
        <spriteMaterial map={sparkle()} color={STAR_COLORS.ray} transparent opacity={0.7} blending={blending} depthWrite={false} toneMapped={false} />
      </sprite>
      {/* 별 몸통 */}
      <mesh ref={body} geometry={geometry} scale={1.6}>
        <meshStandardMaterial color={STAR_COLORS.body} emissive={STAR_COLORS.glow} emissiveIntensity={0.6} roughness={0.5} />
      </mesh>
      {/* 둘레의 작은 반짝임들 */}
      {TWINKLES.map((tw, i) => (
        <sprite
          key={i}
          ref={(el) => {
            twinkles.current[i] = el;
          }}
          position={[tw.x, tw.y, 0.4]}
          scale={tw.size}
        >
          <spriteMaterial map={sparkle()} color={STAR_COLORS.ray} transparent opacity={0} blending={blending} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

/** 트리 꼭대기의 큰 별과 폭죽 (10단계) */
function StarAndFireworks() {
  return (
    <group>
      <StarShape />
      {/* 폭죽: 트리 뒤쪽 하늘 5곳에서 번갈아 터집니다 (모두 한 덩어리로 그림) */}
      <Fireworks />
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
      {ORNAMENT_KEYS.filter((k) => keys.has(ORNAMENT_STAGE[k])).map((kind) =>
        ORNAMENT_SLOTS[kind].map((slot, i) => <Ornament key={`${kind}-${i}`} kind={kind} slot={slot} index={i} />),
      )}
      {keys.has("house_decor") && <HouseDecor slots={slots} />}
      {keys.has("santa_rudolph") && <SantaRudolph />}
      {keys.has("tree_garland") && <TreeGarland />}
      {keys.has("tree_garland") && <TreeFairyLights />}
      {keys.has("star") && <StarAndFireworks />}
      <Gifts level={level} />
    </group>
  );
}
