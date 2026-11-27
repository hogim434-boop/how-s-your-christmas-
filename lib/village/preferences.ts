// 사용자가 고른 화면 설정(언어·하늘)을 이 브라우저에 기억해 두는 도구입니다.
// localStorage: 브라우저 안의 작은 저장 공간. 새로고침해도 남아 있습니다.
// ⚠️ 개인 정보 보호 모드 등에서는 저장이 막힐 수 있어서, 실패해도 앱이 멈추지 않게 try/catch로 감쌉니다.

import { DEFAULT_LOCALE, type Locale } from "@/i18n/messages";
import { SKY_MODES, type SkyMode } from "./theme";
import { readStorage, writeStorage } from "@/lib/storage";

const LOCALE_KEY = "hyc.locale";
const SKY_KEY = "hyc.sky";
const INTRO_KEY = "hyc.introSeen";
const MENU_HINT_KEY = "hyc.menuHintSeen";

/** 저장해 둔 언어 (없거나 이상한 값이면 기본 언어) */
export function loadLocale(): Locale {
  const v = readStorage(LOCALE_KEY);
  return v === "ja" || v === "ko" ? v : DEFAULT_LOCALE;
}

/**
 * 언어가 바뀌었음을 알리는 신호의 이름.
 * 💡 저장 공간(localStorage)은 값이 바뀌어도 같은 탭에는 알려 주지 않습니다.
 *    그래서 저장할 때 이 신호를 직접 보내, 화면(LocaleProvider)이 바로 새 언어로 다시 그리게 합니다.
 */
export const LOCALE_CHANGE_EVENT = "hyc:locale-change";

export function saveLocale(locale: Locale) {
  writeStorage(LOCALE_KEY, locale);
  // 서버에서 불릴 때는 window가 없으므로 건너뜁니다
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}

/** 저장해 둔 하늘 종류 (없거나 이상한 값이면 아침) */
export function loadSky(): SkyMode {
  const v = readStorage(SKY_KEY);
  return SKY_MODES.includes(v as SkyMode) ? (v as SkyMode) : "day";
}

export function saveSky(sky: SkyMode) {
  writeStorage(SKY_KEY, sky);
}

/** 첫 화면의 "이용 방법" 안내를 이미 봤는지 (이 브라우저 기준) */
export function loadIntroSeen(): boolean {
  return readStorage(INTRO_KEY) === "1";
}

export function saveIntroSeen() {
  writeStorage(INTRO_KEY, "1");
}

/** 메뉴 버튼을 가리키는 안내 말풍선을 이미 봤는지 (이 브라우저 기준, 한 번만 보여 줍니다) */
export function loadMenuHintSeen(): boolean {
  return readStorage(MENU_HINT_KEY) === "1";
}

export function saveMenuHintSeen() {
  writeStorage(MENU_HINT_KEY, "1");
}
