"use client";

// 여러 칸 중 "하나만" 고르는 버튼 묶음입니다. (편지함 탭, 꾸미기 부위 탭, 마을 종류, 메뉴의 하늘·언어 고르기)
// 옅은 회색 홈 안에서, 고른 칸만 흰 카드처럼 떠오르는 모양입니다. (요즘 휴대폰 앱에서 흔히 쓰는 방식)
// 💡 radiogroup: 화면 읽기 도구에 "이 중 하나만 고르는 묶음"이라고 알려 주는 표시입니다.

import type { ReactNode } from "react";
import { UI_COLORS } from "@/lib/village/theme";

interface SegmentedControlProps<T extends string> {
  /** 고를 수 있는 칸들 (value = 코드에서 쓰는 값, label = 화면에 보이는 글자, icon = 글자 앞 작은 그림) */
  options: readonly { value: T; label: string; icon?: ReactNode; lang?: string }[];
  /** 지금 고른 값 */
  value: T;
  onChange: (value: T) => void;
  /** 화면 읽기 도구용 묶음 이름 */
  ariaLabel: string;
  /** 한 줄에 몇 칸씩 놓을지 (기본: 한 줄에 모두) */
  columns?: number;
  /** true면 줄 안에 들어가는 작은 크기 (메뉴의 설정 줄에서 사용) */
  compact?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  columns,
  compact = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`${compact ? "inline-grid" : "grid"} gap-1 rounded-2xl p-1`}
      style={{
        backgroundColor: compact ? "#e6e8f0" : UI_COLORS.surface,
        gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            lang={option.lang}
            onClick={() => onChange(option.value)}
            // 보통 크기는 44px(손가락으로 누르기 편한 최소 크기), 작은 크기는 36px
            className={
              (compact ? "min-h-9 px-3 text-[13px]" : "min-h-11 px-2 text-sm") +
              " flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-semibold transition-all " +
              (selected ? "bg-white shadow-[0_1px_4px_rgba(20,26,54,0.14)]" : "")
            }
            style={{ color: selected ? UI_COLORS.navy : UI_COLORS.muted }}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
