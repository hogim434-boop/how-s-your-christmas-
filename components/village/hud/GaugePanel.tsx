"use client";

// 진행률 게이지: 화면 아래에 뜨는 "장식 길"입니다. (F008, 로드맵 Task 016)
// 10%~100% 단계의 장식 그림이 한 줄로 이어져 있고, 옆으로 넘겨 봅니다. (게임의 "보상 길" 방식)
//  - 달성한 그림을 누르면: 이 띠는 그대로 둔 채 마을에서 그 장식이 깜빡입니다 (화면은 이동하지 않음)
//  - 아직 못 간 그림을 누르면: 어떤 장식인지 이름만 알려 줍니다 (깜빡임 없음)
// 💡 화면을 덮는 큰 창이 아니라 얇은 띠라서, 위쪽의 마을이 그대로 보입니다.

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { gaugeRows } from "@/lib/decor/gauge";
import { UI_COLORS } from "@/lib/village/theme";
import { GaugeIcon } from "./GaugeIcon";

interface GaugePanelProps {
  /** 지금 장식 단계 (0~10) */
  level: number;
  /** 지금 진행률(%) */
  percent: number;
  /** 단계마다 생기는 장식 이름 (첫 번째 = 10%). i18n의 decorNames */
  names: readonly string[];
  labels: {
    title: string;
    /** 아무것도 고르지 않았을 때의 안내 한 줄 */
    hint: string;
    /** 잠긴 단계 표시 (예: "아직") */
    locked: string;
    close: string;
  };
  /** 달성한 그림을 눌렀을 때 (그 단계 번호) */
  onPick: (level: number) => void;
  onClose: () => void;
}

/** 줄의 색: 채워진 구간 / 아직 비어 있는 구간 */
const LINE = { filled: UI_COLORS.accent, empty: "#e3e5ee" };

export function GaugePanel({ level, percent, names, labels, onPick, onClose }: GaugePanelProps) {
  const rows = gaugeRows(level);
  // 방금 누른 단계 (이름을 보여 주고 테두리로 표시). 처음에는 없음
  const [picked, setPicked] = useState<number | null>(null);
  const pickedRow = rows.find((row) => row.level === picked);

  // 열릴 때 지금 단계가 가운데 오도록 옆으로 넘겨 둡니다
  const current = useRef<HTMLLIElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  // Esc 키로 닫기 (컴퓨터에서 볼 때)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    // pointer-events-none: 띠 바깥(마을)은 평소처럼 누를 수 있게 터치를 통과시킵니다
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <section
        aria-label={labels.title}
        className="pointer-events-auto w-full max-w-md rounded-t-[28px] bg-white pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-12px_48px_rgba(20,26,54,0.28)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-10 motion-safe:duration-300"
        style={{ color: UI_COLORS.navy }}
      >
        <header className="flex items-center gap-2 pl-5 pr-2 pt-2">
          <h2 className="text-[15px] font-bold tracking-tight">{labels.title}</h2>
          <span className="text-sm font-bold tabular-nums" style={{ color: UI_COLORS.accent }}>
            {percent}%
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-90"
          >
            <span className="flex size-8 items-center justify-center rounded-full" style={{ backgroundColor: UI_COLORS.surface, color: UI_COLORS.muted }}>
              <X className="size-4" strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        </header>

        {/* 설명 한 줄: 고른 장식의 이름, 없으면 안내 문구. aria-live: 바뀌면 화면 읽기 도구가 읽어 줍니다 */}
        <p aria-live="polite" className="truncate px-5 text-xs font-medium" style={{ color: pickedRow ? UI_COLORS.navy : UI_COLORS.muted }}>
          {pickedRow ? (
            <>
              <span className="font-bold tabular-nums">{pickedRow.percent}%</span> {names[pickedRow.level - 1]}
              {!pickedRow.reached && <span style={{ color: UI_COLORS.muted }}> · {labels.locked}</span>}
            </>
          ) : (
            labels.hint
          )}
        </p>

        {/* 장식 길: 옆으로 넘겨 봅니다 (스크롤 막대는 숨김) */}
        <ul className="flex overflow-x-auto px-3 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rows.map((row, i) => {
            const next = rows[i + 1];
            const isCurrent = row.level === Math.max(1, Math.min(level, rows.length));
            const isPicked = row.level === picked;
            return (
              <li key={row.level} ref={isCurrent ? current : undefined} className="relative w-[68px] shrink-0">
                {/* 그림들을 잇는 줄: 왼쪽 절반은 이 단계를, 오른쪽 절반은 다음 단계를 달성했으면 채워집니다 */}
                {i > 0 && (
                  <span aria-hidden="true" className="absolute left-0 top-[26px] h-1 w-1/2" style={{ backgroundColor: row.reached ? LINE.filled : LINE.empty }} />
                )}
                {next && (
                  <span aria-hidden="true" className="absolute right-0 top-[26px] h-1 w-1/2" style={{ backgroundColor: next.reached ? LINE.filled : LINE.empty }} />
                )}
                <button
                  type="button"
                  data-reached={row.reached}
                  aria-label={`${row.percent}% ${names[row.level - 1] ?? ""}${row.reached ? "" : ` (${labels.locked})`}`}
                  aria-pressed={isPicked}
                  onClick={() => {
                    setPicked(row.level);
                    if (row.reached) onPick(row.level);
                  }}
                  className="relative flex w-full flex-col items-center gap-1 transition-transform active:scale-90"
                >
                  <span
                    className="flex size-14 items-center justify-center rounded-full border-[3px]"
                    style={{
                      backgroundColor: row.reached ? UI_COLORS.cream : UI_COLORS.surface,
                      borderColor: isPicked ? UI_COLORS.navy : row.reached ? LINE.filled : LINE.empty,
                    }}
                  >
                    {/* 잠긴 단계는 색을 빼고 흐리게 (그림자처럼) */}
                    <GaugeIcon kind={row.key} className={`size-9 ${row.reached ? "" : "opacity-30 grayscale"}`} />
                  </span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: row.reached ? UI_COLORS.navy : UI_COLORS.muted }}>
                    {row.percent}%
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
