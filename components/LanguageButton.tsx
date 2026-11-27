"use client";

// 화면 언어를 고르는 지구본 버튼입니다. (로그인 화면 오른쪽 위, 11.27 사용자 요청)
// 누르면 언어 목록이 펼쳐지고, 고르면 이 브라우저에 저장되어 로그인 뒤 화면들도 같은 언어로 보입니다.
// 밤하늘 배경 위에 올라가는 모양(반투명 어두운 바탕 + 흰 글자)입니다.
//
// 💡 화면 읽기 도구를 위한 표시
//    - aria-haspopup / aria-expanded: "누르면 목록이 열리는 버튼"이고 지금 열려 있는지 알려 줍니다
//    - role="menu" / "menuitemradio" / aria-checked: "이 중 하나만 고르는 목록"이고 무엇이 골라져 있는지 알려 줍니다

import { useContext, useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { LocaleContext, useMessages } from "@/i18n/LocaleContext";
import { LOCALE_NAMES, type Locale } from "@/i18n/messages";
import { saveLocale } from "@/lib/village/preferences";

/** 고를 수 있는 언어 (목록에 보이는 순서) */
const LOCALES: Locale[] = ["ja", "ko"];

/** 버튼의 바탕: 밤하늘색을 살짝 비치게 (로그인 화면의 안내 상자와 같은 색) */
const GLASS = "rgba(20, 26, 54, 0.6)";
/** 펼친 목록의 바탕: 거의 비치지 않게 합니다. 목록이 로고 글자 위에 겹쳐서, 비치면 언어 이름을 읽기 어렵습니다 */
const MENU_BG = "rgba(20, 26, 54, 0.96)";

export function LanguageButton({ className = "" }: { className?: string }) {
  const t = useMessages();
  const locale = useContext(LocaleContext);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // 목록이 열려 있을 때: 바깥을 누르거나 Esc 키를 누르면 닫습니다
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (next: Locale) => {
    // 저장하면 saveLocale이 "언어가 바뀌었다"는 신호를 보내고, LocaleProvider가 화면을 새 언어로 다시 그립니다
    if (next !== locale) saveLocale(next);
    setOpen(false);
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={t.language}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        // h-11: 손가락으로 누르기 쉬운 높이(44px)
        className="flex h-11 items-center gap-1.5 rounded-full border border-white/25 px-3.5 text-[13px] font-semibold text-white backdrop-blur-md transition hover:border-white/45 active:scale-[0.97]"
        style={{ backgroundColor: GLASS }}
      >
        <Globe className="size-[18px]" aria-hidden="true" />
        {/* 지금 언어 이름은 그 언어의 글꼴로 보이게 lang을 붙입니다 */}
        <span lang={locale}>{LOCALE_NAMES[locale]}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t.language}
          className="absolute right-0 top-full mt-2 min-w-36 overflow-hidden rounded-2xl border border-white/25 py-1 shadow-[0_12px_32px_rgba(5,8,24,0.5)]"
          style={{ backgroundColor: MENU_BG }}
        >
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={l === locale}
              lang={l}
              onClick={() => choose(l)}
              className="flex h-11 w-full items-center justify-between gap-3 px-4 text-left text-sm font-medium text-white transition hover:bg-white/10"
            >
              {LOCALE_NAMES[l]}
              {l === locale && <Check className="size-4" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
