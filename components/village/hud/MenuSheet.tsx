"use client";

// 메뉴 창: 마을 화면의 기능을 한곳에 모아 둔 창입니다.
// 11.26 사용자 요청: 화면 위에 흩어져 있던 버튼(편지함·꾸미기·초대)을 여기로 옮겼습니다.
//   1) 맨 위: 자주 쓰는 기능 3개 (아이콘 타일). 트리 전체 보기는 화면 왼쪽 아래 버튼으로 따로 있습니다
//   2) 가운데: 설정 (하늘 아침/밤, 언어)
//   3) 아래: 로그아웃(지금은 안내 메시지만), "앱 출시 coming soon" 안내
// 겹쳐 뜨는 창 뼈대는 components/overlay/Overlay.tsx를 그대로 씁니다.

import { ChevronRight, CircleHelp, CircleUserRound, Languages, Link2, LogOut, Mail, Moon, Shirt, Sun, SunMoon, type LucideIcon } from "lucide-react";
import Overlay from "@/components/overlay/Overlay";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LOCALE_NAMES, type Locale } from "@/i18n/messages";
import { SKY_MODES, UI_COLORS, type SkyMode } from "@/lib/village/theme";

interface MenuSheetProps {
  open: boolean;
  labels: {
    title: string;
    letterbox: string;
    customize: string;
    nickname: string;
    invite: string;
    skyMode: string;
    skyNames: Record<SkyMode, string>;
    language: string;
    howTo: string;
    logout: string;
    comingSoon: string;
  };
  onOpenLetterbox: () => void;
  onOpenCustomize: () => void;
  onCopyInvite: () => void;
  /** "이용 방법" 안내 창 열기 */
  onOpenHowTo: () => void;
  /** 닉네임 바꾸기 창 열기. 없으면 줄을 숨깁니다 (연습용 마을) */
  onOpenNickname?: () => void;
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

/** 하늘 버튼 아이콘: 아침 해 / 달 */
const SKY_ICONS = { day: Sun, night: Moon } as const;

/** 기능 타일 하나: 둥근 네모 안의 아이콘 + 아래 이름 */
function ActionTile({ icon: Icon, label, tint, onClick }: { icon: LucideIcon; label: string; tint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex min-w-0 flex-col items-center gap-2 py-1">
      <span
        className="flex size-14 items-center justify-center rounded-[20px] transition group-active:scale-90"
        style={{ backgroundColor: `${tint}1a`, color: tint }}
      >
        <Icon className="size-6" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="w-full truncate text-center text-xs font-semibold">{label}</span>
    </button>
  );
}

export function MenuSheet({
  open,
  labels,
  onOpenLetterbox,
  onOpenCustomize,
  onCopyInvite,
  onOpenHowTo,
  onOpenNickname,
  sky,
  onSkyChange,
  locale,
  onLocaleChange,
  onClose,
  onLogout,
}: MenuSheetProps) {
  return (
    <Overlay open={open} onClose={onClose} title={labels.title}>
      <div className="flex flex-col gap-4">
        {/* 1) 자주 쓰는 기능 */}
        <div className="grid grid-cols-3 gap-1">
          <ActionTile icon={Mail} label={labels.letterbox} tint={UI_COLORS.accent} onClick={onOpenLetterbox} />
          <ActionTile icon={Shirt} label={labels.customize} tint="#3b6fd4" onClick={onOpenCustomize} />
          <ActionTile icon={Link2} label={labels.invite} tint="#c07a12" onClick={onCopyInvite} />
        </div>

        {/* 2) 설정: 한 카드 안에 줄로 나눠 담습니다 */}
        <div className="flex flex-col rounded-2xl" style={{ backgroundColor: UI_COLORS.surface }}>
          <div className="flex min-h-14 items-center gap-3 px-4">
            <SunMoon className="size-5 shrink-0" style={{ color: UI_COLORS.muted }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{labels.skyMode}</span>
            <SegmentedControl
              compact
              ariaLabel={labels.skyMode}
              value={sky}
              onChange={onSkyChange}
              options={SKY_MODES.map((mode) => {
                const Icon = SKY_ICONS[mode];
                return { value: mode, label: labels.skyNames[mode], icon: <Icon className="size-3.5" aria-hidden="true" /> };
              })}
            />
          </div>
          <span className="mx-4 h-px bg-[#e2e4ec]" aria-hidden="true" />
          <div className="flex min-h-14 items-center gap-3 px-4">
            <Languages className="size-5 shrink-0" style={{ color: UI_COLORS.muted }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{labels.language}</span>
            <SegmentedControl
              compact
              ariaLabel={labels.language}
              value={locale}
              onChange={onLocaleChange}
              // 각 언어 이름은 그 언어의 글꼴로 보이게 lang을 붙입니다
              options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l], lang: l }))}
            />
          </div>
          {onOpenNickname && (
            <>
              <span className="mx-4 h-px bg-[#e2e4ec]" aria-hidden="true" />
              {/* 이 마을에서 쓰는 닉네임 바꾸기: 줄 전체가 버튼입니다 */}
              <button
                type="button"
                onClick={onOpenNickname}
                className="flex min-h-14 items-center gap-3 px-4 text-left transition active:bg-black/5"
              >
                <CircleUserRound className="size-5 shrink-0" style={{ color: UI_COLORS.muted }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{labels.nickname}</span>
                <ChevronRight className="size-4 shrink-0" style={{ color: UI_COLORS.muted }} aria-hidden="true" />
              </button>
            </>
          )}
          <span className="mx-4 h-px bg-[#e2e4ec]" aria-hidden="true" />
          {/* 이용 방법 다시 보기: 줄 전체가 버튼입니다 */}
          <button
            type="button"
            onClick={onOpenHowTo}
            className="flex min-h-14 items-center gap-3 rounded-b-2xl px-4 text-left transition active:bg-black/5"
          >
            <CircleHelp className="size-5 shrink-0" style={{ color: UI_COLORS.muted }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{labels.howTo}</span>
            <ChevronRight className="size-4 shrink-0" style={{ color: UI_COLORS.muted }} aria-hidden="true" />
          </button>
        </div>

        {/* 3) 로그아웃 + 안내 */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:bg-black/5"
            style={{ color: UI_COLORS.muted }}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {labels.logout}
          </button>
          <p className="text-center text-xs" style={{ color: UI_COLORS.muted }}>
            {labels.comingSoon}
          </p>
        </div>
      </div>
    </Overlay>
  );
}
