// D-day 계산 테스트: 한국 시간(KST) 기준 날짜로 센다.
import { describe, expect, it } from "vitest";
import { daysUntilChristmas } from "./dday";

describe("daysUntilChristmas", () => {
  it("12월 1일(KST)은 24일 남음", () => {
    expect(daysUntilChristmas(new Date("2026-12-01T00:00:00+09:00"))).toEqual({ days: 24, isDDay: false });
  });

  it("11월 25일은 30일 남음", () => {
    expect(daysUntilChristmas(new Date("2026-11-25T12:00:00+09:00")).days).toBe(30);
  });

  it("12월 24일 23:59(KST)는 아직 1일 남음", () => {
    expect(daysUntilChristmas(new Date("2026-12-24T23:59:00+09:00"))).toEqual({ days: 1, isDDay: false });
  });

  it("12월 25일 0시(KST)부터 D-Day", () => {
    expect(daysUntilChristmas(new Date("2026-12-25T00:00:00+09:00"))).toEqual({ days: 0, isDDay: true });
  });

  it("12월 25일 이후도 D-Day", () => {
    expect(daysUntilChristmas(new Date("2026-12-27T10:00:00+09:00")).isDDay).toBe(true);
  });

  it("UTC로는 24일이어도 한국 시간으로 25일이면 D-Day", () => {
    expect(daysUntilChristmas(new Date("2026-12-24T15:00:00Z")).isDDay).toBe(true);
  });
});
