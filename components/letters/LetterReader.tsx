"use client";

// 받은 편지 한 통을 읽는 창 안의 내용입니다. (F005 편지 확인하기, 로드맵 Task 015)
//
// 두 가지 모습이 있습니다.
//  - 처음 여는 편지(firstOpen): 봉투가 나타나 뚜껑이 열리고, 편지지가 올라온 뒤 내용이 펼쳐집니다 (약 1.6초)
//  - 이미 열어 본 편지: 연출 없이 바로 내용이 보입니다
//
// 연출을 기다리기 싫으면 봉투를 누르면 바로 내용으로 넘어갑니다.
// "동작 줄이기"를 켠 사람에게는 연출 없이 바로 내용을 보여 줍니다.
//
// 💡 움직임의 이름(envelope-pop 등)은 app/globals.css의 "편지 열기 연출"에 있습니다.
//    움직임은 transform(위치·크기·회전)과 opacity(투명도)만 바꿉니다. 이 둘은 화면을 다시 계산하지 않고
//    그림만 옮기는 값이라, 뒤에서 3D 마을이 돌아가는 중에도 가볍습니다.

import { useEffect, useState } from "react";
import { useMessages } from "@/i18n/LocaleContext";
import type { PaperKey } from "@/lib/letters/papers";
import { UI_COLORS } from "@/lib/village/theme";
import { PAPER_LOOK } from "./paperLook";

/** 편지지의 한 줄 높이(px). 편지 쓰기 창(LetterForm)과 같은 값이라, 쓴 모습 그대로 줄에 맞춰 보입니다 */
const LINE_HEIGHT = 32;
/** 봉투 연출이 끝나고 편지지로 넘어가는 시각(ms). 아래 움직임들의 길이·늦춤과 맞춘 값입니다 */
const ENVELOPE_MS = 1250;

interface LetterReaderProps {
  /** 보낸 사람 이름 */
  senderName: string;
  content: string;
  /** 보낸 사람이 고른 편지지 */
  paper: PaperKey;
  /** true면 처음 여는 편지 → 봉투 개봉 연출을 보여 줍니다. 창이 열려 있는 동안 바뀌지 않는 값이어야 합니다 */
  firstOpen: boolean;
}

