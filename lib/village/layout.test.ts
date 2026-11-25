// houseSlots(집 자리 계산)가 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import {
  HOUSE_FOOTPRINT,
  MAILBOX_OFFSET,
  PLAZA_CENTER,
  houseSlots,
} from "./layout";

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe.each([1, 6, 12, 20])("houseSlots(%i)", (n) => {
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

describe("houseSlots 정면 우선", () => {
  it("0번 집은 카메라 쪽(+z) 정면 근처에 있고, 정면 한가운데는 비어 있다", () => {
    for (const n of [1, 2, 6, 12]) {
      const [first] = houseSlots(n);
      expect(first.z).toBeGreaterThan(0);
      for (const s of houseSlots(n)) {
        // 정면 한가운데(x가 0에 가까운 곳)에는 집이 없어야 함
        expect(Math.abs(s.x)).toBeGreaterThan(1);
      }
    }
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
