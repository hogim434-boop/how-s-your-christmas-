"use client";

// 장식 단계(level 0~10)에 따라 마을에 장식을 얹는 컴포넌트입니다.
// 어떤 단계에 무엇이 보이는지는 lib/decor/decorTable.ts의 표(visibleStages, giftLayout)가 정합니다.
// 여기서는 "각 장식 이름 → 임시 3D 모양"만 연결합니다. (진짜 모델로 바꿀 때 이 파일의 모양만 교체)
// level 0이면 아무것도 그리지 않아서 트리와 광장이 완전히 비어 있습니다.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Kit } from "./Kit";
import { BULB_COLORS, BulbString } from "./BulbString";
import { InstancedKit, placement } from "./InstancedKit";
import { NIGHT_GLOW, useNight } from "./nightContext";
import { Fireworks } from "./Firework";
import { softDot } from "./particles";
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
 * 방울·양말·눈송이는 장식표에 이름이 있는 대표 장식이고, 나머지(초록 방울·지팡이 사탕·노란 종·쿠키)는
 * 같은 단계에 함께 나오는 짝꿍 장식입니다. 어느 단계에 나오는지는 ORNAMENT_STAGE에 적혀 있습니다.
 */
type OrnamentKey = "red_bauble" | "yellow_bell" | "stocking" | "snowflake" | "cookie" | "green_bauble" | "candy_cane";

