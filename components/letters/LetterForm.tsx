"use client";

// 편지 쓰기 창 안의 내용입니다. (F004 편지 보내기, F006 편지 수정)
// 11.26 사용자 요청으로 크게 키웠습니다:
//  - 화면을 거의 다 채우는 "큰 편지지" (줄이 그어진 종이, 위에 ○○님께, 아래에 △△ 드림)
//  - 편지지 고르기 (4종. 받는 사람도 같은 편지지로 봅니다)
//  - 임시 저장: 쓰는 동안 계속 기억해 두어, 창을 닫아도 다시 열면 이어서 쓸 수 있습니다
//  - 보내기 연출: 편지지가 접혀 봉투가 되고, 아래 우체통 쪽으로 쏙 들어갑니다
//
// 이 부품은 "보내기를 누르면 onSubmit(글, 편지지)을 부른다"까지만 합니다.
// 실제로 어디에 저장하는지는 모릅니다 → 나중에 진짜 서버로 바꿔도 이 파일은 그대로 둘 수 있습니다.

import { useEffect, useEffectEvent, useState } from "react";
import { Check, Lock, RotateCcw, Send } from "lucide-react";
import { PRIMARY_BUTTON } from "@/components/ui/styles";
import { useMessages } from "@/i18n/LocaleContext";
import { draftFor, type LetterDraft } from "@/lib/letters/drafts";
import { PAPER_KEYS, type PaperKey } from "@/lib/letters/papers";
import { LETTER_MAX_LENGTH, letterLength, validateLetter } from "@/lib/letters/rules";
import { UI_COLORS } from "@/lib/village/theme";
import { PAPER_LOOK } from "./paperLook";

interface LetterFormProps {
  /** 받는 사람 이름 */
  toName: string;
  /** 보내는 사람(나) 이름 */
  fromName: string;
  /** 처음 상태: 고치기면 보낸 글·편지지, 새 편지면 빈 글·기본 편지지 */
  initial: LetterDraft;
  /** 임시 저장된 글 (없으면 null). 있으면 이 글로 시작합니다 */
  draft: LetterDraft | null;
  /** new = 새 편지, edit = 이미 보낸 편지 고치기 */
  mode: "new" | "edit";
  /** true면 편지 쓰기가 끝난 상태(12.25 이후): 입력칸 대신 안내만 보여 줍니다 */
  closed: boolean;
  /** 쓰는 중인 글이 바뀔 때마다 알려 줍니다. 저장할 것이 없으면 null (받은 쪽이 임시 저장을 맡습니다) */
  onDraftChange: (draft: LetterDraft | null) => void;
  onSubmit: (content: string, paper: PaperKey) => void;
}

/** 글 한 줄의 높이(px). 편지지의 줄 간격과 글줄을 똑같이 맞추는 데 씁니다 */
const LINE_HEIGHT = 32;
/** 보내기 연출 길이(ms). 아래 봉투에 건 움직임 클래스의 1300ms와 같아야 합니다 */
const SEND_ANIMATION_MS = 1300;

