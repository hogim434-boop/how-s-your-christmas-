// 캐릭터가 나무·집·우체통을 뚫고 지나가지 않게 하는 "동그라미 충돌" 계산입니다.
// 장애물을 전부 동그라미(중심 + 반지름)로 단순화해서, 겹치면 바깥으로 밀어냅니다.
// 순수 함수라서 3D 없이 테스트할 수 있습니다.

import {
  HOUSE_COLLISION_RADIUS,
  MAILBOX_COLLISION_RADIUS,
  PLAZA_CENTER,
  TREE_COLLISION_RADIUS,
  lampPositions,
  type HouseSlot,
} from "./layout";

export type Circle = { x: number; z: number; r: number };
export type Point = { x: number; z: number };

/** 가로등 기둥 충돌 반지름 */
const LAMP_COLLISION_RADIUS = 0.45;

/** 마을의 모든 장애물(트리·집·우체통·가로등)을 동그라미 목록으로 만듭니다. */
export function buildObstacles(slots: HouseSlot[]): Circle[] {
  const circles: Circle[] = [{ x: PLAZA_CENTER.x, z: PLAZA_CENTER.z, r: TREE_COLLISION_RADIUS }];
  for (const s of slots) {
    circles.push({ x: s.x, z: s.z, r: HOUSE_COLLISION_RADIUS });
    circles.push({ x: s.mailbox.x, z: s.mailbox.z, r: MAILBOX_COLLISION_RADIUS });
  }
  for (const l of lampPositions()) circles.push({ x: l.x, z: l.z, r: LAMP_COLLISION_RADIUS });
  return circles;
}

/**
 * 점 p를 장애물 바깥, 마을 경계 안쪽으로 밀어 넣습니다.
 * - bodyRadius: 캐릭터 몸의 반지름
 * - boundsRadius: 마을 가운데에서 이 거리까지만 걸을 수 있음
 * 장애물을 한 번 밀어낸 뒤 다른 장애물에 다시 겹칠 수 있어서 2번 반복합니다.
 */
export function resolveCollisions(p: Point, circles: Circle[], boundsRadius: number, bodyRadius: number): Point {
  let x = p.x;
  let z = p.z;
  for (let pass = 0; pass < 2; pass++) {
    for (const c of circles) {
      const dx = x - c.x;
      const dz = z - c.z;
      const min = c.r + bodyRadius;
      const d = Math.hypot(dx, dz);
      if (d < min) {
        if (d < 1e-6) {
          // 정확히 중심이면 +z 쪽으로 밀어냄
          z = c.z + min;
        } else {
          x = c.x + (dx / d) * min;
          z = c.z + (dz / d) * min;
        }
      }
    }
    // 마을 경계 밖으로 나가면 경계 위로 끌어당김
    const dist = Math.hypot(x - PLAZA_CENTER.x, z - PLAZA_CENTER.z);
    const maxDist = boundsRadius - bodyRadius;
    if (dist > maxDist) {
      x = PLAZA_CENTER.x + ((x - PLAZA_CENTER.x) / dist) * maxDist;
      z = PLAZA_CENTER.z + ((z - PLAZA_CENTER.z) / dist) * maxDist;
    }
  }
  return { x, z };
}
