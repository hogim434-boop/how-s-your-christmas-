"use client";

// 화면 위쪽에 한 줄 안내를 보여 주는 작은 부품입니다. (로드맵 Task 007)
// 예: 주민이 아닌 마을 주소로 들어왔다가 마을 만들기 화면으로 옮겨졌을 때

import { useMessages } from "@/i18n/LocaleContext";
import type { Notice } from "@/lib/auth/next";
import { UI_COLORS } from "@/lib/village/theme";

export function NoticeBanner({ notice }: { notice: Notice }) {
  const t = useMessages();
  const text = notice === "not_resident" ? t.notResidentNotice : null;
  if (!text) return null;
  return (
    // role="status": 화면 읽기 도구가 이 안내를 읽어 줍니다
    <p
      role="status"
      className="w-full max-w-sm rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium shadow-[0_4px_16px_rgba(20,26,54,0.14)]"
      style={{ color: UI_COLORS.accent }}
    >
      {text}
    </p>
  );
}
