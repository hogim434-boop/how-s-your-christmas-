"use client";

// 개발용 장식 단계 슬라이더입니다. 주소에 ?dev가 있을 때만 보입니다. (단계 0~10을 바로 바꿔 보기)

import { UI_COLORS } from "@/lib/village/theme";

interface DevLevelBarProps {
  level: number;
  max: number;
  label: string;
  onChange: (level: number) => void;
}

export function DevLevelBar({ level, max, label, onChange }: DevLevelBarProps) {
  return (
    <label
      className="pointer-events-auto flex h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold text-white shadow-md"
      style={{ backgroundColor: `${UI_COLORS.navy}e6` }}
    >
      <span className="shrink-0">
        {label} {level}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={level}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 min-w-0 flex-1 accent-[#fff6e5]"
      />
    </label>
  );
}
