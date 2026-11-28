import { describe, expect, it } from "vitest";
import {
  BASE_DEFAULTS,
  BASE_KEYS,
  DEFAULT_PARTS,
  NONE,
  PART_COLORS,
  PART_KEYS,
  PART_SHAPES,
  colorField,
  colorHex,
  parseCharacterParts,
  partsFromSeed,
} from "./parts";

describe("꾸미기 목록", () => {
  it("부위는 5가지, 색은 10가지, 캐릭터는 여자·남자", () => {
    expect(PART_KEYS).toEqual(["top", "bottom", "gloves", "scarf", "shoes"]);
    expect(PART_COLORS).toHaveLength(10);
    expect(BASE_KEYS).toEqual(["girl", "boy"]);
  });
  it("안 할 수 있는 부위는 장갑·목도리뿐이다", () => {
    for (const part of PART_KEYS) {
      expect(PART_SHAPES[part].includes(NONE)).toBe(part === "gloves" || part === "scarf");
    }
  });
  it("캐릭터별 기본 옷은 모두 올바른 값이다", () => {
    for (const base of BASE_KEYS) {
      expect(parseCharacterParts(BASE_DEFAULTS[base])).toEqual(BASE_DEFAULTS[base]);
      expect(BASE_DEFAULTS[base].base).toBe(base);
    }
  });
  it("색 이름으로 색 값을 찾고, 모르는 이름이면 첫 번째 색", () => {
    expect(colorHex("navy")).toBe("#2f3f6b");
    expect(colorHex("없는 색")).toBe(PART_COLORS[0].hex);
  });
});

describe("parseCharacterParts (저장값 확인)", () => {
  it("없거나 깨진 값이면 기본 모양", () => {
    expect(parseCharacterParts(null)).toEqual(DEFAULT_PARTS);
    expect(parseCharacterParts("x")).toEqual(DEFAULT_PARTS);
    expect(parseCharacterParts({ ...DEFAULT_PARTS, top: "없는 모양" })).toEqual(DEFAULT_PARTS);
    expect(parseCharacterParts({ ...DEFAULT_PARTS, topColor: "없는 색" })).toEqual(DEFAULT_PARTS);
    expect(parseCharacterParts({ ...DEFAULT_PARTS, base: "robot" })).toEqual(DEFAULT_PARTS);
  });
  it("올바른 값이면 그대로 쓴다", () => {
    const saved = { ...BASE_DEFAULTS.boy, top: "santa", topColor: "green", scarf: "muffler", shoes: "boots" };
    expect(parseCharacterParts(saved)).toEqual(saved);
  });
  it("모르는 칸은 버린다", () => {
    expect(parseCharacterParts({ ...DEFAULT_PARTS, hat: "hat_1" })).toEqual(DEFAULT_PARTS);
  });
  it("예전 방식 값(캐릭터·색 칸 없음)은 기본 모양", () => {
    const old = { top: "top_2", bottom: "bottom_1", gloves: "none", scarf: "none", shoes: "shoes_1" };
    expect(parseCharacterParts(old)).toEqual(DEFAULT_PARTS);
  });
});

describe("partsFromSeed (가짜 주민 옷)", () => {
  it("같은 글자면 같은 옷, 늘 올바른 값", () => {
    for (const seed of ["ghost-1", "ghost-2", "abc"]) {
      const parts = partsFromSeed(seed);
      expect(partsFromSeed(seed)).toEqual(parts);
      expect(parseCharacterParts(parts)).toEqual(parts);
      expect(parts[colorField("top")]).toBeTruthy();
    }
  });
  it("글자가 다르면 대체로 다른 옷", () => {
    const looks = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(partsFromSeed(`ghost-${i}`))));
    expect(looks.size).toBeGreaterThan(8);
  });
});
