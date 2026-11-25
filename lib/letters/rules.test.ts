import { describe, expect, it } from "vitest";
import { isLetterLocked, LETTER_MAX_LENGTH, letterLength, letterPreview, validateLetter } from "./rules";

describe("isLetterLocked (한국 시간 12.25 0시 기준)", () => {
  it("12.24 23:59(한국 시간)에는 잠겨 있다", () => {
    expect(isLetterLocked(new Date("2026-12-24T23:59:59+09:00"))).toBe(true);
  });
  it("12.25 00:00(한국 시간)부터 열린다", () => {
    expect(isLetterLocked(new Date("2026-12-25T00:00:00+09:00"))).toBe(false);
  });
  it("11월에는 잠겨 있고, 12.31에는 열려 있다", () => {
    expect(isLetterLocked(new Date("2026-11-25T12:00:00+09:00"))).toBe(true);
    expect(isLetterLocked(new Date("2026-12-31T12:00:00+09:00"))).toBe(false);
  });
  it("다른 나라 시각으로 적어도 한국 시간 기준으로 판단한다", () => {
    // UTC 12.24 15:00 = 한국 12.25 00:00
    expect(isLetterLocked(new Date("2026-12-24T14:59:59Z"))).toBe(true);
    expect(isLetterLocked(new Date("2026-12-24T15:00:00Z"))).toBe(false);
  });
});

describe("validateLetter", () => {
  it("빈 글과 띄어쓰기만 있는 글은 보낼 수 없다", () => {
    expect(validateLetter("")).toBe("empty");
    expect(validateLetter("  \n ")).toBe("empty");
  });
  it("500자까지는 되고 501자는 안 된다", () => {
    expect(validateLetter("가".repeat(LETTER_MAX_LENGTH))).toBe("ok");
    expect(validateLetter("가".repeat(LETTER_MAX_LENGTH + 1))).toBe("tooLong");
  });
  it("이모지는 1자로 센다", () => {
    expect(letterLength("🎄🎁")).toBe(2);
  });
});

describe("letterPreview", () => {
  it("짧은 글은 그대로, 줄바꿈은 띄어쓰기로", () => {
    expect(letterPreview("안녕\n메리 크리스마스")).toBe("안녕 메리 크리스마스");
  });
  it("길면 잘라서 …을 붙인다", () => {
    expect(letterPreview("가".repeat(50), 10)).toBe(`${"가".repeat(10)}…`);
  });
});
