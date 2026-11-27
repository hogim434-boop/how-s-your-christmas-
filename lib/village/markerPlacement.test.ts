import { describe, expect, it } from "vitest";
import { FENCE_MARGIN, houseSlots, ringRadius } from "./layout";
import { markerPlacement, MARKER_LIFT } from "./markerPlacement";
import { createTerrain } from "./terrain";

describe("markerPlacement", () => {
  it("평평한 땅에서는 살짝 띄운 높이에 똑바로 눕는다", () => {
    const p = markerPlacement(3, -2, () => 0);
    expect(p.y).toBeCloseTo(MARKER_LIFT);
    expect(p.normal).toEqual({ x: -0, y: 1, z: -0 });
  });

  it("비탈에서는 땅의 기울기를 따라 기운다", () => {
    // 동쪽(x+)으로 갈수록 높아지는 비탈 → 땅은 서쪽 위를 바라봅니다
    const p = markerPlacement(0, 0, (x) => 2 + x * 0.5);
    expect(p.y).toBeCloseTo(2 + MARKER_LIFT);
    expect(p.normal.x).toBeLessThan(0);
    expect(Math.hypot(p.normal.x, p.normal.y, p.normal.z)).toBeCloseTo(1);
  });

  it("실제 마을 지형 어디를 눌러도 동그라미가 눈 속에 묻히지 않는다", () => {
    for (const count of [2, 6, 20]) {
      // 걸어 다닐 수 있는 곳 = 울타리 안 (실제 화면과 같은 값으로 지형을 만듭니다)
      const radius = ringRadius(count) + FENCE_MARGIN;
      const terrain = createTerrain(houseSlots(count), radius, radius + 40);
      let worst = Infinity;
      let buriedBefore = 0;
      let taps = 0;
      for (let x = -radius; x <= radius; x += 0.7) {
        for (let z = -radius; z <= radius; z += 0.7) {
          if (Math.hypot(x, z) > radius) continue;
          taps++;
          if (terrain.heightAt(x, z) > 0.08) buriedBefore++;
          const { y, normal: n } = markerPlacement(x, z, terrain.heightAt);
          // 동그라미가 처음 나타날 때의 바깥 테두리(반지름 0.5) 위의 점들이 땅보다 위에 있는지 봅니다
          // 기울어진 판 위의 점: 가운데에서 (dx, dz)만큼 떨어진 곳의 높이 = y - (n.x*dx + n.z*dz) / n.y
          for (let a = 0; a < 16; a++) {
            const dx = Math.cos((a / 16) * Math.PI * 2) * 0.5;
            const dz = Math.sin((a / 16) * Math.PI * 2) * 0.5;
            const ringY = y - (n.x * dx + n.z * dz) / n.y;
            worst = Math.min(worst, ringY - terrain.heightAt(x + dx, z + dz));
          }
        }
      }
      // 고치기 전(높이 0.08 고정)에는 묻히는 자리가 실제로 있었습니다
      expect(buriedBefore).toBeGreaterThan(0);
      expect(taps).toBeGreaterThan(100);
      expect(worst).toBeGreaterThan(0);
    }
  });
});
