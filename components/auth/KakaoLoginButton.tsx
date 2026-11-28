"use client";

// "카카오로 시작하기" 버튼입니다. (11.27: 휴대폰에서 카카오톡 앱으로 넘어가게 하기)
//
// 💡 왜 따로 만들었나요?
//    예전에는 버튼이 우리 서버 주소(/auth/kakao/start)로 가고, 서버가 카카오 주소로 보냈습니다.
//    이 방식은 휴대폰에서 카카오톡 앱이 열리지 않아 아이디·비밀번호를 직접 쳐야 했습니다.
//    카카오가 주는 스크립트(JavaScript SDK)로 로그인을 시작하면 카카오톡 앱이 열려 입력 없이 끝납니다.
//
// 동작
//  1) 화면이 뜨면 카카오 스크립트를 불러오고, 서버(/auth/kakao/prepare)에서 로그인에 쓸 값(state)을 미리 받아 둡니다
//  2) 버튼을 누르면 그 값으로 스크립트의 로그인 함수를 "누르는 순간 바로" 부릅니다
//     (휴대폰은 사람이 누른 직후에만 다른 앱을 열어 주기 때문에, 눌린 뒤에 서버를 기다리면 앱이 열리지 않을 수 있습니다)
//  3) 준비가 안 됐거나 스크립트가 없으면 예전 방식(/auth/kakao/start)으로 그냥 이동합니다 → 로그인이 막히지는 않습니다
//
// ⚠️ NEXT_PUBLIC_KAKAO_JS_KEY 가 없으면 스크립트를 아예 싣지 않고 예전 방식으로만 동작합니다.

import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Script from "next/script";

/** 카카오 JavaScript 키. 브라우저에서 쓰라고 만든 공개 값입니다 (등록한 사이트 주소에서만 동작) */
const JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
/** 카카오 스크립트 주소와 "내용이 바뀌지 않았는지" 확인하는 값(integrity). 버전을 올릴 때 둘을 함께 바꿉니다 */
const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js";
const SDK_INTEGRITY = "sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy";
/** 준비한 값을 새로 받는 간격. 서버가 값을 10분 동안만 인정하므로(LINE_STATE_MAX_AGE) 그보다 자주 받습니다 */
const REFRESH_MS = 4 * 60 * 1000;

/** 카카오 스크립트가 window에 올려 주는 것 중 우리가 쓰는 부분 */
type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Auth: { authorize: (options: { redirectUri: string; state: string; scope: string }) => void };
};

function kakaoSdk(): KakaoSdk | undefined {
  return (window as unknown as { Kakao?: KakaoSdk }).Kakao;
}

interface KakaoLoginButtonProps {
  /** 주소 뒤에 붙일 값 (?next=...&invite=...). 없으면 빈 글자 */
  query: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function KakaoLoginButton({ query, className, style, children }: KakaoLoginButtonProps) {
  // 예비 길: 서버가 카카오 로그인 화면으로 보내는 예전 방식
  const href = `/auth/kakao/start${query}`;
  // 서버에서 미리 받아 둔 값 (아직 못 받았으면 null)
  const prepared = useRef<{ state: string; redirectUri: string } | null>(null);

  useEffect(() => {
    if (!JS_KEY) return;
    let cancelled = false;
    const prepare = async () => {
      try {
        const response = await fetch(`/auth/kakao/prepare${query}`, { cache: "no-store", credentials: "same-origin" });
        const body: unknown = response.ok ? await response.json() : null;
        const { state, redirectUri } = (body ?? {}) as { state?: unknown; redirectUri?: unknown };
        if (cancelled) return;
        prepared.current = typeof state === "string" && typeof redirectUri === "string" ? { state, redirectUri } : null;
      } catch {
        // 인터넷이 끊겼으면 예비 길을 쓰게 둡니다
        if (!cancelled) prepared.current = null;
      }
    };
    void prepare();
    // 오래 켜 둔 화면에서도 값이 낡지 않게 다시 받습니다. 다른 탭에 갔다 돌아왔을 때도 새로 받습니다
    // (다른 탭에서 로그인 화면을 열면 쿠키가 그쪽 값으로 바뀌기 때문입니다)
    const timer = window.setInterval(prepare, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void prepare();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [query]);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const sdk = JS_KEY ? kakaoSdk() : undefined;
    const ready = prepared.current;
    // 스크립트나 준비한 값이 없으면 아무것도 하지 않습니다 → 링크가 예비 길로 이동합니다
    if (!sdk || !ready || !sdk.isInitialized()) return;
    try {
      // scope "profile_nickname": 닉네임만 받습니다 (서버의 예전 방식과 같은 값)
      sdk.Auth.authorize({ redirectUri: ready.redirectUri, state: ready.state, scope: "profile_nickname" });
      // 스크립트가 로그인을 시작했으니 링크 이동은 막습니다
      e.preventDefault();
    } catch {
      // 스크립트가 실패하면 링크가 예비 길로 이동합니다
    }
  };

  return (
    <>
      {JS_KEY && (
        <Script
          src={SDK_URL}
          integrity={SDK_INTEGRITY}
          crossOrigin="anonymous"
          // onReady: 스크립트가 준비될 때마다 불립니다. 이미 초기화했으면 다시 하지 않습니다
          onReady={() => {
            const sdk = kakaoSdk();
            if (sdk && !sdk.isInitialized()) sdk.init(JS_KEY);
          }}
        />
      )}
      {/* 일반 <a> 태그를 씁니다. Next.js의 <Link>는 주소를 미리 불러오는데, 이 주소는 불러오는 순간 로그인이 시작되기 때문입니다 */}
      <a href={href} onClick={handleClick} className={className} style={style}>
        {children}
      </a>
    </>
  );
}
