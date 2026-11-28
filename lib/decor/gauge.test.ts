// 진행률 게이지 창의 줄 계산 테스트입니다. `npm test` 로 실행합니다. (로드맵 Task 016 체크리스트: 달성/미달성 표시가 진행률과 일치)

import { describe, expect, it } from "vitest";
import { DECOR_STAGES } from "./decorTable";
import { gaugeRows, isReached } from "./gauge";

/** 달성한 줄의 수 */
const reachedCount = (level: number) => gaugeRows(level).filter((row) => row.reached).length;

describe("게이지 줄", () => {
  it("언제나 10줄이고 순서·장식 종류가 장식표와 같다", () => {
    const rows = gaugeRows(4);
    expect(rows).toHaveLength(10);
    expect(rows.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(rows.map((r) => r.percent)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(rows.map((r) => r.key)).toEqual(DECOR_STAGES.map((s) => s.key));
  });

  it("지금 단계까지만 달성으로 표시한다", () => {
    expect(reachedCount(0)).toBe(0);
    expect(reachedCount(4)).toBe(4);
    expect(reachedCount(10)).toBe(10);
    const rows = gaugeRows(4);
    expect(rows[3].reached).toBe(true); // 40%
    expect(rows[4].reached).toBe(false); // 50%
  });

  it("여러 단계가 한 번에 올라도(2 → 7) 표시가 정확하다", () => {
    expect(reachedCount(2)).toBe(2);
    expect(reachedCount(7)).toBe(7);
  });

  it("단계가 내려가면 달성 표시도 줄어든다", () => {
    expect(reachedCount(6)).toBe(6);
    expect(reachedCount(5)).toBe(5);
  });

  it("이상한 값은 안전하게 다룬다", () => {
    expect(reachedCount(-3)).toBe(0);
    expect(reachedCount(99)).toBe(10);
    expect(reachedCount(Number.NaN)).toBe(0);
    expect(reachedCount(4.7)).toBe(4);
  });
});

describe("달성 여부", () => {
  it("지금 단계 이하의 단계만 달성", () => {
    expect(isReached(4, 4)).toBe(true);
    expect(isReached(4, 5)).toBe(false);
    expect(isReached(4, 0)).toBe(false);
  });
});
