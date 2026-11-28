// 카카오 로그인을 시작하는 주소입니다. 주소: /auth/kakao/start  (11.27, LINE의 /auth/line/start와 같은 구조)
// 로그인 화면의 "카카오로 시작하기" 버튼이 이 주소로 옵니다.
// (카카오 스크립트를 쓸 수 있을 때는 버튼이 /auth/kakao/prepare 쪽을 써서 카카오톡 앱을 엽니다.
//  이 주소는 스크립트를 못 쓸 때의 예비 길입니다 → components/auth/KakaoLoginButton.tsx)
//
// 하는 일
//  1) 위조 방지용 무작위 글자(state)를 만들어 쿠키에 잠깐 맡겨 두고 (lib/auth/kakaoStart.ts)
//  2) 카카오 로그인 화면으로 보냅니다. 로그인이 끝나면 카카오가 /auth/kakao/callback 으로 돌려보냅니다.

import { NextResponse, type NextRequest } from "next/server";
import { redirectTo } from "@/lib/auth/finish";
import { kakaoApp } from "@/lib/auth/kakaoApi";
import { prepareKakaoStart } from "@/lib/auth/kakaoStart";
import { buildKakaoAuthorizeUrl } from "@/lib/auth/kakaoUrls";
import { loginUrl, safeInviteCode, safeNextPath } from "@/lib/auth/next";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const invite = safeInviteCode(params.get("invite"));

  const app = kakaoApp();
  if (!app) return redirectTo(request, loginUrl({ next, invite, error: "config" }));

  const start = prepareKakaoStart(request, { next, invite });
  const response = NextResponse.redirect(
    buildKakaoAuthorizeUrl({ clientId: app.clientId, redirectUri: start.redirectUri, state: start.state }),
  );
  start.attachCookie(response);
  return response;
}
