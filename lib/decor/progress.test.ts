// 진행률·장식 규칙 자동 테스트입니다. `npm test` 로 실행합니다.
// 로드맵 Task 003 테스트 체크리스트 + 11.25 결정(장식은 지금 진행률을 따름)을 확인합니다.

import { describe, expect, it } from "vitest";
import { giftLayout, hasDecor, visibleStages } from "./decorTable";
import {
  computeDecorLevel,
  isStarAttached,
  progressPercent,
  requiredCount,
  shouldNotifyNewOrnament,
} from "./progress";

/** 친구 마을: 주민 수와 보낸 편지 수로 지금 장식 단계를 구하는 짧은 도우미 */
const friendsLevel = (residents: number, letters: number) =>
  computeDecorLevel(letters, requiredCount("friends", residents));

describe("써야 할 개수", () => {
  it("친구 마을은 n(n-1)통", () => {
    expect(requiredCount("friends", 2)).toBe(2);
    expect(requiredCount("friends", 3)).toBe(6);
    expect(requiredCount("friends", 4)).toBe(12);
    expect(requiredCount("friends", 5)).toBe(20);
  });

  it("커플 마을은 2명일 때 10개", () => {
    expect(requiredCount("couple", 2)).toBe(10);
  });
});

describe("친구 마을 장식 단계", () => {
  it("주민이 1명이면 0% (써야 할 편지가 없음)", () => {
    expect(requiredCount("friends", 1)).toBe(0);
    expect(friendsLevel(1, 0)).toBe(0);
    expect(progressPercent(0, 0)).toBe(0);
  });

  it("3명이 6통을 다 쓰면 10단계(100%)이고 대왕별이 달림", () => {
    expect(friendsLevel(3, 6)).toBe(10);
    expect(isStarAttached(friendsLevel(3, 6))).toBe(true);
  });

  it("3명이 1통 쓰면 1단계 (16.7%)", () => {
    expect(friendsLevel(3, 1)).toBe(1);
    expect(progressPercent(1, 6)).toBe(16);
  });

  it("편지 1통으로 한 번에 2단계가 오를 수 있음 (3명: 1통 → 2통이면 1 → 3단계)", () => {
    expect(friendsLevel(3, 1)).toBe(1);
    expect(friendsLevel(3, 2)).toBe(3);
  });

  it("[11.25 확정] 3명 100%에서 4번째 친구가 입주하면 6/12 = 50% → 장식이 5단계로 줄어듦", () => {
    expect(friendsLevel(3, 6)).toBe(10);
    expect(friendsLevel(4, 6)).toBe(5);
    expect(progressPercent(6, 12)).toBe(50);
    expect(isStarAttached(friendsLevel(4, 6))).toBe(false);
  });

  it("[11.25 확정] 편지를 삭제하면 장식 단계도 내려감 (3명: 6통 → 5통이면 10 → 8단계)", () => {
    expect(friendsLevel(3, 5)).toBe(8);
  });

  it("친구 마을이 잠시 2명이면 일반 규칙 (1통당 50%)", () => {
    expect(friendsLevel(2, 1)).toBe(5);
    expect(friendsLevel(2, 2)).toBe(10);
  });

  it("잘못된 값(음수·써야 할 것보다 많음)이 와도 0~10 안에 머묾", () => {
    expect(computeDecorLevel(-3, 6)).toBe(0);
    expect(computeDecorLevel(99, 6)).toBe(10);
    expect(progressPercent(99, 6)).toBe(100);
  });
});

describe("커플 마을 장식 단계", () => {
  it("2명이 질문지 8개 + 편지 2통 = 10개를 다 쓰면 10단계", () => {
    expect(computeDecorLevel(10, requiredCount("couple", 2))).toBe(10);
  });

  it("하나 쓸 때마다 1단계(10%)씩 오름", () => {
    expect(computeDecorLevel(3, requiredCount("couple", 2))).toBe(3);
  });

  it("커플 마을에 1명만 있으면 0%", () => {
    expect(requiredCount("couple", 1)).toBe(0);
    expect(computeDecorLevel(4, requiredCount("couple", 1))).toBe(0);
  });
});

describe("새 장식 알림", () => {
  it("지금까지 가장 높았던 단계를 넘을 때만 알림", () => {
    expect(shouldNotifyNewOrnament(3, 2)).toBe(true);
    expect(shouldNotifyNewOrnament(3, 3)).toBe(false);
  });

  it("장식이 빠졌다가(10 → 5) 다시 6단계가 되어도 알림을 다시 보내지 않음", () => {
    const maxReached = 10;
    expect(shouldNotifyNewOrnament(6, maxReached)).toBe(false);
  });
});

describe("장식표와 선물", () => {
  it("지금 단계까지의 장식만 보임 (3단계 → 알전구·방울·트리 전구 줄)", () => {
    expect(visibleStages(3).map((s) => s.key)).toEqual([
      "string_lights",
      "red_bauble",
      "tree_lights",
    ]);
    expect(visibleStages(0)).toEqual([]);
  });

  it("전구 줄은 3단계에 달리고 9단계에 업그레이드됨", () => {
    expect(hasDecor(2, "tree_lights")).toBe(false);
    expect(hasDecor(3, "tree_lights")).toBe(true);
    expect(hasDecor(8, "tree_lights_upgrade")).toBe(false);
    expect(hasDecor(9, "tree_lights_upgrade")).toBe(true);
  });

  it("선물은 단계마다 1개씩 늘고, 4·7·10단계 선물만 위에 쌓음", () => {
    const gifts = giftLayout(10);
    expect(gifts).toHaveLength(10);
    expect(gifts.filter((g) => g.stacked).map((g) => g.level)).toEqual([4, 7, 10]);
    expect(giftLayout(0)).toEqual([]);
  });
});
