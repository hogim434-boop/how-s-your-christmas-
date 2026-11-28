// 마을 목록 창에 보여 줄 "내 마을 목록"을 만드는 규칙입니다. (F017 마을 목록·전환, 로드맵 Task 017)
//
// 데이터베이스(my_villages 함수)는 마을마다 "주민 수"·"정원"·"쓴 개수"만 알려 줍니다.
// 진행률(%)과 장식 단계는 여기서 계산합니다. 계산식은 마을 화면과 같은 것(lib/decor/progress.ts)을 씁니다.

import { computeDecorLevel, progressPercent, requiredCount } from "@/lib/decor/progress";
import type { VillageKind } from "@/types/domain";

/** 데이터베이스가 돌려주는 마을 한 줄 (my_villages 함수의 결과와 같은 모양) */
export type MyVillageRow = {
  id: string;
  name: string;
  /** 'friends' 또는 'couple'. 모르는 값이 오면 친구 마을로 봅니다 */
  kind: string;
  resident_count: number;
  /** 정원(목표 인원). 진행률의 기준 인원 = 정원과 주민 수 중 큰 쪽 */
  capacity: number;
  /** 쓴 개수 (삭제되지 않은 편지 수, 커플 마을이면 질문지 답 수 포함) */
  done_count: number;
  /** 이 마을에서 쓰는 내 이름 */
  my_nickname: string | null;
};

/** 화면에 보여 줄 마을 한 칸 */
export type VillageListItem = {
  id: string;
  name: string;
  kind: VillageKind;
  residentCount: number;
  /** 정원(목표 인원). 주민 수보다 작게 보이지 않도록 맞춘 값 */
  capacity: number;
  /** 진행률 0~100 */
  percent: number;
  /** 장식 단계 0~10 (마을 그림에 씁니다) */
  level: number;
  /** 이 마을에서 쓰는 내 이름 (없으면 빈 글자) */
  myNickname: string;
  /** 지금 보고 있는 마을인지 */
  isCurrent: boolean;
};

/**
 * 받아 온 줄들을 화면용 목록으로 바꿉니다.
 * - 지금 보고 있는 마을을 맨 위에 둡니다. 나머지는 받은 순서(최근에 입주한 순) 그대로입니다.
 * @param currentId 지금 보고 있는 마을 번호 (없으면 null)
 */
export function toVillageList(rows: MyVillageRow[], currentId: string | null): VillageListItem[] {
  const items = rows.map((row): VillageListItem => {
    const kind: VillageKind = row.kind === "couple" ? "couple" : "friends";
    const residentCount = Math.max(0, Math.floor(row.resident_count));
    const required = requiredCount(kind, row.resident_count, row.capacity);
    return {
      id: row.id,
      name: row.name,
      kind,
      residentCount,
      capacity: Math.max(residentCount, Math.floor(row.capacity) || 0),
      percent: progressPercent(row.done_count, required),
      level: computeDecorLevel(row.done_count, required),
      myNickname: row.my_nickname ?? "",
      isCurrent: row.id === currentId,
    };
  });
  // 💡 sort는 같은 값끼리의 순서를 바꾸지 않으므로(안정 정렬), "지금 마을만 앞으로" 옮기고 나머지 순서는 그대로 둡니다
  return items.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
}
