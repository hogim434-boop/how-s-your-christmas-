// LINE 로그인을 시작할 때 브라우저에 잠깐 맡겨 두는 값(쿠키)을 다루는 순수 함수입니다. (로드맵 Task 007)
//
// 💡 왜 맡겨 두나요? LINE 화면에 다녀오는 동안 서버는 "누가 로그인을 시작했는지" 기억하지 못합니다.
//    그래서 시작할 때 만든 무작위 글자(state)를 쿠키에 넣어 두고, 돌아왔을 때 LINE이 돌려준 값과 같은지 비교합니다.
//    값이 다르면 다른 사람이 꾸민 가짜 요청일 수 있어 로그인을 거부합니다.

/** 쿠키 이름 */
export const LINE_STATE_COOKIE = "hyc_line_oauth";
/** 쿠키가 살아 있는 시간(초). LINE의 1회용 코드 유효 시간(10분)과 같게 */
export const LINE_STATE_MAX_AGE = 600;

export type LineState = { state: string; nonce: string; next: string | null; invite: string | null };

/** 쿠키에 넣을 글자로 바꾸기 */
export function encodeLineState(value: LineState): string {
  return JSON.stringify(value);
}

/** 쿠키 글자를 다시 값으로. 모양이 맞지 않으면 null */
export function decodeLineState(raw: string | undefined): LineState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { state, nonce, next, invite } = value as Record<string, unknown>;
    if (typeof state !== "string" || state.length < 16 || typeof nonce !== "string" || nonce.length < 16) return null;
    return {
      state,
      nonce,
      next: typeof next === "string" ? next : null,
      invite: typeof invite === "string" ? invite : null,
    };
  } catch {
    return null;
  }
}
