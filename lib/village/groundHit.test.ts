// 누른 곳의 땅 위치 계산(groundHit)이 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { groundHit } from "./groundHit";
import { FENCE_MARGIN, houseSlots, ringRadius } from "./layout";
import { createTerrain } from "./terrain";

const n = 20;
const slots = houseSlots(n);
const fence = ringRadius(n) + FENCE_MARGIN;
const terrain = createTerrain(slots, fence, fence + 30);
const RADIUS = ringRadius(n) + 80;

/** 길이 1인 방향으로 맞춥니다 */
function unit(x: number, y: number, z: number) {
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
}

describe("groundHit", () => {
  it("평평한 땅에서는 높이 0인 자리를 찾는다", () => {
    const hit = groundHit({ x: 0, y: 10, z: 10 }, unit(0, -1, -1), () => 0, RADIUS);
    expect(hit).not.toBeNull();
    expect(hit!.point.x).toBeCloseTo(0, 5);
    expect(hit!.point.y).toBeCloseTo(0, 5);
    expect(hit!.point.z).toBeCloseTo(0, 5);
    expect(hit!.distance).toBeCloseTo(Math.hypot(10, 10), 5);
  });

  it("찾은 자리는 실제 땅 표면 위에 있다 (카메라 위치에서 여러 방향으로)", () => {
    const origin = { x: 3, y: 16, z: 30 };
    for (let dx = -0.8; dx <= 0.8; dx += 0.2) {
      for (let dy = -0.9; dy <= -0.1; dy += 0.1) {
        const hit = groundHit(origin, unit(dx, dy, -1), terrain.heightAt, RADIUS);
        if (!hit) continue;
        expect(Math.abs(hit.point.y - terrain.heightAt(hit.point.x, hit.point.z))).toBeLessThan(0.002);
      }
    }
  });

  it("둔덕 뒤에 가려진 땅이 아니라, 시선이 처음 닿는 앞쪽 둔덕을 찾는다", () => {
    // z = 0 ~ -2 사이에 높이 1짜리 벽이 있는 땅
    const wall = (_x: number, z: number) => (z <= 0 && z >= -2 ? 1 : 0);
    const hit = groundHit({ x: 0, y: 2, z: 10 }, unit(0, -0.2, -1), wall, RADIUS);
    // 벽이 없다면 z = 0 (높이 0)에서 닿지만, 벽의 앞면(z = 0, 높이 0~1)에 먼저 닿습니다
    expect(hit!.point.z).toBeCloseTo(0, 2);
    expect(hit!.point.y).toBeGreaterThan(-0.01);
    expect(hit!.point.y).toBeLessThan(1.01);
  });

  it("하늘을 보는 시선과 땅 바깥은 null", () => {
    expect(groundHit({ x: 0, y: 10, z: 10 }, unit(0, 0.3, -1), () => 0, RADIUS)).toBeNull();
    expect(groundHit({ x: 0, y: 10, z: 10 }, unit(0, -0.001, -1), () => 0, 50)).toBeNull();
  });
});
