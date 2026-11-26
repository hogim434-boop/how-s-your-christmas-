// 편지를 저장하다 실패했을 때, 데이터베이스가 돌려준 오류를 "화면이 안내할 이유"로 바꾸는 순수 함수입니다. (로드맵 Task 009)

/**
 * 실패 이유
 * - closed: 편지 보내기가 끝남 (12.25 이후)
 * - duplicate: 그 사람에게 이미 보낸 편지가 있음 (다른 기기에서 먼저 보낸 경우)
 * - not_resident: 보내는 사람이나 받는 사람이 이 마을 주민이 아님
 * - not_found: 그 편지가 없음 (이미 지웠거나 내 편지가 아님)
 * - failed: 그 밖의 실패 (통신 문제 등)
 */
export type LetterError = "closed" | "duplicate" | "not_resident" | "not_found" | "failed";

/**
 * 💡 데이터베이스 오류에는 숫자·글자로 된 "코드"와 사람이 읽는 "글"이 함께 옵니다.
 *    - 42501: 보안 규칙(RLS)이 거절함 → 편지 쓰기에서는 "잠금 시각이 지났다"는 뜻입니다
 *      (내 이름으로, 내 마을에만 쓰는 화면이라 다른 이유로 거절될 일이 없습니다)
 *    - 23505: "한 사람에게 한 통" 규칙에 걸림
 *    - 글에 closed / not_resident / not_found: 우리 함수·트리거가 직접 알려 준 이유 (supabase/migrations 02·04 파일)
 */
export function parseLetterError(error: { code?: string | null; message?: string | null } | null | undefined): LetterError {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (message.includes("closed") || code === "42501") return "closed";
  if (code === "23505") return "duplicate";
  if (message.includes("not_resident")) return "not_resident";
  if (message.includes("not_found")) return "not_found";
  return "failed";
}
