"use client";

// 주민이 나 혼자일 때 보이는 "친구를 초대해요" 작은 카드입니다.
// 트리 아래·캐릭터 근처를 가리지 않도록 화면 위쪽(상단 정보 줄 바로 아래)에 한 줄로 둡니다.

import { Copy } from "lucide-react";
import { UI_COLORS } from "@/lib/village/theme";

interface InviteCardProps {
  title: string;
  copyLabel: string;
  onCopy: () => void;
}

export function InviteCard({ title, copyLabel, onCopy }: InviteCardProps) {
  return (
    <div
      className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-white py-1.5 pl-4 pr-1.5 shadow-[0_4px_16px_rgba(20,26,54,0.18)]"
      style={{ color: UI_COLORS.navy }}
    >
      <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
      <button
        type="button"
        onClick={onCopy}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white active:scale-95"
        style={{ backgroundColor: UI_COLORS.navy }}
      >
        <Copy className="size-4" aria-hidden="true" />
        {copyLabel}
      </button>
    </div>
  );
}
