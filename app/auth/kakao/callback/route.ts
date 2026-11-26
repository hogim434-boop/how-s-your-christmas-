// 카카오 로그인을 마치고 돌아오는 주소입니다. 주소: /auth/kakao/callback  (11.27)
// ⚠️ 카카오 개발자 콘솔의 Redirect URI에 이 주소(예: https://우리앱.vercel.app/auth/kakao/callback)가 등록돼 있어야 합니다.
//
// 흐름 (LINE의 /auth/line/callback과 같습니다)
//  ① 시작할 때 쿠키에 맡겨 둔 state와 카카오가 돌려준 state가 같은지 확인 (위조 방지)
//  ② 1회용 코드 → 접근 표                               (lib/auth/kakaoApi.ts)
//  ③ 접근 표로 사용자 번호·닉네임 읽기
//  ④ Supabase 계정 찾기·만들기 + 로그인 상태(쿠키) 만들기  (lib/auth/lineSession.ts)
//  ⑤ 알맞은 화면으로 보내기

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { appOrigin, destinationAfterLogin, redirectTo } from "@/lib/auth/finish";
import { exchangeKakaoCode, fetchKakaoUser, kakaoApp } from "@/lib/auth/kakaoApi";
import { KAKAO_CALLBACK_PATH, KAKAO_STATE_COOKIE } from "@/lib/auth/kakaoUrls";
import { signInKakaoUser } from "@/lib/auth/lineSession";
import { decodeLineState } from "@/lib/auth/lineState";
import { loginUrl, type AuthError } from "@/lib/auth/next";
import { createClient } from "@/lib/supabase/server";

/** 두 글자가 같은지 비교합니다. 걸리는 시간으로 값을 짐작할 수 없게 하는 비교 방법을 씁니다 */
function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const saved = decodeLineState(request.cookies.get(KAKAO_STATE_COOKIE)?.value);
  const from = { next: saved?.next ?? null, invite: saved?.invite ?? null };

  // 어떤 결과든 맡겨 둔 쿠키는 지웁니다 (한 번만 쓰는 값)
  const done = (path: string) => {
    const response = redirectTo(request, path);
    response.cookies.set(KAKAO_STATE_COOKIE, "", { path: "/auth/kakao", maxAge: 0 });
    return response;
  };
  const fail = (error: AuthError) => done(loginUrl({ ...from, error }));

  // 카카오 동의 화면에서 "취소"를 누르면 error=access_denied 로 돌아옵니다
  const oauthError = params.get("error");
  if (oauthError) return fail(oauthError === "access_denied" ? "cancelled" : "failed");

  // ① state 확인
  const state = params.get("state");
  if (!saved || !state || !sameText(state, saved.state)) return fail("state_mismatch");

  const code = params.get("code");
  if (!code) return fail("failed");
  const app = kakaoApp();
  if (!app) return fail("config");

  try {
    // ②③ 카카오와 통신
    const accessToken = await exchangeKakaoCode({ code, redirectUri: `${appOrigin(request)}${KAKAO_CALLBACK_PATH}`, app });
    const profile = await fetchKakaoUser(accessToken);
    // ④ Supabase 로그인 상태 만들기
    const supabase = await createClient();
    const userId = await signInKakaoUser(supabase, profile);
    // ⑤ 이동
    return done(await destinationAfterLogin(supabase, userId, from));
  } catch (cause) {
    console.error("[auth/kakao/callback] 카카오 로그인 처리 실패", cause);
    return fail("failed");
  }
}
