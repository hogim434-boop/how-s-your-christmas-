// LINE 로그인에서 쓰는 주소와 글자 만들기(순수 함수)입니다. (로드맵 Task 007)
// 공식 안내: https://developers.line.biz/en/docs/line-login/integrate-line-login/

/** LINE 로그인 화면 주소 */
export const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
/** 1회용 코드를 확인증(토큰)으로 바꾸는 창구 */
export const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
/** 확인증(ID 토큰)이 진짜인지 검사해 주는 LINE 공식 창구 */
export const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

/** 우리 앱에서 LINE이 돌려보낼 주소 (LINE 개발자 콘솔의 Callback URL에 똑같이 등록해야 합니다) */
export const LINE_CALLBACK_PATH = "/auth/line/callback";

/**
 * LINE 로그인 화면 주소를 만듭니다.
 * - state: 우리가 만든 무작위 글자. 돌아올 때 같은 값이 와야 "우리가 시작한 로그인"으로 인정합니다 (위조 방지)
 * - nonce: 확인증 안에 그대로 담겨 돌아오는 무작위 글자. 남의 확인증을 다시 쓰는 일을 막습니다
 * - scope "profile openid": 닉네임과 사용자 번호만 받습니다 (이메일은 받지 않음)
 */
export function buildLineAuthorizeUrl(input: { channelId: string; redirectUri: string; state: string; nonce: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.channelId,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope: "profile openid",
    nonce: input.nonce,
  });
  return `${LINE_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * LINE 사용자 번호로 만드는 "가짜 이메일 주소"입니다.
 * 💡 Supabase의 로그인 계정은 이메일(또는 전화번호)이 하나 있어야 만들 수 있는데, LINE에서는 이메일을 받지 않습니다.
 *    그래서 실제로는 메일이 가지 않는 주소(.invalid는 "존재하지 않는 주소"로 약속된 끝자리)를 사용자마다 하나씩 만듭니다.
 */
export function lineEmail(sub: string): string {
  return `line_${sub.toLowerCase()}@line.hows-your-christmas.invalid`;
}

/** LINE 사용자 번호처럼 생겼는지 (영문·숫자만, 너무 길지 않게) */
export function isLineUserId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9]{8,64}$/.test(value);
}
