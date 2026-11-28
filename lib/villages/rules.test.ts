import { describe, expect, it } from "vitest";
import {
  availableVillageKinds,
  clampCapacity,
  validateCapacity,
  validateVillageName,
  VILLAGE_CAPACITY_MAX,
  VILLAGE_CAPACITY_MIN,
  VILLAGE_NAME_MAX,
} from "./rules";

describe("정원", () => {
  it("3~30명만 된다 (아직 고르지 않았거나 소수면 안 됨)", () => {
    expect(validateCapacity(null)).toBe(false);
    expect(validateCapacity(VILLAGE_CAPACITY_MIN - 1)).toBe(false);
    expect(validateCapacity(VILLAGE_CAPACITY_MIN)).toBe(true);
    expect(validateCapacity(VILLAGE_CAPACITY_MAX)).toBe(true);
    expect(validateCapacity(VILLAGE_CAPACITY_MAX + 1)).toBe(false);
    expect(validateCapacity(4.5)).toBe(false);
  });
  it("범위 밖의 값은 범위 안으로 맞춘다", () => {
    expect(clampCapacity(0)).toBe(VILLAGE_CAPACITY_MIN);
    expect(clampCapacity(99)).toBe(VILLAGE_CAPACITY_MAX);
    expect(clampCapacity(7.9)).toBe(7);
    expect(clampCapacity(Number.NaN)).toBe(VILLAGE_CAPACITY_MIN);
  });
});

describe("validateVillageName", () => {
  it("빈 이름·띄어쓰기만 있는 이름은 안 된다", () => {
    expect(validateVillageName("")).toBe("empty");
    expect(validateVillageName("   ")).toBe("empty");
  });
  it("20자까지는 되고 21자는 안 된다", () => {
    expect(validateVillageName("가".repeat(VILLAGE_NAME_MAX))).toBe("ok");
    expect(validateVillageName("가".repeat(VILLAGE_NAME_MAX + 1))).toBe("tooLong");
  });
  it("앞뒤 띄어쓰기는 글자 수에 넣지 않는다", () => {
    expect(validateVillageName(`  ${"가".repeat(VILLAGE_NAME_MAX)}  `)).toBe("ok");
  });
});

describe("availableVillageKinds", () => {
  it("커플 선택지를 끄면 친구 마을만 남는다", () => {
    expect(availableVillageKinds(true)).toEqual(["friends", "couple"]);
    expect(availableVillageKinds(false)).toEqual(["friends"]);
  });
});
