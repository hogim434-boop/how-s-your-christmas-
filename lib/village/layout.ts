// 집을 어디에 놓을지 계산하는 순수 함수 파일입니다. (3D 코드와 분리해 테스트하기 쉽게)
// "순수 함수": 같은 입력이면 항상 같은 결과를 돌려주고, 화면·상태에 손대지 않습니다.
//
// 좌표 설명: x = 오른쪽(+), z = 화면 쪽(+, 카메라가 있는 방향), y = 위쪽.
// 마을 가운데(광장)는 (0, 0)이고, 대왕 트리가 거기 서 있습니다.

/** 광장 가운데 좌표 */
export const PLAZA_CENTER = { x: 0, z: 0 } as const;
/** 광장(베이지 원판) 반지름 */
export const PLAZA_RADIUS = 8.5;
/** 대왕 트리 위치 (광장 한가운데) */
export const TREE_POSITION = { x: 0, z: 0 } as const;
/**
 * 이웃 집 중심 사이의 최소 거리 (집 대각선 약 5.4 + 사이 공간).
 * 11.25 사용자 요청으로 집 사이를 넓혔습니다 (5.6 → 8)
 */
export const HOUSE_FOOTPRINT = 8;
/** 집 중심에서 우체통까지 거리 (집 앞, 광장 쪽으로) */
export const MAILBOX_OFFSET = 2.9;
/** 대왕 트리 모델 한 종류의 정보 */
export type TreeModel = {
  /** 파일 주소 (public 아래) */
  url: string;
  /** 모델 원래 높이 */
  height: number;
  /**
   * 잎 표면의 모양표: [높이 비율 t(0=바닥, 1=꼭대기), 모델 기준 반지름].
   * 실제 모델의 잎 꼭짓점을 높이별로 재서 정했습니다. 장식(방울·종·빛 줄)이 이 표면에 붙습니다.
   */
  profile: [number, number][];
  /** 캐릭터가 들어갈 수 없는 트리 둘레 반지름 (실제 마을 크기) */
  collisionRadius: number;
};

/** 써 본 대왕 트리 모델들. 아래 TREE_MODEL 한 줄만 바꾸면 트리가 바뀝니다 */
export const TREE_MODELS = {
  /** Blender로 직접 만든 전나무 (scripts/blender/make_fir.py로 생성, 우리 프로젝트 자체 제작) */
  blenderFir: {
    url: "/models/handmade/fir.glb",
    height: 2.0,
    profile: [
      [0.05, 0.62],
      [0.15, 0.52],
      [0.25, 0.47],
      [0.35, 0.43],
      [0.45, 0.39],
      [0.55, 0.33],
      [0.65, 0.28],
      [0.75, 0.21],
      [0.85, 0.15],
      [0.95, 0.1],
      [1.0, 0.03],
    ],
    collisionRadius: 4.8,
  },
  /** Kenney Holiday Kit "tree" (CC0): 처음부터 쓰던 둥근 원뿔 트리 */
  kenney: {
    url: "/models/kenney/tree.glb",
    height: 1.92,
    // 아래(반지름 0.6)에서 꼭대기로 갈수록 곧게 가늘어지는 원뿔 모양
    profile: [
      [0, 0.63],
      [1, 0.03],
    ],
    collisionRadius: 4.6,
  },
  /** Quaternius "Pine" (CC0): 손그림풍 소나무 */
  pine: {
    url: "/models/quaternius/pine.glb",
    height: 7.14,
    profile: [
      [0.15, 2.6],
      [0.3, 2.2],
      [0.45, 1.7],
      [0.6, 1.3],
      [0.75, 1.0],
      [0.9, 0.6],
      [1.0, 0.2],
    ],
    collisionRadius: 5.5,
  },
  /** Quaternius "Pine Trees" 묶음 중 가장 곧은 1그루 (CC0): 각진 카툰풍 소나무 */
  straightPine: {
    url: "/models/quaternius/pine_straight.glb",
    height: 0.788,
    profile: [
      [0.12, 0.18],
      [0.25, 0.145],
      [0.4, 0.125],
      [0.55, 0.1],
      [0.7, 0.075],
      [0.85, 0.04],
      [1.0, 0.01],
    ],
    collisionRadius: 3.8,
  },
  /** Rodri "Fir Tree" (CC-BY 4.0, 작가 표시 필요): 빽빽한 전나무 */
  fir: {
    url: "/models/sketchfab/fir_tree.glb",
    height: 3.59,
    profile: [
      [0.05, 1.2],
      [0.45, 1.2],
      [0.55, 1.05],
      [0.65, 0.95],
      [0.75, 0.85],
      [0.85, 0.65],
      [0.95, 0.45],
      [1.0, 0.25],
    ],
    collisionRadius: 5.3,
  },
} satisfies Record<string, TreeModel>;

