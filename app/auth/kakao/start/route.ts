// 카카오 로그인을 시작하는 주소입니다. 주소: /auth/kakao/start  (11.27, LINE의 /auth/line/start와 같은 구조)
// 로그인 화면의 "카카오로 시작하기" 버튼이 이 주소로 옵니다.
//
// 하는 일
//  1) 위조 방지용 무작위 글자(state)를 만들어 쿠키에 잠깐 맡겨 두고 (lib/auth/lineState.ts의 모양을 함께 씁니다)
//  2) 카카오 로그인 화면으로 보냅니다. 로그인이 끝나면 카카오가 /auth/kakao/callback 으로 돌려보냅니다.

import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, redirectTo } from "@/lib/auth/finish";
import { kakaoApp } from "@/lib/auth/kakaoApi";
import { KAKAO_CALLBACK_PATH, KAKAO_STATE_COOKIE, buildKakaoAuthorizeUrl } from "@/lib/auth/kakaoUrls";
import { LINE_STATE_MAX_AGE, encodeLineState } from "@/lib/auth/lineState";
import { loginUrl, safeInviteCode, safeNextPath } from "@/lib/auth/next";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const invite = safeInviteCode(params.get("invite"));

  const app = kakaoApp();
  if (!app) return redirectTo(request, loginUrl({ next, invite, error: "config" }));

  // randomBytes: 예측할 수 없는 무작위 값 (Math.random은 예측될 수 있어 보안용으로 쓰지 않습니다)
  const state = randomBytes(24).toString("base64url");
  // nonce: 카카오에서는 쓰지 않지만, LINE과 같은 쿠키 모양을 쓰기 위해 채워 둡니다
  const nonce = randomBytes(24).toString("base64url");
  const origin = appOrigin(request);

  const response = NextResponse.redirect(
    buildKakaoAuthorizeUrl({ clientId: app.clientId, redirectUri: `${origin}${KAKAO_CALLBACK_PATH}`, state }),
  );
  response.cookies.set(KAKAO_STATE_COOKIE, encodeLineState({ state, nonce, next, invite }), {
    // httpOnly: 화면의 자바스크립트가 읽을 수 없음 / secure: https에서만 전송 / sameSite lax: 카카오에서 돌아오는 이동에는 함께 전송됨
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/auth/kakao",
    maxAge: LINE_STATE_MAX_AGE,
  });
  return response;
}