/** "동작 줄이기"를 켠 사람인지 (서버에서는 알 수 없으므로 false) */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LetterReader({ senderName, content, paper, firstOpen }: LetterReaderProps) {
  const t = useMessages();
  const look = PAPER_LOOK[paper];
  // 지금 보여 줄 모습: 봉투(envelope) 또는 편지지(paper). 처음 한 번만 정합니다
  const [stage, setStage] = useState<"envelope" | "paper">(() => (firstOpen && !prefersReducedMotion() ? "envelope" : "paper"));
  // 봉투에서 넘어온 편지지만 "펼쳐지는 움직임"을 줍니다 (이미 열어 본 편지는 가만히 나타남)
  const [unfold] = useState(stage === "envelope");

  // 봉투 연출이 끝나면 저절로 편지지로 넘어갑니다
  useEffect(() => {
    if (stage !== "envelope") return;
    const timer = window.setTimeout(() => setStage("paper"), ENVELOPE_MS);
    // 창을 닫거나 봉투를 눌러 먼저 넘어가면 타이머를 지웁니다 (닫힌 뒤에 상태를 바꾸지 않게)
    return () => window.clearTimeout(timer);
  }, [stage]);

  if (stage === "envelope") {
    return (
      // 봉투 전체가 버튼입니다: 누르면 연출을 건너뛰고 바로 편지지로 갑니다
      <button
        type="button"
        onClick={() => setStage("paper")}
        aria-label={t.letterOpenHint}
        className="flex min-h-72 w-full flex-col items-center justify-center gap-10 rounded-[20px] pt-10"
      >
        {/* perspective: 뚜껑이 젖혀질 때 앞뒤 깊이감이 보이게 합니다 */}
        <span className="relative block h-28 w-44 animate-[envelope-pop_380ms_cubic-bezier(0.2,0.8,0.2,1)_both] [perspective:600px]">
          {/* 봉투 뒷면 */}
          <span className="absolute inset-0 rounded-2xl bg-white shadow-[0_12px_32px_rgba(20,26,54,0.22)]" />
          <span className="absolute inset-0 rounded-2xl" style={{ backgroundColor: look.swatch, opacity: 0.35 }} />
          {/* 봉투 속 편지지: 뚜껑이 열린 뒤 위로 올라옵니다 */}
          <span
            className="absolute inset-x-3 bottom-2 top-3 animate-[letter-peek_520ms_cubic-bezier(0.2,0.8,0.2,1)_720ms_both] rounded-lg border border-black/5 shadow-sm"
            style={look.background}
          />
          {/* 봉투 앞주머니: 편지지의 아래쪽을 가립니다 (가운데가 V자로 파인 모양) */}
          <span
            className="absolute inset-0 rounded-2xl bg-white"
            style={{ clipPath: "polygon(0 0, 50% 52%, 100% 0, 100% 100%, 0 100%)" }}
          />
          <span
            className="absolute inset-0 rounded-2xl"
            style={{ backgroundColor: look.swatch, opacity: 0.55, clipPath: "polygon(0 0, 50% 52%, 100% 0, 100% 100%, 0 100%)" }}
          />
          {/* 뚜껑(세모)과 봉인 스티커: 윗변을 축으로 위로 젖혀집니다 */}
          <span className="absolute inset-x-0 top-0 h-16 origin-top animate-[envelope-flap-open_420ms_ease-in-out_340ms_both]">
            <span className="absolute inset-0 rounded-t-2xl" style={{ backgroundColor: look.swatch, clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
            <span
              className="absolute left-1/2 top-11 size-5 -translate-x-1/2 rounded-full ring-2 ring-white"
              style={{ backgroundColor: UI_COLORS.accent }}
            />
          </span>
        </span>
        <span className="text-xs" style={{ color: UI_COLORS.muted }}>
          {t.letterOpenHint}
        </span>
      </button>
    );
  }

  return (
    // 편지지: 편지 쓰기 창(LetterForm)과 같은 생김새
    <article
      className={
        "relative flex min-h-72 flex-col overflow-hidden rounded-[20px] border border-black/5 px-5 pb-4 pt-5 shadow-[0_2px_12px_rgba(20,26,54,0.08)] " +
        (unfold ? "animate-[letter-unfold_420ms_cubic-bezier(0.2,0.8,0.2,1)_both]" : "")
      }
      style={look.background}
    >
      {/* 구석 장식: 옅게 비치는 그림 (꾸밈용이라 화면 읽기 도구는 건너뜁니다) */}
      <span aria-hidden="true" className="pointer-events-none absolute bottom-10 right-3 select-none text-6xl opacity-[0.16]">
        {look.mark}
      </span>
      {/* 본문: 줄바꿈을 그대로 살리고(whitespace-pre-wrap), 긴 낱말은 줄을 바꿔 옆으로 넘치지 않게 합니다(break-words) */}
      <p
        className="relative flex-1 whitespace-pre-wrap break-words text-base"
        style={{
          lineHeight: `${LINE_HEIGHT}px`,
          // 글줄마다 밑줄: 한 줄 높이만큼 반복되는 가는 선
          backgroundImage: `repeating-linear-gradient(transparent 0 ${LINE_HEIGHT - 1}px, ${look.line} ${LINE_HEIGHT - 1}px ${LINE_HEIGHT}px)`,
        }}
      >
        {content}
      </p>
      <p className="relative pt-3 text-right text-[15px] font-semibold">{t.letterFrom.replace("{name}", senderName)}</p>
    </article>
  );
}
