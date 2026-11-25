// 동그라미 충돌 계산이 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { buildObstacles, resolveCollisions, type Circle } from "./collision";
import { houseSlots, PLAYER_START, ringRadius, TREE_COLLISION_RADIUS } from "./layout";

const circle: Circle = { x: 0, z: 0, r: 2 };

describe("resolveCollisions", () => {
  it("장애물과 안 겹치면 그대로 둔다", () => {
    expect(resolveCollisions({ x: 5, z: 0 }, [circle], 50, 0.5)).toEqual({ x: 5, z: 0 });
  });

  it("장애물 안으로 들어가면 바깥으로 밀어낸다", () => {
    const out = resolveCollisions({ x: 1, z: 0 }, [circle], 50, 0.5);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(2.5, 6);
  });

  it("마을 경계 밖이면 경계 위로 끌어당긴다", () => {
    const out = resolveCollisions({ x: 100, z: 0 }, [], 20, 0.5);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(19.5, 6);
  });
});

describe("buildObstacles", () => {
  it("캐릭터 시작 위치는 어떤 장애물과도 겹치지 않는다", () => {
    for (const n of [1, 6, 12, 20]) {
      const obstacles = buildObstacles(houseSlots(n));
      const out = resolveCollisions(PLAYER_START, obstacles, ringRadius(n) + 2, 0.5);
      expect(out.x).toBeCloseTo(PLAYER_START.x, 6);
      expect(out.z).toBeCloseTo(PLAYER_START.z, 6);
    }
  });

  it("트리 한가운데를 찍어도 트리 바깥으로 밀려난다", () => {
    const out = resolveCollisions({ x: 0.5, z: 0.5 }, buildObstacles(houseSlots(6)), 15, 0.5);
    expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(TREE_COLLISION_RADIUS);
  });
});
