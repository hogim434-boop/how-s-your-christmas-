// 걷기 계산(walker.ts)이 "옮기기 전 내 캐릭터의 걷기"와 똑같은지 확인합니다. (Task 025-2)
// 아래 legacyStep은 옮기기 전 Player.tsx의 계산을 그대로 베껴 둔 것입니다. 둘의 궤적이 한 치도 다르면 안 됩니다.

import { describe, expect, it } from "vitest";
import { buildObstacles, resolveCollisions, type Circle, type Point } from "./collision";
import { houseSlots, PLAYER_START, walkRadius } from "./layout";
import { findPath } from "./pathfind";
import { approachPoint } from "./proximity";
import { createWalker, planRoute, stepWalker } from "./walker";

// ── 옮기기 전 Player.tsx의 값과 계산 (11.27 기준, 고치지 마세요) ──
const WALK_SPEED = 4.5;
const BODY_RADIUS = 0.5;
const ARRIVE_DISTANCE = 0.08;
const TURN_SPEED = 12;
type Legacy = { x: number; z: number; rotY: number; route: Point[]; stuck: number; walking: boolean };
function legacyPlan(s: Legacy, target: Point, obstacles: Circle[], boundsRadius: number) {
  const goal = resolveCollisions(target, obstacles, boundsRadius, BODY_RADIUS);
  s.route = findPath({ x: s.x, z: s.z }, goal, obstacles, boundsRadius, BODY_RADIUS);
  s.stuck = 0;
}
function legacyStep(s: Legacy, delta: number, obstacles: Circle[], boundsRadius: number) {
  const dt = Math.min(delta, 0.05);
  const dest = s.route[0];
  if (!dest) return;
  const dx = dest.x - s.x;
  const dz = dest.z - s.z;
  const dist = Math.hypot(dx, dz);
  if (dist < ARRIVE_DISTANCE) {
    s.route.shift();
    if (s.route.length === 0) s.walking = false;
    return;
  }
  const step = Math.min(WALK_SPEED * dt, dist);
  const wanted = { x: s.x + (dx / dist) * step, z: s.z + (dz / dist) * step };
  const next = resolveCollisions(wanted, obstacles, boundsRadius, BODY_RADIUS);
  const moved = Math.hypot(next.x - s.x, next.z - s.z);
  if (moved < step * 0.25) {
    s.stuck += dt;
    if (s.stuck > 0.4) {
      s.route = [];
      s.walking = false;
      return;
    }
  } else {
    s.stuck = 0;
  }
  if (moved > 1e-5) {
    const heading = Math.atan2(next.x - s.x, next.z - s.z);
    let diff = heading - s.rotY;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    s.rotY += diff * Math.min(1, TURN_SPEED * dt);
  }
  s.x = next.x;
  s.z = next.z;
  s.walking = true;
}

/** 장면 간격을 일부러 들쭉날쭉하게 (60장/초, 120장/초, 끊김) 섞습니다 */
const DELTAS = [1 / 60, 1 / 120, 1 / 60, 1 / 30, 0.2, 1 / 60];

describe("stepWalker: 옮기기 전 걷기와 같은 궤적", () => {
  for (const n of [1, 3, 6, 8, 20]) {
    it(`주민 ${n}명 마을에서 우체통들을 차례로 오가도 궤적이 같다`, () => {
      const slots = houseSlots(n);
      const obstacles = buildObstacles(slots);
      const bounds = walkRadius(n);
      // 목표들: 모든 우체통 앞 + 트리 한가운데(장애물 안) + 울타리 밖
      const targets: Point[] = [...slots.map((s) => approachPoint(s.mailbox)), { x: 0, z: 0 }, { x: 500, z: -300 }, PLAYER_START];
      const legacy: Legacy = { x: PLAYER_START.x, z: PLAYER_START.z, rotY: 0, route: [], stuck: 0, walking: false };
      const walker = createWalker(PLAYER_START.x, PLAYER_START.z);
      let frame = 0;
      for (const target of targets) {
        legacyPlan(legacy, target, obstacles, bounds);
        planRoute(walker, target, obstacles, bounds);
        // 걷는 도중에 목표가 바뀌는 경우도 보려고, 짝수 번째 목표는 90장면만 걷고 넘어갑니다
        const limit = targets.indexOf(target) % 2 === 0 ? 90 : 4000;
        for (let i = 0; i < limit; i++) {
          const dt = DELTAS[frame++ % DELTAS.length];
          legacyStep(legacy, dt, obstacles, bounds);
          const walking = stepWalker(walker, dt, obstacles, bounds);
          expect(walker.x).toBe(legacy.x);
          expect(walker.z).toBe(legacy.z);
          expect(walker.rotY).toBe(legacy.rotY);
          expect(walker.route.length).toBe(legacy.route.length);
          expect(walking).toBe(legacy.walking);
          if (!walking && i > 0) break;
        }
      }
    });
  }
});

describe("stepWalker: 기본 동작", () => {
  const obstacles = buildObstacles(houseSlots(6));
  const bounds = walkRadius(6);

  it("목표가 없으면 움직이지 않고 false", () => {
    const w = createWalker(1, 2, 0.5);
    expect(stepWalker(w, 1 / 60, obstacles, bounds)).toBe(false);
    expect(w).toEqual({ x: 1, z: 2, rotY: 0.5, route: [], stuck: 0 });
  });

  it("속도 배율을 주면 그만큼 빨리 간다", () => {
    const a = createWalker(PLAYER_START.x, PLAYER_START.z);
    const b = createWalker(PLAYER_START.x, PLAYER_START.z);
    const target = { x: PLAYER_START.x + 3, z: PLAYER_START.z + 2 };
    planRoute(a, target, obstacles, bounds);
    planRoute(b, target, obstacles, bounds);
    stepWalker(a, 1 / 60, obstacles, bounds);
    stepWalker(b, 1 / 60, obstacles, bounds, 2);
    const da = Math.hypot(a.x - PLAYER_START.x, a.z - PLAYER_START.z);
    const db = Math.hypot(b.x - PLAYER_START.x, b.z - PLAYER_START.z);
    expect(db).toBeCloseTo(da * 2, 6);
  });

  it("끝까지 걸으면 목표 자리에 선다", () => {
    const w = createWalker(PLAYER_START.x, PLAYER_START.z);
    const target = approachPoint(houseSlots(6)[3].mailbox);
    planRoute(w, target, obstacles, bounds);
    for (let i = 0; i < 4000 && (stepWalker(w, 1 / 60, obstacles, bounds) || i === 0); i++);
    expect(Math.hypot(w.x - target.x, w.z - target.z)).toBeLessThan(0.3);
  });
});
