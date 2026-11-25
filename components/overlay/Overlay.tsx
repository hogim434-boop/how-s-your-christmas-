"use client";

// 3D 마을 위에 겹쳐 뜨는 창(오버레이)의 "뼈대"입니다.
// 편지 쓰기·편지함·캐릭터 꾸미기는 따로 주소(페이지)를 만들지 않고,
// 마을 화면 위에 이 창을 띄워서 보여 줍니다. (PRD 화면 구성, 로드맵 Task 002)
//
// 사용 예:
//   <Overlay open={isOpen} onClose={() => setIsOpen(false)} title="편지 쓰기">
//     ...창 안 내용...
//   </Overlay>

import { useEffect, type ReactNode } from "react";
import { useMessages } from "@/i18n/LocaleContext";

type OverlayProps = {
  /** 창이 열려 있는지 여부 */
  open: boolean;
  /** 닫기(바깥 누르기·Esc 키·닫기 버튼) 때 실행할 함수 */
  onClose: () => void;
  /** 창 맨 위 제목 */
  title: string;
  /** 창 안에 들어갈 내용 */
  children: ReactNode;
};

export default function Overlay({ open, onClose, title, children }: OverlayProps) {
  // 키보드 Esc를 누르면 창이 닫히게 합니다 (컴퓨터에서 볼 때 편하도록)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    // 창이 닫히면 키보드 감시도 꺼서, 쓸데없이 남아 있지 않게 합니다
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // 지금 화면 언어 (VillageView가 정해 줌. 없으면 기본 언어)
  const t = useMessages();

  // 닫혀 있으면 아무것도 그리지 않습니다
  if (!open) return null;

  return (
    // 화면 전체를 덮는 층. 3D 마을은 뒤에 그대로 보입니다.
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* 반투명 배경: 누르면 창이 닫힙니다 */}
      <button
        type="button"
        aria-label={t.close}
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* 실제 창. 휴대폰에서는 아래에서 올라온 모양, 넓은 화면에서는 가운데 */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 text-2xl leading-none text-slate-400 hover:text-slate-600"
            aria-label={t.close}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
