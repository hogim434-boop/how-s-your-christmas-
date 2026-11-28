// 연습용 마을(/village/demo)에서 마을 목록 창을 확인하기 위한 "가짜 마을 목록"입니다. (로드맵 Task 017)
// 이름은 화면 문구가 아니라 "데이터"라서 여기에 그대로 둡니다.

import type { MyVillageRow } from "@/lib/villages/list";

/**
 * 가짜 목록을 만듭니다. 첫 줄은 지금 보고 있는 연습용 마을이고, 나머지는 여러 모습을 보기 위한 예시입니다.
 * (100% 달성한 커플 마을, 이름이 20자로 가장 길고 정원이 덜 찬 마을, 혼자뿐인 새 마을)
 */
export function dummyVillageRows(current: { id: string; name: string; residentCount: number; doneCount: number }): MyVillageRow[] {
  return [
    { id: current.id, name: current.name, kind: "friends", resident_count: current.residentCount, capacity: current.residentCount, done_count: current.doneCount, my_nickname: "ゆうき" },
    { id: "demo-couple", name: "ふたりの村", kind: "couple", resident_count: 2, capacity: 2, done_count: 10, my_nickname: "ゆう" },
    { id: "demo-long", name: "스무 글자짜리 아주 아주 긴 마을이름", kind: "friends", resident_count: 5, capacity: 8, done_count: 12, my_nickname: "하은" },
    { id: "demo-new", name: "새 마을", kind: "friends", resident_count: 1, capacity: 6, done_count: 0, my_nickname: "김호" },
  ];
}
