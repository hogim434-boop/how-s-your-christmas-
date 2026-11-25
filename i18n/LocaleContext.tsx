"use client";

// 지금 화면 언어를 화면 곳곳에 나눠 주는 "통로(context)"입니다.
// 💡 context란? 위쪽 부품(VillageView)이 정한 값을, 중간 부품을 거치지 않고 아래쪽 부품(Overlay 등)이
//    바로 꺼내 쓸 수 있게 하는 React 기능입니다. 언어를 바꾸면 이 값을 쓰는 곳이 모두 다시 그려집니다.

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, getMessages, type Locale } from "./messages";

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** 지금 언어의 문구 묶음을 꺼냅니다. (통로가 없으면 기본 언어) */
export function useMessages() {
  return getMessages(useContext(LocaleContext));
}
