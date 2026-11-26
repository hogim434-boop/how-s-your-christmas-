// 마을에서 쓰는 닉네임의 규칙입니다. (11.27 사용자 요청: 마을에 처음 들어갈 때 닉네임을 따로 정하기)
//
// 💡 닉네임은 마을마다 따로 저장합니다(주민 줄의 nickname 칸). 친구 모임마다 불리는 이름이 다를 수 있어서입니다.
//    정하지 않으면 LINE·카카오의 닉네임이 그대로 보입니다.

/** 닉네임 최대 글자 수. ⚠️ 데이터베이스 제약(06_resident_nickname.sql)과 같아야 합니다 */
export const NICKNAME_MAX = 10;

export type NicknameCheck = "ok" | "empty" | "tooLong";

/** 닉네임 검사: 앞뒤 띄어쓰기를 뺀 뒤 1~10자여야 합니다 (이모지도 한 글자로 셉니다) */
export function validateNickname(nickname: string): NicknameCheck {
  const length = [...nickname.trim()].length;
  if (length === 0) return "empty";
  if (length > NICKNAME_MAX) return "tooLong";
  return "ok";
}

/** 입력칸에 처음 채워 둘 값: 지금 이름을 최대 글자 수까지만 */
export function initialNickname(currentName: string): string {
  return [...currentName.trim()].slice(0, NICKNAME_MAX).join("").trim();
}
