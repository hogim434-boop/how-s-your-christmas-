// 섬 위에 무엇이 어디에 있는지 적어둔 "지도" 파일입니다.
// 좌표는 [x, z] 입니다. (x: 좌우, z: 앞뒤, y: 높이)

import { mailboxPos, RESIDENTS,  } from './residents'
import type { ResidentId } from './residents'

/** 지금은 항상 "공유 마을"(미니어처) 화면만 보여 주므로 마을 지도를 씁니다.
 *  (예전에는 주소에 ?style=... 이 있을 때만 마을이었고, 없으면 처음 만든 작은 섬이었습니다) */
const IS_VILLAGE: boolean = true

/** 마을(땅)의 반지름. 울타리와 캐릭터가 걸어갈 수 있는 끝이 이 값으로 정해집니다.
 *  공유 마을은 광장 둘레에 집 6채(중심에서 약 8~9.2 거리)가 모두 울타리 안에 들어오고, 집 뒤로도 걸을 마당이 남도록 넉넉하게 잡습니다. */
export const ISLAND_RADIUS = IS_VILLAGE ? 19 : 9

/** 크리스마스 트리 위치 */
export const TREE_POS = { x: 0, z: -1.5 }
/** 집 위치 */
export const HOUSE_POS = { x: -4.8, z: -3.6 }
/** 우체통 위치 */
export const MAILBOX_POS = { x: -2.7, z: -1.3 }
/** 눈사람 위치 */
export const SNOWMAN_POS = { x: 3.8, z: -2.4 }
/** 가로등 위치 */
export const LAMP_POS = { x: 2.8, z: 1.4 }

/** 섬 가장자리에 심을 소나무들: [x, z, 크기] */
export const PINES: [number, number, number][] = [
  [-7.2, -1.0, 1.1],
  [-6.2, 2.8, 0.9],
  [-2.5, -6.8, 1.2],
  [1.8, -7.0, 1.0],
  [5.6, -5.0, 1.15],
  [7.3, -0.6, 0.9],
  [6.3, 3.4, 1.05],
  [-4.2, 5.6, 0.85],
]

/** 캐릭터가 통과하면 안 되는 물체(장애물). 원 모양으로 단순하게 계산합니다. */
type Obstacle = { x: number; z: number; r: number }

export const OBSTACLES: Obstacle[] = IS_VILLAGE
  ? [
      { ...TREE_POS, r: 1.9 },
      ...RESIDENTS.map((r) => ({ x: r.x, z: r.z, r: 1.8 })),
      ...RESIDENTS.map((r) => ({ ...(r), r: 0.5 })),
    ]
  : [
      { ...TREE_POS, r: 1.9 },
      { ...HOUSE_POS, r: 1.8 },
      { ...MAILBOX_POS, r: 0.35 },
      { ...SNOWMAN_POS, r: 0.75 },
      { ...LAMP_POS, r: 0.3 },
      ...PINES.map(([x, z, s]) => ({ x, z, r: 0.8 * s })),
    ]

/** 가까이 가면 버튼이 뜨는 장소 */
export type SpotId = 'tree' | 'mailbox' | ResidentId

export const SPOTS: { id: SpotId; x: number; z: number; range: number }[] = IS_VILLAGE
  ? [
      { id: 'tree', ...TREE_POS, range: 3.1 },
      // 주민 집 앞 작은 트리 (가까이 가면 편지를 걸 수 있습니다)
      ...RESIDENTS.map((r) => ({ id: r.id, ...mailboxPos(r), range: 1.3 })),
    ]
  : [
      { id: 'tree', ...TREE_POS, range: 3.1 },
      { id: 'mailbox', ...MAILBOX_POS, range: 1.6 },
    ]

/**
 * 좌표가 장애물 안에 있으면 장애물 바깥으로 밀어냅니다.
 * margin 은 장애물에서 얼마나 떨어뜨릴지(여유 거리)입니다.
 */
export function pushOutOfObstacles(x: number, z: number, margin: number): [number, number] {
  for (const o of OBSTACLES) {
    const dx = x - o.x
    const dz = z - o.z
    const dist = Math.hypot(dx, dz)
    const min = o.r + margin
    if (dist < min) {
      // 장애물 중심에서 바깥 방향으로 밀기 (정확히 중심이면 앞쪽으로)
      const nx = dist > 0.0001 ? dx / dist : 0
      const nz = dist > 0.0001 ? dz / dist : 1
      x = o.x + nx * min
      z = o.z + nz * min
    }
  }
  return [x, z]
}

/** 터치한 지점을 "실제로 걸어갈 수 있는 지점"으로 다듬습니다. */
export function resolveTarget(x: number, z: number): [number, number] {
  // 1) 섬 밖으로 나가지 않게 제한
  const limit = ISLAND_RADIUS - 0.8
  const dist = Math.hypot(x, z)
  if (dist > limit) {
    x = (x / dist) * limit
    z = (z / dist) * limit
  }
  // 2) 장애물 안쪽을 눌렀다면 그 앞까지만 가도록 조정
  return pushOutOfObstacles(x, z, 0.45)
}
