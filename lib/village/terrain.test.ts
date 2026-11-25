// 눈밭 높이 계산(createTerrain)이 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { FENCE_MARGIN, PLAZA_RADIUS, houseSlots, ringRadius } from "./layout";
import { OUTER_BUMP_HEIGHT, createTerrain } from "./terrain";

const n = 20;
const slots = houseSlots(n);
const fence = ringRadius(n) + FENCE_MARGIN;
const edge = fence + 30;
const terrain = createTerrain(slots, fence, edge);

describe("createTerrain", () => {
  it("광장 안은 평평하다", () => {
    for (let a = 0; a < 6.28; a += 0.3) {
      expect(terrain.heightAt(Math.sin(a) * (PLAZA_RADIUS - 0.5), Math.cos(a) * (PLAZA_RADIUS - 0.5))).toBe(0);
    }
  });

  it("집 자리와 우체통 자리는 평평하다", () => {
    for (const s of slots) {
      expect(terrain.heightAt(s.x, s.z)).toBe(0);
      expect(terrain.heightAt(s.x + 2, s.z - 2)).toBe(0);
      expect(terrain.heightAt(s.mailbox.x, s.mailbox.z)).toBe(0);
    }
  });

  it("울타리 줄과 울퉁불퉁한 구역 끝은 평평하다", () => {
    for (let a = 0; a < 6.28; a += 0.2) {
      expect(terrain.heightAt(Math.sin(a) * fence, Math.cos(a) * fence)).toBe(0);
      expect(terrain.heightAt(Math.sin(a) * edge, Math.cos(a) * edge)).toBe(0);
    }
  });

  it("높이는 0 이상, 최대 높이 이하이고 둔덕이 실제로 있다", () => {
    let max = 0;
    for (let x = -edge; x <= edge; x += 1.5) {
      for (let z = -edge; z <= edge; z += 1.5) {
        const h = terrain.heightAt(x, z);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(OUTER_BUMP_HEIGHT);
        max = Math.max(max, h);
      }
    }
    expect(max).toBeGreaterThan(0.3);
  });

  it("같은 마을이면 언제나 같은 모양", () => {
    const again = createTerrain(slots, fence, edge);
    expect(again.heightAt(13.3, -21.7)).toBe(terrain.heightAt(13.3, -21.7));
  });
});
