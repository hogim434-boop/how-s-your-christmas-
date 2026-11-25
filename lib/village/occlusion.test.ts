// 가리는 집 판단이 맞는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { boundingRect, isOccluding, isOccludingShape, rectsOverlap } from "./occlusion";

const player = boundingRect([
  { x: -0.1, y: -0.2 },
  { x: 0.1, y: 0.1 },
]);

describe("rectsOverlap", () => {
  it("살짝이라도 겹치면 true, 떨어져 있으면 false", () => {
    expect(rectsOverlap(player, { minX: 0.09, minY: 0, maxX: 0.5, maxY: 0.5 })).toBe(true);
    expect(rectsOverlap(player, { minX: 0.11, minY: 0, maxX: 0.5, maxY: 0.5 })).toBe(false);
  });
});

describe("isOccluding", () => {
  const house = { minX: -0.3, minY: -0.5, maxX: 0.3, maxY: 0 };
  it("겹치고 집이 카메라에 더 가까우면 가림", () => {
    expect(isOccluding(house, player, 20, 25)).toBe(true);
  });
  it("겹쳐도 집이 캐릭터보다 뒤에 있으면 가리지 않음", () => {
    expect(isOccluding(house, player, 30, 25)).toBe(false);
  });
});

describe("isOccludingShape (실제 윤곽 비교)", () => {
  // 오른쪽 위가 잘린 비스듬한 마름모 모양 집
  const house = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 0 },
    { x: 1, y: -1 },
  ];
  const sq = (cx: number, cy: number) => [
    { x: cx - 0.1, y: cy - 0.1 },
    { x: cx + 0.1, y: cy - 0.1 },
    { x: cx + 0.1, y: cy + 0.1 },
    { x: cx - 0.1, y: cy + 0.1 },
  ];
  it("네모로는 겹치지만 실제 윤곽 바깥(빈 모서리)이면 가리지 않음", () => {
    expect(isOccludingShape(house, sq(1.8, 0.8), 10, 20)).toBe(false);
  });
  it("윤곽 안쪽이면 가림", () => {
    expect(isOccludingShape(house, sq(1, 0.2), 10, 20)).toBe(true);
  });
});
