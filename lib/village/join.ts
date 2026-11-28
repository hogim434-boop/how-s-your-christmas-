// 초대 링크로 입주할 때의 "결과 규칙"을 모아 둔 순수 함수 파일입니다. (로드맵 Task 008, F013)
// 실제 입주 처리는 app/invite/[code]/join/route.ts가 하고, 여기서는 "그 결과로 어디로 보낼지"만 정합니다.

/** 입주에 실패한 이유 */
export type JoinError = "invalid_invite" | "couple_full" | "village_full" | "not_signed_in" | "failed";

/** 초대 화면이 주소(?error=)로 받아 보여 줄 수 있는 안내 종류 */
export const INVITE_ERRORS = ["couple_full", "village_full", "failed"] as const;
export type InviteError = (typeof INVITE_ERRORS)[number];

/** 주소로 받은 값이 우리가 아는 안내 종류일 때만 돌려줍니다 (모르는 값은 무시) */
export function parseInviteError(value: unknown): InviteError | undefined {
  return INVITE_ERRORS.find((e) => e === value);
}

/**
 * 데이터베이스가 돌려준 오류 글에서 실패 이유를 알아냅니다.
 * (join_village 함수와 주민 표의 확인 장치가 'invalid_invite', 'couple_full', 'village_full' 같은 글로 알려 줍니다
 *  → supabase/migrations의 02·04·09 파일)
 */
export function parseJoinError(message: string | null | undefined): JoinError {
  const text = message ?? "";
  if (text.includes("invalid_invite")) return "invalid_invite";
  if (text.includes("couple_full")) return "couple_full";
  // 친구 마을이 이미 30명일 때 (09 파일의 주민 확인 장치)
  if (text.includes("village_full")) return "village_full";
  if (text.includes("not_signed_in")) return "not_signed_in";
  return "failed";
}

/**
 * 입주에 성공한 사람을 보낼 주소.
 * - 처음 입주한 사람 → 그 마을 + 캐릭터 꾸미기 창 열기 (?customize=1)
 * - 원래 주민이던 사람 → 바로 그 마을 (집이 늘지 않고, 꾸미기도 다시 묻지 않음)
 */
export function joinDestination(villageId: string, wasResident: boolean): string {
  return wasResident ? `/village/${villageId}` : `/village/${villageId}?customize=1`;
}

/** 입주에 실패한 사람을 보낼 주소 (초대 코드는 이미 안전한 모양인지 확인된 값이어야 합니다) */
export function joinFailureDestination(code: string, error: Exclude<JoinError, "not_signed_in">): string {
  // 없는 초대 코드: 초대 화면이 스스로 "사용할 수 없는 링크" 안내를 보여 줍니다
  if (error === "invalid_invite") return `/invite/${code}`;
  return `/invite/${code}?error=${error}`;
}
