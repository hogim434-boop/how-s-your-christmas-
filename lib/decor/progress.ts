// 진행률과 장식 단계를 계산하는 곳입니다. 계산 규칙은 이 파일 한 곳에만 둡니다.
// 근거: docs/prd.md 핵심 규칙, 가정 1·2·3·4·27, 로드맵 D-03·D-10 [확정 11.25]
//
// 핵심 규칙
// - 친구 마을: 써야 할 편지 = 주민 수 × (주민 수 - 1)
// - 커플 마을: 써야 할 개수 = 10 (질문지 8개 + 편지 2통). 주민이 2명일 때만 계산
// - 장식 단계 = 내림(쓴 개수 × 10 ÷ 써야 할 개수), 최대 10
// - 장식은 "언제나 지금 진행률"을 따릅니다. 친구가 새로 들어오거나 편지가 삭제되면
//   진행률이 내려가고 장식도 그만큼 빠집니다. [확정 11.25]
//
// 💡 왜 소수(0.1667…) 대신 정수 계산을 하나요?
//    컴퓨터는 소수를 정확히 못 다뤄서 1/6 × 6 이 0.9999…가 되는 일이 있습니다.
//    그래서 "곱하기 먼저, 나누기 나중"으로 정수만 써서 오차를 없앱니다.

import type { VillageKind } from "@/types/domain";
import { COUPLE_TOTAL_ITEMS, MAX_DECOR_LEVEL } from "./decorTable";

/**
 * 마을에서 써야 하는 개수(100% 기준)를 구합니다.
 * @param kind 마을 종류
 * @param residentCount 주민 수
 * @returns 써야 할 개수. 계산할 수 없으면(주민이 혼자 등) 0
 */
export function requiredCount(kind: VillageKind, residentCount: number): number {
  if (kind === "couple") {
    // 커플 마을은 둘이 다 있어야 시작합니다 (혼자면 0%)
    return residentCount === 2 ? COUPLE_TOTAL_ITEMS : 0;
  }
  // 친구 마을: 혼자면 쓸 상대가 없으므로 0 (PRD 가정 4)
  if (residentCount < 2) return 0;
  return residentCount * (residentCount - 1);
}

/** 음수·소수 같은 잘못된 값이 들어와도 계산이 깨지지 않게 0 이상의 정수로 맞춥니다 */
function toCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * 지금 장식 단계(0~10)를 구합니다. 저장된 값과 비교하지 않고 언제나 지금 값을 돌려줍니다.
 * @param done 쓴 개수 (친구 마을: 삭제되지 않은 편지 수 / 커플 마을: 질문지 답 수 + 편지 수)
 * @param required requiredCount()로 구한 써야 할 개수
 */
export function computeDecorLevel(done: number, required: number): number {
  const d = toCount(done);
  const r = toCount(required);
  if (r === 0) return 0;
  return Math.min(MAX_DECOR_LEVEL, Math.floor((d * MAX_DECOR_LEVEL) / r));
}

/**
 * 화면에 보여 줄 진행률(%, 0~100 정수). 예: 3명 마을에서 1통 → 16
 * (장식 단계는 10% 단위, 이 값은 게이지에 숫자로 보여 주는 용도)
 */
export function progressPercent(done: number, required: number): number {
  const d = toCount(done);
  const r = toCount(required);
  if (r === 0) return 0;
  return Math.min(100, Math.floor((d * 100) / r));
}

/** 100%(대왕별)인지 */
export function isStarAttached(level: number): boolean {
  return level >= MAX_DECOR_LEVEL;
}

/**
 * "새로운 장식이 달렸어요" 알림을 보낼지 정합니다.
 * 지금까지 가장 높았던 단계(Village.max_decor_level)를 넘었을 때만 보냅니다.
 * 장식이 빠졌다가 같은 단계로 돌아올 때 알림이 반복되지 않게 하기 위해서입니다. (PRD 가정 3)
 */
export function shouldNotifyNewOrnament(currentLevel: number, maxReachedLevel: number): boolean {
  return currentLevel > maxReachedLevel;
}