/** 지금 쓰는 대왕 트리 (11.25 사용자 요청: Blender로 조금 더 사실적인 트리를 직접 만들어 사용) */
export const TREE_MODEL: TreeModel = TREE_MODELS.blenderFir;

/** 대왕 트리 높이 (약 15.4). 모델이 바뀌어도 이 높이에 맞춰 키웁니다 */
export const TREE_HEIGHT = 15.4;
/** 확대 배율. 가로·세로를 똑같이 키워야 찌그러져 보이지 않습니다 */
export const TREE_SCALE = TREE_HEIGHT / TREE_MODEL.height;
/** 캐릭터가 들어갈 수 없는 트리 둘레 반지름 */
export const TREE_COLLISION_RADIUS = TREE_MODEL.collisionRadius;

/** 높이 비율 t에서 트리 잎 표면까지의 반지름 (실제 마을 크기). 모양표 사이는 직선으로 이어 계산합니다 */
export function treeSurfaceRadius(t: number): number {
  const TREE_PROFILE = TREE_MODEL.profile;
  const first = TREE_PROFILE[0];
  if (t <= first[0]) return first[1] * TREE_SCALE;
  for (let i = 1; i < TREE_PROFILE.length; i++) {
    const [t1, r1] = TREE_PROFILE[i];
    if (t <= t1) {
      const [t0, r0] = TREE_PROFILE[i - 1];
      return (r0 + ((t - t0) / (t1 - t0)) * (r1 - r0)) * TREE_SCALE;
    }
  }
  return TREE_PROFILE[TREE_PROFILE.length - 1][1] * TREE_SCALE;
}
/** 집 하나의 충돌 반지름 (집 한 변 3.8의 대각선 절반 약 2.7) */
export const HOUSE_COLLISION_RADIUS = 2.7;
/** 우체통 충돌 반지름 */
export const MAILBOX_COLLISION_RADIUS = 0.7;

/** 캐릭터가 처음 서 있는 자리 (광장 앞쪽, 카메라 쪽) */
export const PLAYER_START = { x: 0, z: 6.2 } as const;

/** 가로등 개수 */
export const LAMP_COUNT = 8;
/** 가로등이 서는 원의 반지름: 광장 바깥 가장자리 쪽 (트리 가장자리 4.8보다 한참 바깥) */
export const LAMP_RING_RADIUS = 7.8;
/** 가로등 모델 확대 배율 (KayKit lantern은 높이 약 3.9) */
export const LAMP_SCALE = 1;
/** 가로등 머리 높이. 알전구 줄이 여기에 걸립니다 */
export const LAMP_TOP_Y = 3.94 * LAMP_SCALE - 0.4;

/** 가로등 위치 목록. 둘레를 똑같이 나눠 서로 간격이 같고, 집 정면과 겹치지 않게 반 칸 비켜 놓습니다. */
export function lampPositions(): { x: number; z: number }[] {
  return Array.from({ length: LAMP_COUNT }, (_, i) => {
    const angle = ((i + 0.5) / LAMP_COUNT) * Math.PI * 2;
    return { x: Math.sin(angle) * LAMP_RING_RADIUS, z: Math.cos(angle) * LAMP_RING_RADIUS };
  });
}

/** 집이 놓이는 원의 가장 작은 반지름 */
export const MIN_HOUSE_RING_RADIUS = 15;

/**
 * 카메라가 있는 쪽 방향각(라디안). 좌표 (sin a, cos a)에서 a=0이면 +z(화면 쪽)입니다.
 * 대왕 트리 "바로 뒤"는 이 각도에서 180도 반대쪽입니다.
 */
const FRONT_ANGLE = 0;
/** 트리 바로 뒤쪽에서 비워 두는 각도 범위(전체 폭). 집이 트리에 가려지지 않게 합니다. */
const BACK_GAP = Math.PI / 4; // 45도

