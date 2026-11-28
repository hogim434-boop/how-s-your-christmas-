// 카카오 로그인을 "준비만" 하는 주소입니다. 주소: /auth/kakao/prepare  (11.27)
//
// 💡 왜 필요한가요?
//    /auth/kakao/start 처럼 서버가 카카오 주소로 바로 보내면, 휴대폰에서 카카오톡 앱이 열리지 않고
//    아이디·비밀번호 입력 화면이 나옵니다. 카카오톡 앱으로 넘어가게 하려면 카카오가 주는 스크립트(JavaScript SDK)가
//    화면에서 직접 로그인을 시작해야 합니다. 그 스크립트에 넘겨 줄 값(state, 돌아올 주소)을 여기서 만듭니다.
//
// 하는 일: 위조 방지용 무작위 글자(state)를 만들어 쿠키에 맡겨 두고, 같은 글자를 화면에 돌려줍니다.
// 로그인이 끝난 뒤의 처리(/auth/kakao/callback)는 start로 시작했을 때와 똑같습니다.

import { NextResponse, type NextRequest } from "next/server";
import { kakaoApp } from "@/lib/auth/kakaoApi";
import { prepareKakaoStart } from "@/lib/auth/kakaoStart";
import { safeInviteCode, safeNextPath } from "@/lib/auth/next";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // 설정이 빠져 있으면 준비하지 않습니다 → 화면은 예비 길(/auth/kakao/start)로 가서 "설정 문제" 안내를 보게 됩니다
  if (!kakaoApp()) return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });

  const start = prepareKakaoStart(request, {
    next: safeNextPath(params.get("next")),
    invite: safeInviteCode(params.get("invite")),
  });
  // no-store: 이 답은 사람마다·매번 달라야 하므로 어디에도 저장해 두지 않게 합니다
  const response = NextResponse.json(
    { ok: true, state: start.state, redirectUri: start.redirectUri },
    { headers: { "Cache-Control": "no-store" } },
  );
  start.attachCookie(response);
  return response;
}
