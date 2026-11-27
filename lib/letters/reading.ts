// 받은 편지를 "읽었는지"에 관한 규칙을 모아 둔 순수 함수 파일입니다. (F005 편지 확인하기, 로드맵 Task 015)
// 💡 순수 함수: 같은 값을 넣으면 언제나 같은 답이 나오는 함수. 화면 없이도 테스트하기 쉽습니다.
//
// 규칙
//  - 잠긴 편지(내용이 null)는 읽을 수 없으므로 "안 읽은 편지"로 세지 않습니다
//  - 잠금이 풀렸는데 한 번도 열지 않은 편지(openedAt이 null)가 "안 읽은 편지"입니다
//  - 처음 연 시각은 한 번 적히면 바뀌지 않습니다 (데이터베이스 함수 mark_letter_opened와 같은 규칙)

import type { ReceivedLetter } from "./types";

/** 읽을 수 있는데 아직 한 번도 열지 않은 편지인지 */
export function isUnread(letter: ReceivedLetter): boolean {
  return letter.content !== null && letter.openedAt === null;
}

/** 안 읽은 편지가 몇 통인지 */
export function unreadCount(list: ReceivedLetter[]): number {
  return list.filter(isUnread).length;
}

/**
 * 편지 한 통을 "열어 봤음"으로 바꾼 새 목록을 돌려줍니다 (원래 목록은 그대로 둠).
 * 이미 열어 본 편지·잠긴 편지·없는 편지면 아무것도 바꾸지 않습니다.
 */
export function markOpenedInList(list: ReceivedLetter[], letterId: string, at: string): ReceivedLetter[] {
  return list.map((l) => (l.id === letterId && isUnread(l) ? { ...l, openedAt: at } : l));
}
