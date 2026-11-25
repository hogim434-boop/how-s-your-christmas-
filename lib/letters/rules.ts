// 편지 규칙을 모아 둔 순수 함수 파일입니다. (F004·F005·F006)
// 💡 순수 함수: 같은 값을 넣으면 언제나 같은 답이 나오는 함수. 화면 없이도 테스트하기 쉽습니다.
//
// 규칙
//  - 편지는 한 통에 최대 500자 (글자 수 제한은 로드맵 D-13에서 확정 전, 임시 값)
//  - 받은 편지는 한국 시간 12월 25일 0시가 되어야 읽을 수 있습니다 (그 전에는 "잠김")
//  - 12월 25일 0시부터는 편지 쓰기·수정·삭제가 끝납니다
// ⚠️ 여기의 잠금 판단은 "화면 표시용"입니다. 진짜 보호는 데이터베이스 규칙(Task 006)에서 합니다.

/** 편지 한 통의 최대 글자 수 (임시, D-13) */
export const LETTER_MAX_LENGTH = 500;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 지금 편지가 잠겨 있는지 알려 줍니다.
 * 한국 시간으로 그해 12월 25일 0시 이전이면 true(잠김), 그 뒤면 false(열림).
 */
export function isLetterLocked(now: Date): boolean {
  // 한국 시간의 "연도"를 얻기 위해 9시간을 더한 뒤 UTC 값으로 읽습니다 (dday.ts와 같은 방식)
  const kstYear = new Date(now.getTime() + KST_OFFSET_MS).getUTCFullYear();
  // 한국 시간 12월 25일 0시 = UTC로는 9시간 전
  const unlockAt = Date.UTC(kstYear, 11, 25) - KST_OFFSET_MS;
  return now.getTime() < unlockAt;
}

/** 글자 수를 셉니다. 이모지(😀)처럼 컴퓨터 안에서는 2칸을 쓰는 글자도 1자로 셉니다 */
export function letterLength(content: string): number {
  return [...content].length;
}

export type LetterCheck = "ok" | "empty" | "tooLong";

/** 보낼 수 있는 편지인지 검사합니다: 빈 글(띄어쓰기만 포함)·500자 초과는 보낼 수 없습니다 */
export function validateLetter(content: string): LetterCheck {
  if (content.trim() === "") return "empty";
  if (letterLength(content) > LETTER_MAX_LENGTH) return "tooLong";
  return "ok";
}

/** 목록에 보여 줄 짧은 미리보기: 줄바꿈을 띄어쓰기로 바꾸고, max자를 넘으면 …으로 줄입니다 */
export function letterPreview(content: string, max = 40): string {
  const chars = [...content.replace(/\s+/g, " ").trim()];
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : chars.join("");
}
