"use client";

// 편지 쓰기 창 안의 내용입니다. (F004 편지 보내기, F006 편지 수정)
// 편지지처럼 "○○님께 … △△ 드림" 모양이고, 아래에 글자 수와 보내기 버튼이 있습니다.
// 이 부품은 "보내기를 누르면 onSubmit(글)을 부른다"까지만 합니다.
// 실제로 어디에 저장하는지는 모릅니다 → 나중에 진짜 서버로 바꿔도 이 파일은 그대로 둘 수 있습니다.

import { useState } from "react";
import { Lock, Send } from "lucide-react";
import { useMessages } from "@/i18n/LocaleContext";
import { LETTER_MAX_LENGTH, letterLength, validateLetter } from "@/lib/letters/rules";
import { UI_COLORS } from "@/lib/village/theme";
import { PRIMARY_BUTTON } from "@/components/ui/styles";

interface LetterFormProps {
  /** 받는 사람 이름 */
  toName: string;
  /** 보내는 사람(나) 이름 */
  fromName: string;
  /** 처음에 채워 둘 글 (수정 모드면 전에 쓴 글, 새 편지면 빈 글) */
  initialContent: string;
  /** new = 새 편지, edit = 이미 보낸 편지 고치기 */
  mode: "new" | "edit";
  /** true면 편지 쓰기가 끝난 상태(12.25 이후): 입력칸 대신 안내만 보여 줍니다 */
  closed: boolean;
  onSubmit: (content: string) => void;
}

export function LetterForm({ toName, fromName, initialContent, mode, closed, onSubmit }: LetterFormProps) {
  const t = useMessages();
  // 지금 입력칸에 적힌 글
  const [content, setContent] = useState(initialContent);

  if (closed) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: UI_COLORS.muted }}>
        {t.lettersClosed}
      </p>
    );
  }

  const length = letterLength(content);
  const check = validateLetter(content);
  // 고치기 모드에서 글이 그대로면 다시 보낼 필요가 없습니다
  const unchanged = mode === "edit" && content === initialContent;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        // 기본 동작(페이지 새로고침)을 막고, 우리가 정한 보내기만 실행합니다
        e.preventDefault();
        if (check === "ok" && !unchanged) onSubmit(content);
      }}
    >
      {/* 편지지: 옅은 바탕의 카드 하나. 입력 중에는 테두리가 진해집니다 (focus-within) */}
      <div
        className="flex flex-col rounded-2xl border border-transparent px-4 py-3.5 transition-colors focus-within:border-[#232b52]/25"
        style={{ backgroundColor: UI_COLORS.surface }}
      >
        <p className="text-[13px] font-semibold" style={{ color: UI_COLORS.muted }}>
          {t.letterTo.replace("{name}", toName)}
        </p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t.letterInputPlaceholder}
          aria-label={t.letterInputPlaceholder}
          rows={7}
          // text-base(16px): 아이폰은 글자가 16px보다 작으면 입력할 때 화면을 확대해 버립니다
          className="my-2 w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-[#a9aec0]"
        />
        <div className="flex items-end justify-between gap-3">
          <p
            className={`text-xs tabular-nums ${check === "tooLong" ? "font-semibold" : ""}`}
            style={{ color: check === "tooLong" ? UI_COLORS.accent : UI_COLORS.muted }}
          >
            {length} / {LETTER_MAX_LENGTH}
          </p>
          <p className="text-[13px] font-semibold" style={{ color: UI_COLORS.muted }}>
            {t.letterFrom.replace("{name}", fromName)}
          </p>
        </div>
      </div>

      {/* 안내 한 줄: 평소에는 "크리스마스까지 못 읽어요", 글이 너무 길면 경고 */}
      <p
        role="status"
        className="flex items-center gap-1.5 px-1 text-xs"
        style={{ color: check === "tooLong" ? UI_COLORS.accent : UI_COLORS.muted }}
      >
        {check === "tooLong" ? (
          <span className="font-semibold">{t.letterTooLong.replace("{max}", String(LETTER_MAX_LENGTH))}</span>
        ) : (
          <>
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            {t.letterLockNote}
          </>
        )}
      </p>

      <button type="submit" disabled={check !== "ok" || unchanged} className={PRIMARY_BUTTON}>
        <Send className="size-4" aria-hidden="true" />
        {mode === "edit" ? t.letterEdit : t.letterSend}
      </button>
    </form>
  );
}
