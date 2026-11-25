"use client";

// 3D 마을 위에 겹쳐 뜨는 창(오버레이)의 "뼈대"입니다.
// 편지 쓰기·편지함·캐릭터 꾸미기·메뉴는 따로 주소(페이지)를 만들지 않고,
// 마을 화면 위에 이 창을 띄워서 보여 줍니다. (PRD 화면 구성, 로드맵 Task 002)
//
// 모양 (11.26 사용자 요청: 세련되고 현대적으로)
//  - 휴대폰: 아래에서 부드럽게 올라오는 "바텀 시트". 위쪽 모서리를 크게 둥글리고, 맨 위에 작은 손잡이 줄
//  - 넓은 화면: 가운데에 뜨는 둥근 카드
//  - 제목 줄은 고정되고, 내용이 길면 내용만 스크롤됩니다
//
// 사용 예:
//   <Overlay open={isOpen} onClose={() => setIsOpen(false)} title="편지 쓰기">
//     ...창 안 내용...
//   </Overlay>

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useMessages } from "@/i18n/LocaleContext";
import { UI_COLORS } from "@/lib/village/theme";

type OverlayProps = {
  /** 창이 열려 있는지 여부 */
  open: boolean;
  /** 닫기(바깥 누르기·Esc 키·닫기 버튼) 때 실행할 함수 */
  onClose: () => void;
  /** 창 맨 위 제목 */
  title: string;
  /** 창 안에 들어갈 내용 */
  children: ReactNode;
  /** full이면 화면을 거의 다 덮는 큰 창 (편지 쓰기처럼 넓은 자리가 필요할 때). 기본은 내용 높이만큼 */
  size?: "auto" | "full";
};

export default function Overlay({ open, onClose, title, children, size = "auto" }: OverlayProps) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      {/* 어두운 배경: 누르면 창이 닫힙니다.
          (뒤를 흐리게 하는 효과는 3D 화면 위에서 휴대폰을 느리게 만들어서 쓰지 않고, 색만 덮습니다) */}
      <button
        type="button"
        aria-label={t.close}
        tabIndex={-1}
        className="absolute inset-0 bg-[#141a36]/45 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        onClick={onClose}
      />

      {/* 실제 창. motion-safe: "동작 줄이기"를 켠 사람에게는 움직임 없이 바로 보입니다 */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex ${size === "full" ? "h-[93dvh] sm:h-[min(46rem,90dvh)]" : "max-h-[88dvh]"} w-full max-w-md flex-col rounded-t-[28px] bg-white shadow-[0_-12px_48px_rgba(20,26,54,0.28)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-10 motion-safe:duration-300 sm:rounded-[28px]`}
        style={{ color: UI_COLORS.navy }}
      >
        {/* 손잡이 줄: "아래에서 올라온 창"이라는 표시 (휴대폰에서만) */}
        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-[#dfe1ea] sm:hidden" />

        <header className="flex shrink-0 items-center justify-between gap-3 pb-2 pl-5 pr-3 pt-2 sm:pt-4">
          <h2 className="min-w-0 truncate text-[17px] font-bold tracking-tight">{title}</h2>
          {/* 닫기 버튼: 보이는 원은 작지만 누르는 영역은 44px */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-90"
          >
            <span
              className="flex size-8 items-center justify-center rounded-full"
              style={{ backgroundColor: UI_COLORS.surface, color: UI_COLORS.muted }}
            >
              <X className="size-4" strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        </header>

        {/* 내용: 길면 여기만 스크롤됩니다. 아래쪽은 아이폰 홈 막대만큼 띄웁니다 */}
        <div
          className={`min-h-0 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-1 ${
            size === "full" ? "flex flex-1 flex-col" : ""
          }`}
        >
          {children}
        </div>
      </section>
    </div>
  );
}
