import { describe, expect, it } from "vitest";
import { DEFAULT_PARTS, parseCharacterParts, PART_KEYS, PART_OPTIONS } from "./parts";

describe("꾸미기 부위", () => {
  it("부위는 6가지이고, 부위마다 고를 모양이 3개 이상 있다", () => {
    expect(PART_KEYS).toHaveLength(6);
    for (const part of PART_KEYS) expect(PART_OPTIONS[part].length).toBeGreaterThanOrEqual(3);
  });
  it("기본 모양은 모두 목록 안에 있는 값이다", () => {
    for (const part of PART_KEYS) {
      expect(PART_OPTIONS[part].some((o) => o.key === DEFAULT_PARTS[part])).toBe(true);
    }
  });
});

describe("parseCharacterParts (저장값 확인)", () => {
  it("없거나 깨진 값이면 기본 모양", () => {
    expect(parseCharacterParts(null)).toEqual(DEFAULT_PARTS);
    expect(parseCharacterParts("x")).toEqual(DEFAULT_PARTS);
    expect(parseCharacterParts({ ...DEFAULT_PARTS, hair: "없는 모양" })).toEqual(DEFAULT_PARTS);
  });
  it("올바른 값이면 그대로 쓴다", () => {
    const saved = { ...DEFAULT_PARTS, hair: "hair_3", hat: "hat_2" };
    expect(parseCharacterParts(saved)).toEqual(saved);
  });
});
