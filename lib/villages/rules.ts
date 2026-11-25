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
