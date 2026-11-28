// 마을 만들기 규칙입니다. (F011)

import type { VillageKind } from "@/types/domain";

/** 모임(마을) 이름의 최대 글자 수 (PRD: "개발 시 정함" → 20자로 정함) */
export const VILLAGE_NAME_MAX = 20;

/**
 * 마을 만들기 화면에 "커플 마을" 선택지를 보일지 정하는 스위치입니다.
 * 커플 규칙(질문지, Task 018)이 준비되지 않으면 false로 바꿔 숨깁니다. (로드맵 D-03)
 */
export const SHOW_COUPLE_OPTION = true;

/** 고를 수 있는 마을 종류 목록 (스위치가 꺼져 있으면 친구 마을만) */
export function availableVillageKinds(showCouple: boolean = SHOW_COUPLE_OPTION): VillageKind[] {
  return showCouple ? ["friends", "couple"] : ["friends"];
}

export type VillageNameCheck = "ok" | "empty" | "tooLong";

/** 마을 이름 검사: 앞뒤 띄어쓰기를 뺀 뒤 1~20자여야 합니다 */
export function validateVillageName(name: string): VillageNameCheck {
  const length = [...name.trim()].length;
  if (length === 0) return "empty";
  if (length > VILLAGE_NAME_MAX) return "tooLong";
  return "ok";
}

/**
 * 친구 마을의 정원(목표 인원) 범위입니다. [확정 11.28]
 * - 정원은 진행률의 기준 인원입니다 (써야 할 편지 = 정원 × (정원 - 1)). 계산식은 lib/decor/progress.ts
 * - 가장 작은 값이 3인 이유: 2명이면 편지 한 통에 50%가 되어 정원을 두는 의미가 없기 때문입니다
 * ⚠️ 데이터베이스 쪽 값: supabase/migrations의 09 파일(create_village, residents_before_insert). 바꿀 때 함께 고칩니다
 */
export const VILLAGE_CAPACITY_MIN = 3;
export const VILLAGE_CAPACITY_MAX = 30;

/** 정원 검사: 3~30 사이의 정수여야 합니다 (아직 고르지 않았으면 null) */
export function validateCapacity(capacity: number | null): boolean {
  return capacity !== null && Number.isInteger(capacity) && capacity >= VILLAGE_CAPACITY_MIN && capacity <= VILLAGE_CAPACITY_MAX;
}

/** 입력값을 정원 범위 안으로 맞춥니다 (2 → 3, 99 → 30) */
export function clampCapacity(value: number): number {
  if (!Number.isFinite(value)) return VILLAGE_CAPACITY_MIN;
  return Math.min(VILLAGE_CAPACITY_MAX, Math.max(VILLAGE_CAPACITY_MIN, Math.floor(value)));
}
