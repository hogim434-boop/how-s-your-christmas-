// 카카오 로그인을 "시작할 준비"를 하는 곳입니다. 두 시작 주소가 함께 씁니다. (11.27)
//  - /auth/kakao/start   : 준비한 뒤 카카오 로그인 화면으로 바로 보냅니다 (아이디·비밀번호 화면이 나오는 방식)
//  - /auth/kakao/prepare : 준비만 하고 값을 돌려줍니다. 화면의 카카오 스크립트가 그 값으로 카카오톡 앱을 엽니다
//
// 준비 = 위조 방지용 무작위 글자(state)를 만들어 쿠키에 잠깐 맡겨 두는 일.
// 로그인이 끝나 /auth/kakao/callback 으로 돌아올 때 같은 글자가 와야 "우리가 시작한 로그인"으로 인정합니다.

import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { appOrigin } from "@/lib/auth/finish";
import { KAKAO_CALLBACK_PATH, KAKAO_STATE_COOKIE } from "@/lib/auth/kakaoUrls";
import { LINE_STATE_MAX_AGE, encodeLineState } from "@/lib/auth/lineState";

export type KakaoStart = {
  /** 위조 방지용 무작위 글자 */
  state: string;
  /** 카카오가 로그인 뒤 돌려보낼 우리 주소 */
  redirectUri: string;
  /** 응답에 "state를 맡겨 두는 쿠키"를 붙입니다 */
  attachCookie: (response: NextResponse) => void;
};

export function prepareKakaoStart(request: Request, target: { next: string | null; invite: string | null }): KakaoStart {
  // randomBytes: 예측할 수 없는 무작위 값 (Math.random은 예측될 수 있어 보안용으로 쓰지 않습니다)
  const state = randomBytes(24).toString("base64url");
  // nonce: 카카오에서는 쓰지 않지만, LINE과 같은 쿠키 모양을 쓰기 위해 채워 둡니다
  const nonce = randomBytes(24).toString("base64url");
  const origin = appOrigin(request);
  return {
    state,
    redirectUri: `${origin}${KAKAO_CALLBACK_PATH}`,
    attachCookie: (response) => {
      response.cookies.set(KAKAO_STATE_COOKIE, encodeLineState({ state, nonce, next: target.next, invite: target.invite }), {
        // httpOnly: 화면의 자바스크립트가 읽을 수 없음 / secure: https에서만 전송 / sameSite lax: 카카오에서 돌아오는 이동에는 함께 전송됨
        httpOnly: true,
        secure: origin.startsWith("https://"),
        sameSite: "lax",
        path: "/auth/kakao",
        maxAge: LINE_STATE_MAX_AGE,
      });
    },
  };
}
