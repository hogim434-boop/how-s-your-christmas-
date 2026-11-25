// houseSlots(집 자리 계산)가 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import {
  HOUSE_FOOTPRINT,
  MAILBOX_OFFSET,
  PLAZA_CENTER,
  hiddenByTree,
  houseSlots,
  ringCapacity,
  ringRadius,
  ringRadiusAt,
} from "./layout";

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe.each([1, 6, 8, 9, 20, 44])("houseSlots(%i)", (n) => {
  const slots = houseSlots(n);

  it("집 개수가 n과 같다", () => {
    expect(slots).toHaveLength(n);
  });

  it("어떤 두 집도 집 크기보다 가깝지 않다", () => {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        expect(dist(slots[i], slots[j])).toBeGreaterThanOrEqual(HOUSE_FOOTPRINT);
      }
    }
  });

  it("모든 집의 앞면이 광장 가운데를 향한다", () => {
    for (const s of slots) {
      // 집 앞면 방향 = (sin r, cos r). 가운데로 향하는 방향과 같아야 함
      const toCenter = {
        x: PLAZA_CENTER.x - s.x,
        z: PLAZA_CENTER.z - s.z,
      };
      const len = Math.hypot(toCenter.x, toCenter.z);
      expect(Math.sin(s.rotation)).toBeCloseTo(toCenter.x / len, 6);
      expect(Math.cos(s.rotation)).toBeCloseTo(toCenter.z / len, 6);
    }
  });

  it("우체통은 집과 가운데 사이에 있다", () => {
    for (const s of slots) {
      const house = dist(s, PLAZA_CENTER);
      const box = dist(s.mailbox, PLAZA_CENTER);
      expect(box).toBeLessThan(house);
      expect(dist(s, s.mailbox)).toBeCloseTo(MAILBOX_OFFSET, 6);
    }
  });

  it("트리 바로 뒤쪽(-z)은 비어 있다", () => {
    for (const s of slots) {
      const angle = Math.atan2(s.x, -s.z); // 뒤쪽이 0이 되는 각도
      expect(Math.abs(angle)).toBeGreaterThan(Math.PI / 8);
    }
  });
});

describe("houseSlots 채우는 순서 (11.25: 화면 위쪽부터, 원은 8 → 10 → 12 → 14채)", () => {
  it("정면 한가운데(카메라 바로 앞)는 항상 비어 있다", () => {
    for (const s of houseSlots(44)) expect(s.x === 0 && s.z > 0).toBe(false);
    for (const s of houseSlots(44)) {
      if (s.z > 0) expect(Math.abs(s.x)).toBeGreaterThan(1);
    }
  });

  it("첫 집은 화면 위쪽(뒤쪽, -z)이면서 트리에 가려지지 않는 자리다", () => {
    const [first] = houseSlots(1);
    expect(first.z).toBeLessThan(0);
    expect(hiddenByTree(first.x, first.z)).toBe(false);
  });

  it("한 원 안에서는 트리에 안 가려지는 자리를 위쪽부터 채우고, 가려지는 자리는 마지막", () => {
    const ring = houseSlots(8);
    const visible = ring.filter((s) => !hiddenByTree(s.x, s.z));
    const hidden = ring.filter((s) => hiddenByTree(s.x, s.z));
    expect(ring.slice(0, visible.length)).toEqual(visible);
    expect(hidden.length).toBeGreaterThan(0);
    for (let i = 1; i < visible.length; i++) {
      expect(visible[i].z).toBeGreaterThanOrEqual(visible[i - 1].z - 1e-6);
    }
  });

  it("원 크기: 8채가 차면 바깥 원(10채), 그다음 12채, 14채", () => {
    expect([0, 1, 2, 3].map(ringCapacity)).toEqual([8, 10, 12, 14]);
    const radiusOf = (s: { x: number; z: number }) => Math.round(Math.hypot(s.x, s.z));
    const slots = houseSlots(8 + 10 + 12 + 14);
    const counts = new Map<number, number>();
    for (const s of slots) counts.set(radiusOf(s), (counts.get(radiusOf(s)) ?? 0) + 1);
    expect([...counts.values()]).toEqual([8, 10, 12, 14]);
    // 9번째 사람부터 바깥 원
    expect(radiusOf(slots[8])).toBeGreaterThan(radiusOf(slots[7]));
  });

  it("사람이 늘어도 이미 있던 집 자리는 그대로다", () => {
    const before = houseSlots(9);
    const after = houseSlots(20);
    expect(after.slice(0, 9)).toEqual(before);
  });

  it("울타리 기준 반지름은 가장 바깥 원", () => {
    expect(ringRadius(8)).toBe(ringRadiusAt(0));
    expect(ringRadius(9)).toBe(ringRadiusAt(1));
    expect(ringRadius(18)).toBe(ringRadiusAt(1));
    expect(ringRadius(19)).toBe(ringRadiusAt(2));
  });
});

describe("울타리와 걸을 수 있는 범위", () => {
  it("울타리는 집 뒤쪽까지 걸을 공간을 두고 바깥에 놓이며, 걸을 수 있는 범위는 울타리 안쪽", async () => {
    const { fenceRadius, walkRadius, ringRadius, HOUSE_FOOTPRINT } = await import("./layout");
    for (const n of [1, 6, 12, 20]) {
      // 집 바깥 끝보다 울타리가 충분히 멀리 있어야 집 뒤로도 걸어갈 수 있음
      expect(fenceRadius(n) - (ringRadius(n) + HOUSE_FOOTPRINT / 2)).toBeGreaterThan(4);
      expect(walkRadius(n)).toBeLessThan(fenceRadius(n));
    }
  });
});