export type HouseSlot = {
  x: number;
  z: number;
  /** y축 회전(라디안). 집 앞면(+z 방향)이 광장 가운데를 보도록 정해져 있습니다. */
  rotation: number;
  /** 우체통 위치 (집과 광장 가운데 사이) */
  mailbox: { x: number; z: number };
};

/** 집 사이 각도 간격의 상한(라디안). 집이 적을 때 뒤쪽까지 흩어지지 않게 정면 쪽에 모읍니다. */
const MAX_STEP = 0.75;
/** 정면에서 한쪽으로 최대로 퍼질 수 있는 각도 (뒤쪽 빈 구간의 절반만큼 못 미침) */
const MAX_SPREAD = Math.PI - BACK_GAP / 2;

/**
 * 집을 정면 좌우로 "반 칸씩 비켜" 놓습니다: 각도 = ±(칸 번호 + 0.5) × 간격.
 * 정면 한가운데를 비워 두는 이유: 카메라 바로 앞 집이 캐릭터를 가리지 않게 하기 위해서입니다.
 * maxRank: 한쪽 칸 번호의 최댓값 (0번 칸이 정면에 가장 가까움)
 */
function maxRank(count: number): number {
  return Math.max(0, Math.ceil(count / 2) - 1);
}

/** 이웃한 집 사이의 각도 간격 */
function angleStep(count: number): number {
  if (count <= 0) return 0;
  return Math.min(MAX_STEP, MAX_SPREAD / (maxRank(count) + 0.5));
}

/** 집 n채를 놓을 원의 반지름. 집이 많을수록 커져서 서로 겹치지 않습니다. */
export function ringRadius(n: number): number {
  const step = angleStep(n);
  // 이웃 집 사이 거리 = 2 × 반지름 × sin(간격/2) ≥ 집 크기 가 되도록 반지름을 정함
  const needed = step > 0 ? HOUSE_FOOTPRINT / (2 * Math.sin(step / 2)) : 0;
  return Math.max(MIN_HOUSE_RING_RADIUS, needed + 0.2);
}

/** 울타리를 집 원보다 얼마나 바깥에 둘지. 집 뒤쪽으로도 걸어 다닐 공간이 생깁니다 (11.25 사용자 요청: 이동 범위 넓히기) */
export const FENCE_MARGIN = 9;
/** 캐릭터가 울타리에서 떨어져 멈추는 거리 (울타리 두께 + 여유) */
export const FENCE_INNER_GAP = 1;

/** 주민 수 n명일 때 마을을 둘러싼 울타리의 반지름 */
export function fenceRadius(n: number): number {
  return ringRadius(n) + FENCE_MARGIN;
}

/** 주민 수 n명일 때 캐릭터가 걸을 수 있는 최대 반지름 (울타리 바로 안쪽) */
export function walkRadius(n: number): number {
  return fenceRadius(n) - FENCE_INNER_GAP;
}

/**
 * 주민 수 n명의 집 자리를 돌려줍니다.
 * - 0번 집이 카메라 쪽 정면 왼쪽, 1번이 정면 오른쪽, 그 다음부터 좌우 번갈아 바깥으로 퍼집니다. (정면 한가운데는 비움)
 * - 트리 바로 뒤쪽 구간은 비워 둡니다.
 */
export function houseSlots(n: number): HouseSlot[] {
  const count = Math.max(0, Math.floor(n));
  const radius = ringRadius(count);
  const step = angleStep(count);

  const slots: HouseSlot[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 1 ? 1 : -1; // 짝수 번호는 왼쪽, 홀수는 오른쪽
    const rank = Math.floor(i / 2);
    const angle = FRONT_ANGLE + side * (rank + 0.5) * step;

    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    // 집 앞면(+z)이 가운데를 보게 돌립니다. 가운데를 향하는 방향은 (-x, -z)
    const rotation = Math.atan2(-x, -z);
    // 우체통: 집에서 가운데 쪽으로 MAILBOX_OFFSET만큼
    const mailbox = {
      x: x - (x / radius) * MAILBOX_OFFSET,
      z: z - (z / radius) * MAILBOX_OFFSET,
    };
    slots.push({ x, z, rotation, mailbox });
  }
  return slots;
}
