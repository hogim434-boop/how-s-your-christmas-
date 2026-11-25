"use client";

// 화면 아래 가운데에 잠깐 떴다 사라지는 작은 안내 메시지입니다.
// message의 id가 바뀔 때마다 다시 나타나고, 2.2초 뒤 onDone을 불러 스스로 사라집니다.

import { useEffect } from "react";
import { UI_COLORS } from "@/lib/village/theme";

export type ToastMessage = { id: number; text: string };

interface ToastProps {
  message: ToastMessage | null;
  onDone: () => void;
}

export function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  if (!message) return null;
  return (
    // role="status": 화면 읽기 도구가 내용을 읽어 줍니다
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-40 flex justify-center px-6">
      <p
        role="status"
        className="max-w-full rounded-2xl px-4 py-3 text-center text-sm font-medium text-white shadow-[0_8px_24px_rgba(20,26,54,0.3)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
        style={{ backgroundColor: UI_COLORS.navy }}
      >
        {message.text}
      </p>
    </div>
  );
}
