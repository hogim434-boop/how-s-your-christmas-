"use client";

// 전체 화면(로그인·마을 만들기·초대 입구)에 "지금 화면 언어"를 나눠 주는 부품입니다.
// 마을 화면의 메뉴에서 고른 언어(이 브라우저에 저장된 값)를 읽어서 같은 언어로 보여 줍니다.
//
// 💡 왜 useSyncExternalStore를 쓰나요?
//    이 화면들은 서버에서 먼저 그려지는데, 서버는 브라우저의 저장 공간을 볼 수 없습니다.
//    그래서 "서버에서는 기본 언어, 브라우저에서는 저장된 언어"를 React가 어긋남 없이 처리하도록
//    서버용 값(getServerSnapshot)과 브라우저용 값(getSnapshot)을 따로 알려 줍니다.

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { LocaleContext } from "@/i18n/LocaleContext";
import { DEFAULT_LOCALE } from "@/i18n/messages";
import { loadLocale } from "@/lib/village/preferences";

// 저장된 언어는 이 화면들에서 바뀌지 않으므로, 바뀜을 지켜볼 것이 없습니다 (빈 함수)
const subscribe = () => () => {};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, loadLocale, () => DEFAULT_LOCALE);

  // 페이지 전체의 언어 표시(<html lang>)도 맞춰 둡니다 (화면 읽기 도구·글꼴 선택에 쓰임)
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