/** 각 오너먼트가 어느 장식 단계에 나타나는지 */
const ORNAMENT_STAGE: Record<OrnamentKey, DecorKey> = {
  // 11.26 미팅(#21)에서 정한 순서: 2단계 방울 2종 / 4단계 양말·지팡이 사탕·노란 종 / 6단계 눈송이·쿠키
  red_bauble: "red_bauble",
  green_bauble: "red_bauble",
  stocking: "stocking",
  candy_cane: "stocking",
  yellow_bell: "stocking",
  snowflake: "snowflake",
  cookie: "snowflake",
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

/** 광장의 루돌프 썰매 (7단계): 루돌프·썰매는 Kenney, 선물 짐은 KayKit */
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

// ───────── 트리 전구 줄 (3단계) ─────────
// 11.26 사용자 요청: "동그란 구슬이 한 줄로 고르게 이어진 모습"이 실제 전구 줄 같지 않음 → 진짜 트리에 전구를 감는 방식대로.
// 실제 트리에는 이렇게 답니다:
//  - 가느다란 초록 전선에 작은 꼬마전구가 촘촘히 달려 있고(전선은 잎 색에 묻혀 거의 안 보임)
//  - 줄을 곧게 감지 않고, 가지 위아래로 완만한 S자를 그리며 걸칩니다
//  - 군데군데 가지 안쪽으로 밀어 넣어서, 어떤 전구는 잎 사이로 반쯤 가려져 깊이감이 생깁니다
//  - 전구는 한 방향으로 서 있지 않고 제각각 다른 쪽을 봅니다
// 그리기 명령은 전선 1번 + 전구 전체 1번(InstancedMesh)뿐이라 가볍습니다.

/**
 * 트리 전구 줄 설정
 * bulbs: 전구 수 / turns: 트리를 몇 바퀴 감는지 / from~to: 줄이 걸리는 높이 비율(아래 7% ~ 꼭대기 밑 93%)
 * wave: 위아래로 굽이치는 폭(아래쪽, 위쪽) / waves: 한 바퀴에 몇 번 굽이치는지
 *       (딱 떨어지지 않는 수라야 위아래 층의 굽이가 서로 어긋나 손으로 감은 것처럼 보입니다)
 * out: 잎 표면에서 전선을 띄우는 거리 / tuck: 가지 안쪽으로 밀어 넣는 깊이 / tucks: 한 바퀴에 몇 번 밀어 넣는지
 * wire: 전선 굵기(반지름)
 */
const TREE_LIGHTS = {
  bulbs: 420,
  turns: 9,
  from: 0.07,
  to: 0.93,
  wave: [0.3, 0.12] as const,
  waves: 3.3,
  out: 0.1,
  tuck: 0.42,
  tucks: 4.7,
  wire: 0.014,
};
/** 꼬마전구 크기: 길이, 가장 통통한 곳의 반지름, 소켓 길이·반지름 */
const BULB_SHAPE = { length: 0.2, radius: 0.06, socket: 0.07, socketRadius: 0.04 };
/** 전선 색: 잎에 묻히는 짙은 초록 */
const WIRE_COLOR = "#14301d";
/** 트리 꼬마전구 색 (실제 알록달록 전구 줄의 다섯 가지 색) */
const TREE_BULB_COLORS = ["#ff4a3d", "#ffb52e", "#49d163", "#4aa8ff", "#ff6fb1"];
/** 업그레이드 뒤 전구 줄의 색: 따뜻한 금빛 한 가지 */
const WARM_BULB = "#ffd98a";

/** 전선이 지나가는 길. 줄의 처음(0)부터 끝(1)까지 중 f 지점의 좌표를 돌려줍니다 */
function treeLightPoint(f: number, target: THREE.Vector3): THREE.Vector3 {
  const angle = -f * TREE_LIGHTS.turns * Math.PI * 2;
  const t = TREE_LIGHTS.from + f * (TREE_LIGHTS.to - TREE_LIGHTS.from);
  // 위아래로 굽이치는 정도: 아래쪽은 크게, 위쪽은 작게. 두 박자를 섞어 굽이마다 크기가 조금씩 다릅니다
  const wave = TREE_LIGHTS.wave[0] + (TREE_LIGHTS.wave[1] - TREE_LIGHTS.wave[0]) * f;
  const y = t * TREE_HEIGHT + (Math.sin(angle * TREE_LIGHTS.waves) + 0.35 * Math.sin(angle * 1.37 + 1.9)) * wave;
  // 가지 안쪽으로 밀어 넣기: 평소에는 가지 끝에 걸쳐 있다가, 군데군데 잎 속으로 들어갑니다
  const tuck = Math.max(0, Math.sin(angle * TREE_LIGHTS.tucks + 0.8)) ** 2 * TREE_LIGHTS.tuck;
  // 굽이친 뒤의 실제 높이에서 잎 표면을 찾아야 전선이 허공에 뜨지 않습니다
  const r = Math.max(0.05, treeSurfaceRadius(y / TREE_HEIGHT) + TREE_LIGHTS.out - tuck);
  return target.set(Math.sin(angle) * r, y, Math.cos(angle) * r);
}

/** 전선이 지나가는 곡선 (점 여러 개를 부드럽게 이은 선). 전선 모양과 전구 자리 계산에 함께 씁니다 */
function createTreeLightCurve(): THREE.CatmullRomCurve3 {
  const STEPS = 720;
  const points = Array.from({ length: STEPS + 1 }, (_, i) => treeLightPoint(i / STEPS, new THREE.Vector3()));
  const curve = new THREE.CatmullRomCurve3(points);
  // 전구를 "줄 길이 기준으로 같은 간격"에 달기 위해 길이를 촘촘히 재 둡니다
  curve.arcLengthDivisions = 2400;
  return curve;
}

/**
 * 꼬마전구 한 개의 모양: 소켓(아래) + 끝이 둥글게 좁아지는 작은 유리(위).
 * 옆모습 선을 한 바퀴 돌려 만듭니다(LatheGeometry). 원점은 유리와 소켓이 만나는 곳, +y가 전구 끝 방향입니다.
 * 꼭짓점 색으로 "소켓은 어둡게, 유리는 뿌리 쪽이 살짝 어둡게" 칠해 두어, 조명 없이도 입체로 보입니다.
 * (전구가 수백 개라서 면 수를 아주 적게 만들었습니다: 한 개에 세모 약 70개)
 */
function createBulbGeometry(): THREE.BufferGeometry {
  const { length: L, radius: R, socket, socketRadius } = BULB_SHAPE;
  // [반지름, 높이] 옆모습. 높이 0 아래는 소켓, 위는 유리
  const outline: [number, number][] = [
    [0, -socket],
    [socketRadius, -socket],
    [socketRadius, 0],
    [R * 0.8, 0.004],
    [R, L * 0.35],
    [R * 0.72, L * 0.75],
    [0, L],
  ];
  const geometry = new THREE.LatheGeometry(
    outline.map(([r, y]) => new THREE.Vector2(r, y)),
    6,
  );
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    // 소켓: 전구 색의 10%만 남겨 어둡게 / 유리: 뿌리 78% → 끝 100%
    const shade = y <= 0.001 ? 0.1 : 0.78 + 0.22 * Math.min(1, (y / L) * 1.6);
    colors.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** 전구마다의 자리·방향·크기(행렬)와 색 번호. 항상 같은 모습이 나오도록 정해진 규칙의 무작위 수를 씁니다 */
function layoutTreeBulbs(curve: THREE.CatmullRomCurve3): { matrices: THREE.Matrix4[]; colorIndex: number[] } {
  let seed = 2412;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const UP = new THREE.Vector3(0, 1, 0);
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const across = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrices: THREE.Matrix4[] = [];
  const colorIndex: number[] = [];
  let lastColor = -1;
  for (let i = 0; i < TREE_LIGHTS.bulbs; i++) {
    const u = (i + 0.5) / TREE_LIGHTS.bulbs; // 줄 길이 기준 위치 (0~1)
    curve.getPointAt(u, point);
    curve.getTangentAt(u, tangent);
    // outward: 트리 바깥 방향 / across: 전선과 바깥 방향 모두에 직각인 방향(대체로 위아래)
    outward.set(point.x, 0, point.z).normalize();
    across.crossVectors(tangent, outward).normalize();
    // 실제 전구 줄처럼 전구가 제각각 다른 쪽을 봅니다: 바깥·위·아래·줄 방향이 무작위로 섞입니다.
    // 바깥 성분은 항상 남겨서(0.45 이상) 전구가 잎 속으로 파고들지 않게 합니다
    direction
      .copy(outward)
      .multiplyScalar(0.45 + random() * 0.55)
      .addScaledVector(across, (random() - 0.5) * 1.7)
      .addScaledVector(tangent, (random() - 0.5) * 1.2)
      .normalize();
    quaternion.setFromUnitVectors(UP, direction);
    const size = 0.85 + random() * 0.3;
    scale.setScalar(size);
    // 소켓 바닥이 전선에 닿도록, 소켓 길이만큼 전구 방향으로 밀어 답니다
    point.addScaledVector(direction, BULB_SHAPE.socket * size);
    matrices.push(new THREE.Matrix4().compose(point, quaternion, scale));
    // 색: 무작위로 고르되 바로 앞 전구와 같은 색은 피합니다
    let pick = Math.floor(random() * TREE_BULB_COLORS.length);
    if (pick === lastColor) pick = (pick + 1) % TREE_BULB_COLORS.length;
    lastColor = pick;
    colorIndex.push(pick);
  }
  return { matrices, colorIndex };
}

/**
 * 트리 가지에 걸쳐 감아 올라가는 알록달록 꼬마전구 줄 (3단계). — 11.26 미팅(#21): 전구 줄은 30%에 달고 90%에 업그레이드
 * 밤에는 전구가 스스로 빛나서(빛 번짐) 트리와 오너먼트 둘레가 반짝입니다. (가짜 빛, 진짜 조명 없음)
 * warm: 9단계(전구 줄 업그레이드)가 되면 알록달록한 색이 사라지고, 같은 줄이 따뜻한 금빛으로 바뀝니다. (11.26 사용자 요청)
 */
function TreeLights({ warm }: { warm: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const night = useNight();
  // 모양은 처음 한 번만 만들어 둡니다 (useMemo: 다시 그릴 때마다 새로 만들지 않게 기억)
  const { wire, bulb, layout } = useMemo(() => {
    const curve = createTreeLightCurve();
    return {
      wire: new THREE.TubeGeometry(curve, 1100, TREE_LIGHTS.wire, 4, false),
      bulb: createBulbGeometry(),
      layout: layoutTreeBulbs(curve),
    };
  }, []);
  // 이 부품이 화면에서 사라질 때, 그래픽 카드에 올려 둔 모양 데이터를 치웁니다
  useEffect(
    () => () => {
      wire.dispose();
      bulb.dispose();
    },
    [wire, bulb],
  );
  // 전구 자리: 한 번만 넣으면 됩니다
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    layout.matrices.forEach((matrix, i) => m.setMatrixAt(i, matrix));
    m.instanceMatrix.needsUpdate = true;
  }, [layout]);
  // 전구 색: 낮/밤이 바뀌거나 업그레이드되면 색만 다시 칠합니다 (모양·자리는 그대로)
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const color = new THREE.Color();
    layout.colorIndex.forEach((index, i) => {
      const bulbColor = warm ? WARM_BULB : TREE_BULB_COLORS[index];
      // 밤에는 색을 몇 배로 밝혀서 빛 번짐 효과가 불빛처럼 퍼뜨리게 합니다
      m.setColorAt(i, color.set(bulbColor).multiplyScalar(night ? NIGHT_GLOW : 1));
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [layout, night, warm]);
  return (
    <group>
      {/* 전선 */}
      <mesh geometry={wire} frustumCulled={false}>
        <meshBasicMaterial color={WIRE_COLOR} />
      </mesh>
      {/* 꼬마전구 (소켓 포함) */}
      <instancedMesh ref={mesh} args={[bulb, undefined, TREE_LIGHTS.bulbs]} frustumCulled={false}>
        {/* 조명과 상관없이 불 켜진 것처럼 밝게. vertexColors: 모양에 칠해 둔 명암(소켓·유리)을 전구 색에 곱합니다 */}
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ───────── 전구 줄 업그레이드 (9단계): 트리 가득 따뜻한 꼬마 불빛 ─────────
// 11.26 사용자 요청: 90%에서는 알록달록한 줄이 사라지고(같은 줄이 금빛으로 바뀜) "트리 자체에서 빛이 나는 느낌"으로 확실히 업그레이드.
// 참고 사진처럼 가지마다 따뜻한 흰빛 꼬마 불빛이 수없이 켜진 모습입니다. 모두 가짜 빛입니다 (진짜 조명 없음).
//  1) 꼬마 불빛: 점(Points) 수백 개를 한 번에 그리고, 반짝임은 그래픽 카드(셰이더)가 계산
//  2) 트리 둘레의 빛 번짐: 밤에만, 은은한 그림 한 장
//  3) 트리 잎이 스스로 더 밝게 빛남: GiantTree.tsx의 LIT_TREE_GLOW

/** 꼬마 불빛 수 (휴대폰은 적게), 점 크기 */
const TWINKLE = { count: 1500, liteCount: 850, size: 0.62 };

/** 꼬마 불빛의 자리를 정합니다. 항상 같은 자리가 나오도록 정해진 규칙의 무작위 수를 씁니다 */
function buildTwinkleGeometry(count: number): THREE.BufferGeometry {
  let seed = 1225;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const maxRadius = treeSurfaceRadius(0.05);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  let n = 0;
  while (n < count) {
    const t = 0.05 + random() * 0.92;
    const surface = treeSurfaceRadius(t);
    // 트리는 아래가 넓으므로 아래쪽에 더 많이 달아야 고르게 보입니다 (좁은 위쪽은 덜 뽑음)
    if (random() > surface / maxRadius + 0.12) continue;
    const angle = random() * Math.PI * 2;
    // 가지 끝(겉)부터 조금 안쪽까지. 안쪽 불빛은 잎에 반쯤 가려져 깊이감이 생깁니다
    const r = surface * (0.72 + random() * 0.32) + 0.05;
    positions[n * 3] = Math.sin(angle) * r;
    positions[n * 3 + 1] = t * TREE_HEIGHT;
    positions[n * 3 + 2] = Math.cos(angle) * r;
    seeds[n] = random();
    n++;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

const TWINKLE_VERTEX = /* glsl */ `
  uniform float uTime;   // 지금 시각(초)
  uniform float uScale;  // 화면 높이에 맞춘 점 크기 배율
  uniform float uSize;   // 점 크기
  attribute float aSeed; // 불빛마다 다른 0~1 숫자 (반짝이는 박자와 크기를 다르게)
  varying float vGlow;
  void main() {
    // 불빛마다 다른 박자로 천천히 밝아졌다 어두워집니다 (55% ~ 100%)
    float twinkle = 0.775 + 0.225 * sin(uTime * (1.2 + aSeed * 2.4) + aSeed * 60.0);
    vGlow = twinkle;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.7 + 0.6 * fract(aSeed * 7.0)) * twinkle * uScale / -mv.z; // 멀수록 작게
  }
`;

const TWINKLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;      // 불빛 색
  uniform float uIntensity; // 밝기 (밤에는 크게 → 빛 번짐 효과가 퍼뜨려 줌)
  uniform float uDay;       // 아침이면 1 (번짐 없이 또렷한 작은 점)
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0; // 점 가운데에서의 거리 (0 ~ 1)
    if (d > 1.0) discard;
    // 밤: 가운데 밝은 심 + 부드럽게 번지는 빛 / 아침: 가운데 작은 점만
    float soft = pow(1.0 - d, 2.2);
    float core = smoothstep(0.38, 0.0, d);
    float alpha = mix(soft * 0.85 + core, smoothstep(0.62, 0.3, d), uDay);
    // 아침에는 초록 잎 위에서 잘 보이도록 노란빛을 진하게, 밤에는 심을 흰빛에 가깝게
    vec3 color = mix(mix(uColor, vec3(1.0, 0.97, 0.88), core * 0.7), vec3(1.0, 0.86, 0.36), uDay);
    gl_FragColor = vec4(color * uIntensity * vGlow, alpha * vGlow);
  }
`;

/** 매 장면마다 시간과 화면 크기를 꼬마 불빛에 알려 줍니다 */
function updateTwinkle(material: THREE.ShaderMaterial, time: number, scale: number) {
  material.uniforms.uTime.value = time;
  material.uniforms.uScale.value = scale;
}

function TreeTwinkleLights() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const night = useNight();
  const geometry = useMemo(
    () =>
      buildTwinkleGeometry(window.matchMedia("(pointer: coarse)").matches ? TWINKLE.liteCount : TWINKLE.count),
    [],
  );
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScale: { value: 400 },
      uSize: { value: TWINKLE.size },
      uColor: { value: new THREE.Color("#ffd27a") },
      uIntensity: { value: 1 },
      uDay: { value: 0 },
    }),
    [],
  );
  useFrame(({ clock, size, viewport }) => {
    // 점 크기는 "화면 세로 픽셀 수"에 비례해야 어느 기기에서나 같은 크기로 보입니다
    if (material.current) updateTwinkle(material.current, clock.elapsedTime, (size.height * viewport.dpr) / 2);
  });
  return (
    <group>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          // 밤/아침이 바뀌면 재질을 새로 만듭니다 (섞는 방식이 달라서)
          key={night ? "night" : "day"}
          ref={material}
          vertexShader={TWINKLE_VERTEX}
          fragmentShader={TWINKLE_FRAGMENT}
          uniforms={uniforms}
          uniforms-uIntensity-value={night ? 3.2 : 1.1}
          uniforms-uDay-value={night ? 0 : 1}
          uniforms-uSize-value={night ? TWINKLE.size : TWINKLE.size * 0.62}
          transparent
          depthWrite={false}
          // 밤: 빛을 더해서 겹칠수록 밝게 / 아침: 밝은 배경에 묻히지 않게 색을 그대로 얹기
          blending={night ? THREE.AdditiveBlending : THREE.NormalBlending}
          toneMapped={false}
        />
      </points>
      {/* 트리 둘레로 은은하게 번지는 따뜻한 빛 (밤에만. 밝은 아침 하늘에서는 보이지 않아서 뺍니다) */}
      {night && (
        <sprite position={[0, TREE_HEIGHT * 0.45, 0]} scale={[TREE_HEIGHT * 0.95, TREE_HEIGHT * 1.25, 1]}>
          <spriteMaterial
            map={softDot()}
            color="#ffb860"
            transparent
            opacity={0.09}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      )}
    </group>
  );
}

/**
 * 별 모양: 보석처럼 각지게 깎인 "북극성"(✦) 모양입니다. (11.26 사용자 요청: 더 세련되고 현대적인 별)
 * 위아래로 긴 끝 2개, 좌우 끝 2개, 그 사이 짧은 끝 4개 = 뾰족한 끝 8개.
 * 가운데가 앞뒤로 도톰하고 끝으로 갈수록 얇아져서, 면마다 빛을 다르게 받아 반짝입니다.
 */
function createStarGeometry(): THREE.BufferGeometry {
  /** 끝의 길이: 위·아래 / 좌·우 / 대각선 */
  const TIP = { vertical: 1.3, horizontal: 0.88, diagonal: 0.46 };
  /** 끝과 끝 사이 골짜기의 깊이 (작을수록 끝이 가늘고 날렵함) */
  const VALLEY = 0.17;
  /** 가운데의 앞뒤 두께 */
  const DEPTH = 0.26;

  // 테두리 점 16개: 끝(8개)과 골짜기(8개)가 번갈아 놓입니다. 맨 위 끝부터 시계 반대 방향
  const ring: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const angle = Math.PI / 2 + (i / 16) * Math.PI * 2;
    let r = VALLEY;
    if (i % 2 === 0) {
      const tip = i / 2; // 0=위, 1=대각선, 2=왼쪽, 3=대각선, 4=아래 …
      r = tip % 2 === 1 ? TIP.diagonal : tip % 4 === 0 ? TIP.vertical : TIP.horizontal;
    }
    ring.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  // 가운데 꼭짓점(앞·뒤)과 테두리 점을 세모로 이어 면을 만듭니다
  const positions: number[] = [];
  for (let i = 0; i < 16; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % 16];
    positions.push(0, 0, DEPTH, ax, ay, 0, bx, by, 0); // 앞면
    positions.push(0, 0, -DEPTH, bx, by, 0, ax, ay, 0); // 뒷면
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  // 면마다 따로 빛을 받게(각진 느낌) 면 방향을 계산합니다
  geo.computeVertexNormals();
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
/** 별 색: 노란빛을 뺀 은은한 샴페인 금색 (몸통 / 스스로 내는 빛 / 빛살). 아침에는 밝은 하늘에 묻히지 않게 조금 더 짙은 금색(day~)을 씁니다 */
const STAR_COLORS = { body: "#f2d9a0", dayBody: "#d6a548", glow: "#ffdf9e", ray: "#fff6dc", dayRay: "#f0cf85" };

/**
 * 트리 꼭대기 별: 반짝반짝 빛납니다. (11.25 사용자 요청)
 * 모두 가짜 빛입니다(진짜 조명 없음).
 *  - 별 몸통: 스스로 빛나는 밝기가 숨 쉬듯 커졌다 작아짐 (밤에는 빛 번짐 효과가 받아서 환하게 퍼짐)
 *  - 큰 빛살(✦): 별의 끝과 같은 방향으로 뻗었다 줄어듦
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
      // 밤에도 깎인 면이 구분되도록 스스로 내는 빛은 너무 세지 않게 둡니다
      material.emissiveIntensity = (night ? 0.9 : 0.25) + shine * (night ? 1.0 : 0.3);
      // 별이 좌우로 천천히 돌아 여러 각도에서 반짝여 보입니다
      body.current.rotation.y = Math.sin(t * 0.6) * 0.55;
    }
    if (rays.current) {
      // 빛살은 돌지 않고 별의 위아래·좌우 끝과 같은 방향으로 가늘게 뻗었다 줄어듭니다
      rays.current.scale.setScalar(5 + shine * 3);
      rays.current.material.opacity = (night ? 0.4 : 0.5) + shine * 0.35;
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
    <group position={[0, TREE_HEIGHT + 1.25, 0]}>
      {/* 큰 십자 빛살 */}
      <sprite ref={rays} scale={5}>
        <spriteMaterial map={sparkle()} color={night ? STAR_COLORS.ray : STAR_COLORS.dayRay} transparent opacity={0.7} blending={blending} depthWrite={false} toneMapped={false} />
      </sprite>
      {/* 별 몸통 */}
      <mesh ref={body} geometry={geometry} scale={1.75}>
        {/* flatShading: 면과 면 사이를 부드럽게 잇지 않고 각지게 → 깎인 보석 느낌 */}
        <meshStandardMaterial color={night ? STAR_COLORS.body : STAR_COLORS.dayBody} emissive={STAR_COLORS.glow} emissiveIntensity={0.6} roughness={0.3} metalness={0.15} flatShading />
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
          <spriteMaterial map={sparkle()} color={night ? STAR_COLORS.ray : STAR_COLORS.dayRay} transparent opacity={0} blending={blending} depthWrite={false} toneMapped={false} />
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
      {keys.has("tree_lights") && <TreeLights warm={keys.has("tree_lights_upgrade")} />}
      {keys.has("tree_lights_upgrade") && <TreeTwinkleLights />}
      {keys.has("star") && <StarAndFireworks />}
      <Gifts level={level} />
    </group>
  );
}