export function LetterForm({ toName, fromName, initial, draft, mode, closed, onDraftChange, onSubmit }: LetterFormProps) {
  const t = useMessages();
  // 지금 편지지에 적힌 글과 고른 편지지. 임시 저장된 글이 있으면 그것으로 시작합니다
  const [content, setContent] = useState(draft?.content ?? initial.content);
  const [paper, setPaper] = useState<PaperKey>(draft?.paper ?? initial.paper);
  // "쓰던 편지를 불러왔어요" 안내를 보일지
  const [restored, setRestored] = useState(draft !== null);
  // 보내기 연출이 진행 중인지
  const [sending, setSending] = useState(false);

  // 💡 useEffectEvent: "효과(useEffect) 안에서 부르는 함수"를 만드는 React 도구입니다.
  //    항상 가장 최신 값(글, 편지지, 부모가 준 함수)을 쓰면서도, 그 값들이 바뀔 때마다 효과가 다시 돌지는 않습니다.
  const notifyDraft = useEffectEvent(() => onDraftChange(draftFor({ content, paper }, initial)));
  const submitNow = useEffectEvent(() => onSubmit(content, paper));

  // 글이나 편지지가 바뀔 때마다 임시 저장 (처음 상태와 같으면 저장할 것 없음)
  useEffect(() => {
    notifyDraft();
  }, [content, paper]);

  // 보내기 연출이 끝나면 진짜로 보냅니다. 중간에 창이 닫히면 타이머를 지워 보내지 않습니다
  useEffect(() => {
    if (!sending) return;
    const timer = setTimeout(submitNow, SEND_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [sending]);

  if (closed) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: UI_COLORS.muted }}>
        {t.lettersClosed}
      </p>
    );
  }

  const look = PAPER_LOOK[paper];
  const length = letterLength(content);
  const check = validateLetter(content);
  // 고치기 모드에서 글도 편지지도 그대로면 다시 보낼 필요가 없습니다
  const unchanged = mode === "edit" && content === initial.content && paper === initial.paper;
  const canSend = check === "ok" && !unchanged && !sending;

  const paperNames: Record<PaperKey, string> = {
    plain: t.paperPlain,
    snow: t.paperSnow,
    tree: t.paperTree,
    candy: t.paperCandy,
  };

  return (
    <form
      className="relative flex min-h-0 flex-1 flex-col gap-3"
      onSubmit={(e) => {
        // 기본 동작(페이지 새로고침)을 막고, 우리가 정한 보내기만 실행합니다
        e.preventDefault();
        if (!canSend) return;
        // "동작 줄이기"를 켠 사람에게는 연출 없이 바로 보냅니다
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) onSubmit(content, paper);
        else setSending(true);
      }}
    >
      {/* 임시 저장된 글로 시작했을 때의 안내. "처음부터"를 누르면 원래 상태로 돌아갑니다 */}
      {restored && !sending && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 rounded-xl py-0.5 pl-3.5 pr-1 text-[13px]"
          style={{ backgroundColor: UI_COLORS.surface, color: UI_COLORS.muted }}
        >
          <p className="min-w-0 truncate">{t.letterDraftRestored}</p>
          <button
            type="button"
            onClick={() => {
              setContent(initial.content);
              setPaper(initial.paper);
              setRestored(false);
            }}
            className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 font-semibold transition active:bg-black/5"
            style={{ color: UI_COLORS.navy }}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {t.letterDraftDiscard}
          </button>
        </div>
      )}

      {/* ── 편지지 ── 남는 높이를 모두 차지합니다 (flex-1) */}
      <div
        // 보내기를 누르면 편지지가 작게 접히며 사라집니다 (letter-fold는 app/globals.css에 있는 움직임 이름)
        // ⚠️ 움직임은 style이 아니라 클래스로 걸어야 합니다. 클래스에서 쓰이지 않는 움직임은 CSS에서 빠져 버립니다
        className={
          "relative flex min-h-48 flex-1 flex-col overflow-hidden rounded-[20px] border border-black/5 px-5 pb-3 pt-5 shadow-[0_2px_12px_rgba(20,26,54,0.08)] " +
          (sending ? "animate-[letter-fold_450ms_ease-in_forwards]" : "")
        }
        style={look.background}
      >
        {/* 구석 장식: 옅게 비치는 그림 (꾸밈용이라 화면 읽기 도구는 건너뜁니다) */}
        <span aria-hidden="true" className="pointer-events-none absolute bottom-9 right-3 select-none text-6xl opacity-[0.16]">
          {look.mark}
        </span>

        <p className="shrink-0 text-[15px] font-semibold">{t.letterTo.replace("{name}", toName)}</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t.letterInputPlaceholder}
          aria-label={t.letterInputPlaceholder}
          disabled={sending}
          // text-base(16px): 아이폰은 글자가 16px보다 작으면 입력할 때 화면을 확대해 버립니다
          className="relative mt-2 min-h-0 w-full flex-1 resize-none bg-transparent text-base outline-none placeholder:text-black/25"
          style={{
            lineHeight: `${LINE_HEIGHT}px`,
            // 글줄마다 밑줄: 한 줄 높이만큼 반복되는 가는 선. local = 글을 스크롤하면 줄도 같이 움직입니다
            backgroundImage: `repeating-linear-gradient(transparent 0 ${LINE_HEIGHT - 1}px, ${look.line} ${LINE_HEIGHT - 1}px ${LINE_HEIGHT}px)`,
            backgroundAttachment: "local",
          }}
        />
        <div className="relative flex shrink-0 items-end justify-between gap-3 pt-2">
          <p
            className={`text-xs tabular-nums ${check === "tooLong" ? "font-semibold" : ""}`}
            style={{ color: check === "tooLong" ? UI_COLORS.accent : UI_COLORS.muted }}
          >
            {length} / {LETTER_MAX_LENGTH}
          </p>
          <p className="text-[15px] font-semibold">{t.letterFrom.replace("{name}", fromName)}</p>
        </div>
      </div>

      {/* ── 편지지 고르기 ── */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="pl-1 text-[13px] font-semibold" style={{ color: UI_COLORS.muted }}>
          {t.letterPaper}
        </span>
        <div role="radiogroup" aria-label={t.letterPaper} className="flex shrink-0">
          {PAPER_KEYS.map((key) => {
            const selected = key === paper;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${t.letterPaper}: ${paperNames[key]}`}
                disabled={sending}
                onClick={() => setPaper(key)}
                // 누르는 영역은 40px, 보이는 동그라미는 28px
                className="flex size-10 items-center justify-center rounded-full transition active:scale-90"
              >
                <span
                  className="flex size-7 items-center justify-center rounded-full ring-offset-2"
                  style={{
                    backgroundColor: PAPER_LOOK[key].swatch,
                    boxShadow: selected ? `0 0 0 2px #ffffff, 0 0 0 4px ${UI_COLORS.navy}` : "inset 0 0 0 1px rgba(0,0,0,0.06)",
                  }}
                >
                  {selected && <Check className="size-3.5" strokeWidth={3} style={{ color: UI_COLORS.navy }} aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* 안내 한 줄: 평소에는 "크리스마스까지 못 읽어요", 글이 너무 길면 경고 */}
      <p
        role="status"
        className="flex shrink-0 items-center gap-1.5 px-1 text-xs"
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

      <button type="submit" disabled={!canSend} className={`${PRIMARY_BUTTON} shrink-0`}>
        <Send className="size-4" aria-hidden="true" />
        {mode === "edit" ? t.letterEdit : t.letterSend}
      </button>

      {/* ── 보내기 연출: 봉투가 나타나 아래(우체통 쪽)로 들어갑니다 ── */}
      {sending && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status" aria-label={t.letterSending}>
          <div
            className="relative h-24 w-36 animate-[envelope-send_1300ms_cubic-bezier(0.5,0,0.7,0.4)_forwards] overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_rgba(20,26,54,0.28)]"
          >
            {/* 봉투 몸통의 옅은 색과 뚜껑(세모) */}
            <span className="absolute inset-0" style={{ backgroundColor: look.swatch, opacity: 0.35 }} />
            <span
              className="absolute inset-x-0 top-0 h-14"
              style={{ backgroundColor: look.swatch, clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
            />
            {/* 봉인 스티커 */}
            <span
              className="absolute left-1/2 top-11 size-5 -translate-x-1/2 rounded-full ring-2 ring-white"
              style={{ backgroundColor: UI_COLORS.accent }}
            />
          </div>
        </div>
      )}
    </form>
  );
}
