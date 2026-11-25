// 가까운 우체통 찾기가 약속대로 동작하는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { PROMPT_RADIUS, approachPoint, nearestSpot } from "./proximity";

const spots = [
  { id: "a", x: 10, z: 0 },
  { id: "b", x: 0, z: 10 },
];

describe("nearestSpot", () => {
  it("범위 안에 아무것도 없으면 null", () => {
    expect(nearestSpot({ x: 0, z: 0 }, spots)).toBeNull();
  });
  it("범위 안의 우체통을 찾음", () => {
    expect(nearestSpot({ x: 8, z: 0 }, spots)?.id).toBe("a");
  });
  it("둘 다 가까우면 더 가까운 쪽 하나만", () => {
    const close = [
      { id: "a", x: 1, z: 0 },
      { id: "b", x: 2, z: 0 },
    ];
    expect(nearestSpot({ x: 1.8, z: 0 }, close)?.id).toBe("b");
  });
});

describe("approachPoint", () => {
  it("걸어갈 자리는 우체통보다 광장 가운데 쪽이며, 버튼이 뜨는 범위 안", () => {
    const p = approachPoint({ x: 10, z: 0 });
    expect(p.x).toBeLessThan(10);
    expect(nearestSpot(p, spots)?.id).toBe("a");
    expect(Math.hypot(p.x - 10, p.z)).toBeLessThan(PROMPT_RADIUS);
  });
});
