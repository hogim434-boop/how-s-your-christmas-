"use client";

// ☰ 메뉴 창: 하늘(아침·밤) 고르기, 언어 고르기(日本語/한국어), 로그아웃(지금은 안내 메시지만), "앱 출시 coming soon" 안내.
// 겹쳐 뜨는 창 뼈대는 components/overlay/Overlay.tsx를 그대로 씁니다.

import { Languages, LogOut, Moon, Sun } from "lucide-react";
import Overlay from "@/components/overlay/Overlay";
import { LOCALE_NAMES, type Locale } from "@/i18n/messages";
import { SKY_MODES, UI_COLORS, type SkyMode } from "@/lib/village/theme";

interface MenuSheetProps {
  open: boolean;
  labels: {
    title: string;
    skyMode: string;
    skyNames: Record<SkyMode, string>;
    language: string;
    logout: string;
    comingSoon: string;
  };
  /** 지금 하늘 (아침 / 밤) */
  sky: SkyMode;
  onSkyChange: (sky: SkyMode) => void;
  /** 지금 화면 언어 */
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onClose: () => void;
  onLogout: () => void;
}

const LOCALES: Locale[] = ["ja", "ko"];

/** 하늘 버튼 아이콘: 아침 해 / 지는 해 / 달 */
const SKY_ICONS = { day: Sun, night: Moon } as const;

export function MenuSheet({
  open,
  labels,
  sky,
  onSkyChange,
  locale,
  onLocaleChange,
  onClose,
  onLogout,
}: MenuSheetProps) {
  return (
    <Overlay open={open} onClose={onClose} title={labels.title}>
      <div className="flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
        {/* 하늘: 아침 / 밤 중 하나를 고르는 버튼 묶음 */}
        <div
          className="flex flex-col gap-2 rounded-2xl px-4 py-3 text-base"
          style={{ backgroundColor: UI_COLORS.cream, color: UI_COLORS.navy }}
        >
          <span className="flex items-center gap-3">
            <Moon className="size-5" aria-hidden="true" />
            {labels.skyMode}
          </span>
          <div role="radiogroup" aria-label={labels.skyMode} className="grid grid-cols-2 rounded-full bg-white p-1 shadow-inner">
            {SKY_MODES.map((mode) => {
              const selected = mode === sky;
              const Icon = SKY_ICONS[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSkyChange(mode)}
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-full text-sm transition-colors"
                  style={selected ? { backgroundColor: UI_COLORS.navy, color: UI_COLORS.cream } : undefined}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {labels.skyNames[mode]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 언어: 두 칸 중 하나를 고르는 버튼 묶음 */}
        <div
          className="flex h-14 w-full items-center gap-3 rounded-2xl px-4 text-base"
          style={{ backgroundColor: UI_COLORS.cream, color: UI_COLORS.navy }}
        >
          <Languages className="size-5" aria-hidden="true" />
          <span className="flex-1">{labels.language}</span>
          <div role="radiogroup" aria-label={labels.language} className="flex rounded-full bg-white p-1 shadow-inner">
            {LOCALES.map((l) => {
              const selected = l === locale;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onLocaleChange(l)}
                  // 각 언어 이름은 그 언어의 글꼴로 보이게 lang을 붙입니다
                  lang={l}
                  className="min-h-9 rounded-full px-3 text-sm transition-colors"
                  style={selected ? { backgroundColor: UI_COLORS.navy, color: UI_COLORS.cream } : undefined}
                >
                  {LOCALE_NAMES[l]}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold"
          style={{ backgroundColor: UI_COLORS.cream, color: UI_COLORS.navy }}
        >
          <LogOut className="size-5" aria-hidden="true" />
          {labels.logout}
        </button>
        <p className="text-center text-sm text-slate-500">{labels.comingSoon}</p>
      </div>
    </Overlay>
  );
}
