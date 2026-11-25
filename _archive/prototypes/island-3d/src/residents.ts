// 공유 마을의 "지도"입니다. 주민(집)과 집 앞 우체통의 위치를 정합니다.
// 좌표는 x(좌우), z(앞뒤) 입니다.

export type ResidentId = 'minji' | 'junho' | 'sua' | 'me' | 'hana' | 'doyun'

export type Resident = {
  id: ResidentId
  /** 집 위에 뜨는 이름표 */
  name: string
  x: number
  z: number
}

/** 마을 주민 6명. id 가 'me' 인 집이 "나"입니다. */
export const RESIDENTS: Resident[] = [
  { id: 'minji', name: '민지네', x: -6.0, z: -5.6 },
  { id: 'junho', name: '준호네', x: 6.0, z: -5.6 },
  { id: 'sua', name: '수아네', x: -6.6, z: 5.0 },
  { id: 'me', name: '내 집', x: 6.6, z: 5.0 },
  // 광장 양옆의 집 2채
  { id: 'hana', name: '하나네', x: -9.2, z: -0.4 },
  { id: 'doyun', name: '도윤네', x: 9.2, z: -0.4 },
]

/** 집들이 바라보는 지점 (마을 가운데 광장) */
const PLAZA = { x: 0, z: 1.5 }

/** 집에서 광장 쪽을 향하는 방향 (길이 1) */
function towardPlaza(r: Resident) {
  const dx = PLAZA.x - r.x
  const dz = PLAZA.z - r.z
  const len = Math.hypot(dx, dz)
  return { x: dx / len, z: dz / len }
}

/** 집이 광장을 바라보도록 돌릴 각도 */
export function houseRotation(r: Resident) {
  const d = towardPlaza(r)
  return Math.atan2(d.x, d.z)
}

/** 집 앞 우체통의 위치 (집에서 광장 쪽으로 2.3칸) */
export function mailboxPos(r: Resident) {
  const d = towardPlaza(r)
  return { x: r.x + d.x * 2.3, z: r.z + d.z * 2.3 }
}

/** 광장 둘레의 가로등 위치 */
export const LAMPS: { x: number; z: number }[] = [
  { x: -5.1, z: 0.4 },
  { x: 5.1, z: 0.4 },
  { x: -2.6, z: 5.1 },
  { x: 2.6, z: 5.1 },
  // 뒤쪽 가로등 2개 (대왕 트리 뒤편)
  { x: -3.2, z: -4.6 },
  { x: 3.2, z: -4.6 },
]

/** 광장의 눈사람 위치 */
export const SNOWMAN = { x: -3.4, z: 2.0 }

/** 광장의 순록과 썰매 위치 (지나갈 수 없는 물체) */
export const REINDEER = { x: 3.6, z: 2.2 }
export const SLED = { x: 4.7, z: 3.1 }
