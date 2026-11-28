"use client";

// 장식 단계가 올라간 순간, 화면 위쪽에 잠깐 뜨는 안내 카드입니다. (11.28 사용자 요청: 무엇이 바뀌었는지 알 수 있게)
// 예: "40% 달성!  새 장식 · 산타 양말 · 지팡이 사탕 · 노란 종"
// data의 id가 바뀔 때마다 다시 나타나고, 4초 뒤 onDone을 불러 스스로 사라집니다.

import { useEffect } from "react";
import { UI_COLORS } from "@/lib/village/theme";

export type LevelUpData = { id: number; title: string; label: string; names: string };

interface LevelUpCardProps {
  data: LevelUpData | null;
  onDone: () => void;
}

export function LevelUpCard({ data, onDone }: LevelUpCardProps) {
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(onDone, 4000);
    return () => clearTimeout(timer);
  }, [data, onDone]);

  if (!data) return null;
  return (
    // role="status": 화면 읽기 도구가 내용을 읽어 줍니다. key: 연달아 올라가면 등장 움직임을 다시 보여 줍니다
    <div
      key={data.id}
      role="status"
      className="mx-auto flex max-w-full flex-col items-center gap-0.5 rounded-2xl px-5 py-3 text-center shadow-[0_8px_24px_rgba(20,26,54,0.3)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 motion-safe:slide-in-from-top-2 motion-safe:duration-300"
      style={{ backgroundColor: UI_COLORS.cream, color: UI_COLORS.navy }}
    >
      <p className="text-base font-bold">{data.title}</p>
      <p className="text-pretty text-sm font-medium [&:lang(ko)]:break-keep">
        <span className="opacity-60">{data.label}</span> {data.names}
      </p>
    </div>
  );
}
