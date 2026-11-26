// 닉네임 다듬기(normalizeName)가 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { DEFAULT_NAME, MAX_NAME_LENGTH, normalizeName } from "./name";

describe("normalizeName", () => {
  it("앞뒤 공백을 지운다", () => {
    expect(normalizeName("  서연  ")).toBe("서연");
  });

  it("비어 있거나 글자가 아니면 기본 이름", () => {
    expect(normalizeName("")).toBe(DEFAULT_NAME);
    expect(normalizeName("   ")).toBe(DEFAULT_NAME);
    expect(normalizeName(undefined)).toBe(DEFAULT_NAME);
    expect(normalizeName(123)).toBe(DEFAULT_NAME);
  });

  it("50자를 넘으면 50자까지만 남긴다", () => {
    expect([...normalizeName("가".repeat(51))]).toHaveLength(MAX_NAME_LENGTH);
  });

  it("이모지를 반으로 자르지 않는다", () => {
    const name = normalizeName("🎄".repeat(60));
    expect([...name]).toHaveLength(MAX_NAME_LENGTH);
    expect(name).toBe("🎄".repeat(MAX_NAME_LENGTH));
  });
});
