// 🔒 카카오 서버와 직접 통신하는 서버 전용 코드입니다. (11.27, lib/auth/line.ts와 같은 구조)
// 공식 안내: https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api
import "server-only";
import { KAKAO_TOKEN_URL, KAKAO_USER_URL, parseKakaoUser } from "./kakaoUrls";

/** 카카오 서버 응답을 기다리는 최대 시간(밀리초) */
const TIMEOUT_MS = 10_000;

/**
 * .env.local의 카카오 앱 값. REST API 키가 없으면 null (부르는 쪽에서 "설정 문제" 안내).
 * - KAKAO_REST_API_KEY: 카카오 콘솔 → 앱 키 → REST API 키
 * - KAKAO_CLIENT_SECRET: 카카오 콘솔 → 카카오 로그인 → 보안 → Client Secret ("사용함"일 때만 필요)
 */
export function kakaoApp(): { clientId: string; clientSecret: string | null } | null {
  const clientId = process.env.KAKAO_REST_API_KEY;
  return clientId ? { clientId, clientSecret: process.env.KAKAO_CLIENT_SECRET || null } : null;
}

/** ② 카카오가 준 1회용 코드를 접근 표(access token)로 바꿉니다 */
export async function exchangeKakaoCode(input: {
  code: string;
  redirectUri: string;
  app: { clientId: string; clientSecret: string | null };
}): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.app.clientId,
    // 로그인을 시작할 때 보낸 주소와 글자 하나까지 같아야 합니다
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  if (input.app.clientSecret) body.set("client_secret", input.app.clientSecret);
  const response = await fetch(KAKAO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as { access_token?: unknown; error_code?: unknown } | null;
  if (!response.ok || typeof result?.access_token !== "string") {
    // error_code(예: KOE320)만 남깁니다. 응답 전체나 비밀 값은 기록하지 않습니다
    const code = typeof result?.error_code === "string" ? result.error_code : "알 수 없음";
    throw new Error(`카카오 토큰 교환 실패 (응답 ${response.status}, ${code})`);
  }
  return result.access_token;
}

/**
 * ③ 접근 표로 카카오에 "이 사람이 누구인지" 물어봅니다.
 * 💡 접근 표는 방금 우리 서버가 카카오에서 직접 받은 것이라(브라우저를 거치지 않음), 이 응답의 사용자 번호를 믿을 수 있습니다.
 */
export async function fetchKakaoUser(accessToken: string): Promise<{ id: string; name: string | null }> {
  const response = await fetch(KAKAO_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const user = response.ok ? parseKakaoUser(await response.json().catch(() => null)) : null;
  if (!user) throw new Error(`카카오 사용자 정보 읽기 실패 (응답 ${response.status})`);
  return user;
}
