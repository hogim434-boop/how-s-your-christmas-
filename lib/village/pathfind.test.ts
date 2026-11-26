// 길 찾기가 약속을 지키는지 확인하는 테스트입니다.
// 실제 캐릭터(Player.tsx)와 같은 방식으로 한 걸음씩 걸려 보며, 우체통 사이를 끝까지 가는지 봅니다.
import { describe, expect, it } from "vitest";
import { buildObstacles, resolveCollisions, type Circle, type Point } from "./collision";
import { houseSlots, PLAYER_START, ringRadius } from "./layout";
import { findPath, segmentClear } from "./pathfind";
import { approachPoint, PROMPT_RADIUS } from "./proximity";

const BODY = 0.5;
const SPEED = 4.5;
const DT = 1 / 60;

/** Player.tsx의 걷기와 같은 규칙으로 경유지를 따라 걸어 봅니다. 도착하면 걸린 시간(초), 막히면 null */
function walk(start: Point, path: Point[], circles: Circle[], bounds: number): { seconds: number; end: Point } | null {
  let pos = { ...start };
  let stuck = 0;
  let seconds = 0;
  for (const dest of path) {
    for (;;) {
      const dx = dest.x - pos.x;
      const dz = dest.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.08) break;
      const step = Math.min(SPEED * DT, dist);
      const next = resolveCollisions({ x: pos.x + (dx / dist) * step, z: pos.z + (dz / dist) * step }, circles, bounds, BODY);
      const moved = Math.hypot(next.x - pos.x, next.z - pos.z);
      if (moved < step * 0.25) {
        stuck += DT;
        if (stuck > 0.4) return null;
      } else stuck = 0;
      pos = next;
      seconds += DT;
      if (seconds > 120) return null;
    }
  }
  return { seconds, end: pos };
}

/** 마을 n명의 장애물, 경계, 우체통 앞 자리들 */
function village(n: number) {
  const slots = houseSlots(n);
  const circles = buildObstacles(slots);
  const bounds = ringRadius(n) + 2;
  const fronts = slots.map((s) => resolveCollisions(approachPoint(s.mailbox), circles, bounds, BODY));
  return { slots, circles, bounds, fronts };
}

describe("segmentClear", () => {
  const tree: Circle = { x: 0, z: 0, r: 2 };
  it("장애물을 가로지르는 선은 막힌 것으로 본다", () => {
    expect(segmentClear({ x: -5, z: 0 }, { x: 5, z: 0 }, [tree], BODY)).toBe(false);
  });
  it("장애물을 비켜 가는 선은 뚫린 것으로 본다", () => {
    expect(segmentClear({ x: -5, z: 3 }, { x: 5, z: 3 }, [tree], BODY)).toBe(true);
  });
});

describe("findPath", () => {
  it("똑바로 갈 수 있으면 목표 하나만 돌려준다", () => {
    expect(findPath({ x: -5, z: 3 }, { x: 5, z: 3 }, [{ x: 0, z: 0, r: 2 }], 30, BODY)).toEqual([{ x: 5, z: 3 }]);
  });

  it("예전 방식(똑바로만 걷기)은 주민 3명 마을에서 우체통 사이를 못 가는 경우가 있다 (고친 버그의 기록)", () => {
    const { circles, bounds, fronts } = village(3);
    let failures = 0;
    for (const a of fronts) for (const b of fronts) if (a !== b && !walk(a, [b], circles, bounds)) failures++;
    expect(failures).toBeGreaterThan(0);
  });

  it("주민 1~20명 마을에서 모든 우체통 사이를 끝까지 걸어간다", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 12, 20]) {
      const { slots, circles, bounds, fronts } = village(n);
      const starts = [PLAYER_START, ...fronts];
      for (const from of starts) {
        fronts.forEach((to, i) => {
          if (from === to) return;
          const path = findPath(from, to, circles, bounds, BODY);
          const result = walk(from, path, circles, bounds);
          expect(result, `n=${n} 우체통 ${i}`).not.toBeNull();
          // 도착한 자리에서 편지 쓰기 버튼이 뜰 만큼 우체통과 가깝다
          expect(Math.hypot(result!.end.x - slots[i].mailbox.x, result!.end.z - slots[i].mailbox.z)).toBeLessThan(PROMPT_RADIUS);
          // 돌아가더라도 직선 거리의 2배 + 여유 안에 도착한다
          const straight = Math.hypot(to.x - from.x, to.z - from.z);
          expect(result!.seconds).toBeLessThan((straight * 2) / SPEED + 2);
        });
      }
    }
  });

  it("경유지 사이는 모두 똑바로 갈 수 있는 구간이다", () => {
    const { circles, bounds, fronts } = village(3);
    const path = findPath(fronts[0], fronts[1], circles, bounds, BODY);
    let prev = fronts[0];
    for (const p of path) {
      expect(segmentClear(prev, p, circles, BODY)).toBe(true);
      prev = p;
    }
  });
});
