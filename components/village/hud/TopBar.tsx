"use client";

// 화면 맨 위 정보 줄: 왼쪽에 마을 이름·D-day, 오른쪽에 진행률 알약입니다.
// 글자만 있어서 터치를 막지 않도록 pointer-events-none을 줍니다.

import { UI_COLORS } from "@/lib/village/theme";

interface TopBarProps {
  villageName: string;
  /** 이미 문구로 만들어진 D-day (예: "D-30" 또는 "D-Day") */
  ddayText: string;
  /** D-day 아래 작은 글자 (예: "크리스마스까지"). D-Day 당일이면 비움 */
  ddayCaption?: string;
  /** 진행률(0~100) */
  percent: number;
  progressAria: string;
  /** 밤 모드면 글자를 밝은 색으로 (어두운 하늘에서도 읽히게) */
  night?: boolean;
}

export function TopBar({ villageName, ddayText, ddayCaption, percent, progressAria, night = false }: TopBarProps) {
  return (
    <header
      className="pointer-events-none flex items-start justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)]"
      style={{ color: night ? UI_COLORS.cream : UI_COLORS.navy }}
    >
      {/* 글자 둘레의 은은한 테두리 빛: 낮에는 흰빛, 밤에는 남색 그림자 */}
      <div
        className={
          "min-w-0 leading-tight " +
          (night ? "[text-shadow:0_0_6px_#161d38,0_0_6px_#161d38]" : "[text-shadow:0_0_6px_#fff,0_0_6px_#fff]")
        }
      >
        <p className="truncate text-xs opacity-70">{villageName}</p>
        <p className="text-4xl font-bold tracking-tight">{ddayText}</p>
        {ddayCaption && <p className="text-xs opacity-90">{ddayCaption}</p>}
      </div>
      {/* 진행률 알약: 모서리를 완전히 둥글게(rounded-full) */}
      <div
        role="status"
        aria-label={`${progressAria} ${percent}%`}
        className="shrink-0 rounded-full px-4 py-2 text-base font-bold shadow-md"
        style={{ backgroundColor: UI_COLORS.cream, color: UI_COLORS.navy }}
      >
        {percent}%
      </div>
    </header>
  );
}
