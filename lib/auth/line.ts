// 🔒 LINE 서버와 직접 통신하는 서버 전용 코드입니다. (로드맵 Task 007, PRD 기술 메모 "로그인")
//
// 💡 왜 직접 하나요? Supabase가 LINE의 확인증 방식(HS256)을 받아 주지 않아서(11.25 확인),
//    우리 서버가 LINE과 통신해 "이 사람이 진짜 LINE 사용자"임을 확인한 뒤 Supabase 로그인 상태를 만들어 줍니다.
// 공식 안내: https://developers.line.biz/en/reference/line-login/

import "server-only";
import { LINE_TOKEN_URL, LINE_VERIFY_URL, isLineUserId } from "./lineUrls";

/** LINE 서버 응답을 기다리는 최대 시간(밀리초) */
const TIMEOUT_MS = 10_000;

/** .env.local의 LINE 채널 값. 없으면 null (부르는 쪽에서 "설정 문제" 안내) */
export function lineChannel(): { id: string; secret: string } | null {
  const id = process.env.LINE_CHANNEL_ID;
  const secret = process.env.LINE_CHANNEL_SECRET;
  return id && secret ? { id, secret } : null;
}

/** ② LINE이 준 1회용 코드를 확인증(ID 토큰)으로 바꿉니다 */
export async function exchangeLineCode(input: { code: string; redirectUri: string; channel: { id: string; secret: string } }): Promise<string> {
  const response = await fetch(LINE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      // 로그인을 시작할 때 보낸 주소와 글자 하나까지 같아야 합니다
      redirect_uri: input.redirectUri,
      client_id: input.channel.id,
      client_secret: input.channel.secret,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  const idToken = (body as { id_token?: unknown } | null)?.id_token;
  if (!response.ok || typeof idToken !== "string") {
    throw new Error(`LINE 토큰 교환 실패 (응답 ${response.status})`);
  }
  return idToken;
}

/**
 * ③ 확인증이 진짜인지 LINE 공식 검사 창구에 물어봅니다.
 * LINE이 발급처·받는 앱(우리 채널)·유효 기간·nonce를 검사하고, 맞으면 사용자 번호(sub)와 닉네임(name)을 알려 줍니다.
 */
export async function verifyLineIdToken(input: { idToken: string; nonce: string; channelId: string }): Promise<{ sub: string; name: string | null }> {
  const response = await fetch(LINE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: input.idToken, client_id: input.channelId, nonce: input.nonce }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as { sub?: unknown; name?: unknown; aud?: unknown; nonce?: unknown } | null;
  if (!response.ok || !body || !isLineUserId(body.sub)) {
    throw new Error(`LINE 확인증 검사 실패 (응답 ${response.status})`);
  }
  // LINE이 이미 검사해 주지만, 받는 앱과 nonce는 한 번 더 확인합니다 (이중 확인)
  if (body.aud !== input.channelId || body.nonce !== input.nonce) {
    throw new Error("LINE 확인증이 이 로그인에 맞지 않습니다");
  }
  return { sub: body.sub, name: typeof body.name === "string" ? body.name : null };
}
