// 카카오 로그인에서 쓰는 주소와 글자 만들기(순수 함수)입니다. (로드맵 Task 007, 11.27 직접 통신 방식으로 변경)
// 공식 안내: https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api
//
// 💡 왜 Supabase의 카카오 로그인을 쓰지 않나요? (11.27 확인)
//    Supabase는 카카오에 "이메일"을 항상 요청하는데, 카카오는 이메일을 "비즈 앱"에만 허락합니다.
//    비즈 앱이 되려면 한국 휴대폰 본인인증이 필요해서, 이메일 없이 닉네임만 받도록 LINE처럼 우리 서버가 직접 통신합니다.

/** 카카오 로그인 화면 주소 */
export const KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";
/** 1회용 코드를 접근 표(토큰)로 바꾸는 창구 */
export const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
/** 접근 표로 "이 사람이 누구인지" 물어보는 창구 */
export const KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me";
/** 우리 앱에서 카카오가 돌려보낼 주소 (카카오 개발자 콘솔의 Redirect URI에 똑같이 등록해야 합니다) */
export const KAKAO_CALLBACK_PATH = "/auth/kakao/callback";
/** 로그인을 시작할 때 브라우저에 잠깐 맡겨 두는 쿠키 이름 (모양은 lineState.ts와 같습니다) */
export const KAKAO_STATE_COOKIE = "hyc_kakao_oauth";

/**
 * 카카오 로그인 화면 주소를 만듭니다.
 * - state: 우리가 만든 무작위 글자. 돌아올 때 같은 값이 와야 "우리가 시작한 로그인"으로 인정합니다 (위조 방지)
 * - scope "profile_nickname": 닉네임만 받습니다 (이메일·프로필 사진은 받지 않음)
 */
export function buildKakaoAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope: "profile_nickname",
  });
  return `${KAKAO_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 카카오 사용자 번호로 만드는 "가짜 이메일 주소"입니다. (LINE의 lineEmail과 같은 이유)
 * Supabase의 로그인 계정은 이메일이 하나 있어야 만들 수 있어서, 실제로는 메일이 가지 않는 주소를 사용자마다 하나씩 만듭니다.
 */
export function kakaoEmail(id: string): string {
  return `kakao_${id}@kakao.hows-your-christmas.invalid`;
}

/**
 * 카카오의 "사용자 정보" 응답에서 사용자 번호와 닉네임을 꺼냅니다. 번호가 없으면 null.
 * 응답 모양: { id: 1234567890, kakao_account: { profile: { nickname: "호" } }, properties: { nickname: "호" } }
 */
export function parseKakaoUser(body: unknown): { id: string; name: string | null } | null {
  if (typeof body !== "object" || body === null) return null;
  const { id, kakao_account: account, properties } = body as {
    id?: unknown;
    kakao_account?: { profile?: { nickname?: unknown } } | null;
    properties?: { nickname?: unknown } | null;
  };
  // 사용자 번호는 숫자로 옵니다. 글자로 와도 숫자로만 이루어져 있으면 받습니다
  const text = typeof id === "number" && Number.isSafeInteger(id) ? String(id) : typeof id === "string" ? id : "";
  if (!/^[0-9]{1,20}$/.test(text)) return null;
  const nickname = account?.profile?.nickname ?? properties?.nickname;
  return { id: text, name: typeof nickname === "string" && nickname.trim() !== "" ? nickname : null };
}
