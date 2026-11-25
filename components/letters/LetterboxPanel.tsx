"use client";

// 편지함 창 안의 내용입니다. (F005 편지 확인하기, F006 편지 수정·삭제)
// 탭 2개: 받은 편지 / 보낸 편지
//  - 받은 편지: 12.25 전에는 "잠긴 편지"와 남은 날만 보입니다. 누가 보냈는지, 무슨 내용인지는 보이지 않습니다.
//  - 보낸 편지: 받는 사람과 미리보기, 수정·삭제 버튼. 삭제는 한 번 더 물어봅니다.
//  - 12.25부터는 수정·삭제가 끝나므로 버튼을 숨깁니다.

import { useState } from "react";
import { Lock, Mail, Pencil, Trash2 } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMessages } from "@/i18n/LocaleContext";
import type { DummyReceivedLetter } from "@/lib/dummy/letters";
import type { PaperKey } from "@/lib/letters/papers";
import { letterPreview } from "@/lib/letters/rules";
import { PAPER_LOOK } from "./paperLook";
import { UI_COLORS } from "@/lib/village/theme";
import { TEXT_BUTTON } from "@/components/ui/styles";

/** 보낸 편지 한 줄에 필요한 정보 */
export type SentLetterRow = {
  recipientId: string;
  recipientName: string;
  content: string;
  /** 어떤 편지지에 썼는지 */
  paper: PaperKey;
  edited: boolean;
};

interface LetterboxPanelProps {
  received: DummyReceivedLetter[];
  sent: SentLetterRow[];
  /** true면 아직 12.25 전 (받은 편지는 잠김, 보낸 편지는 수정·삭제 가능) */
  locked: boolean;
  /** 크리스마스까지 남은 날 */
  daysLeft: number;
  onEdit: (recipientId: string) => void;
  onDelete: (recipientId: string) => void;
}

type Tab = "received" | "sent";

export function LetterboxPanel({ received, sent, locked, daysLeft, onEdit, onDelete }: LetterboxPanelProps) {
  const t = useMessages();
  const [tab, setTab] = useState<Tab>("received");
  // 지금 "정말 지울까요?"를 묻고 있는 편지 (없으면 null)
  const [confirming, setConfirming] = useState<string | null>(null);

  /** 편지 한 줄의 공통 모양: 흰 카드 + 옅은 테두리 */
  const row = "rounded-2xl border border-[#e6e8f0] bg-white";
  /** 줄 앞의 둥근 네모 아이콘 칸 */
  const iconBox = "flex size-10 shrink-0 items-center justify-center rounded-xl";
  const empty = (text: string) => (
    <li className="py-10 text-center text-sm" style={{ color: UI_COLORS.muted }}>
      {text}
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        ariaLabel={t.letterbox}
        value={tab}
        onChange={setTab}
        options={[
          { value: "received", label: `${t.letterboxReceived} ${received.length}` },
          { value: "sent", label: `${t.letterboxSent} ${sent.length}` },
        ]}
      />

      {tab === "received" && (
        <ul className="flex flex-col gap-2">
          {received.length === 0 && empty(t.letterboxEmptyReceived)}
          {received.map((letter) => (
            <li
              key={letter.id}
              className={`${row} flex items-start gap-3 p-3.5`}
              // 잠금이 풀린 편지는 보낸 사람이 고른 편지지 바탕으로 보여 줍니다
              style={letter.paper ? PAPER_LOOK[letter.paper].background : undefined}
            >
              {letter.content === null ? (
                // 잠긴 편지: 보낸 사람·내용 없이 자물쇠와 남은 날만
                <>
                  <span className={iconBox} style={{ backgroundColor: UI_COLORS.surface, color: UI_COLORS.muted }}>
                    <Lock className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 self-center">
                    <p className="text-sm font-semibold">{t.letterLocked}</p>
                    <p className="text-xs" style={{ color: UI_COLORS.muted }}>
                      {t.letterLockedUntil.replace("{n}", String(daysLeft))}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className={iconBox} style={{ backgroundColor: `${UI_COLORS.accent}1a`, color: UI_COLORS.accent }}>
                    <Mail className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t.letterFrom.replace("{name}", letter.senderName ?? "")}</p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{letter.content}</p>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === "sent" && (
        <ul className="flex flex-col gap-2">
          {sent.length === 0 && empty(t.letterboxEmptySent)}
          {sent.map((letter) => (
            <li key={letter.recipientId} className={`${row} flex flex-col overflow-hidden`}>
              <div className="min-w-0 px-4 pb-2 pt-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {/* 고른 편지지 색 점 */}
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: PAPER_LOOK[letter.paper].swatch }}
                  />
                  {t.letterTo.replace("{name}", letter.recipientName)}
                  {letter.edited && (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: UI_COLORS.surface, color: UI_COLORS.muted }}
                    >
                      {t.letterEditedMark}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 break-words text-sm leading-relaxed" style={{ color: UI_COLORS.muted }}>
                  {letterPreview(letter.content)}
                </p>
              </div>

              {/* 수정·삭제는 12.25 전까지만 */}
              {locked &&
                (confirming === letter.recipientId ? (
                  // 삭제 확인 단계: 창을 하나 더 띄우지 않고, 이 줄 안에서 다시 물어봅니다
                  <div
                    className="flex items-center justify-between gap-2 py-1 pl-4 pr-1.5"
                    style={{ backgroundColor: `${UI_COLORS.accent}12` }}
                    role="alert"
                  >
                    <p className="min-w-0 text-[13px] font-semibold" style={{ color: UI_COLORS.accent }}>
                      {t.letterDeleteConfirm}
                    </p>
                    <div className="flex shrink-0">
                      <button type="button" onClick={() => setConfirming(null)} className={TEXT_BUTTON}>
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirming(null);
                          onDelete(letter.recipientId);
                        }}
                        className={TEXT_BUTTON}
                        style={{ color: UI_COLORS.accent }}
                      >
                        {t.letterDelete}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end border-t border-[#eef0f5] px-1.5 py-1">
                    <button type="button" onClick={() => onEdit(letter.recipientId)} className={TEXT_BUTTON}>
                      <Pencil className="size-4" aria-hidden="true" />
                      {t.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(letter.recipientId)}
                      className={TEXT_BUTTON}
                      style={{ color: UI_COLORS.accent }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      {t.letterDelete}
                    </button>
                  </div>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
