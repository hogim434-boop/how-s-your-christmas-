// 로그인 닉네임을 "편지에 보이는 이름"으로 다듬는 순수 함수입니다. (로드맵 Task 007)
// 데이터베이스의 이름 칸은 1~50자만 받습니다 (supabase/migrations 01_tables.sql).

/** 이름 최대 길이 (데이터베이스 제약과 같아야 합니다) */
export const MAX_NAME_LENGTH = 50;
/** 닉네임이 비어 있을 때 쓰는 이름 */
export const DEFAULT_NAME = "Friend";

/**
 * 닉네임을 다듬습니다: 앞뒤 공백 제거, 50자까지만, 비어 있으면 기본 이름.
 * 💡 [...text] 로 나누면 이모지 같은 글자도 한 글자로 셉니다. (그냥 자르면 이모지가 반으로 잘려 깨질 수 있습니다)
 */
export function normalizeName(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NAME;
  const trimmed = raw.trim();
  if (trimmed === "") return DEFAULT_NAME;
  const cut = [...trimmed].slice(0, MAX_NAME_LENGTH).join("").trim();
  return cut === "" ? DEFAULT_NAME : cut;
}
