"use client";

// 이 마을에서 쓸 닉네임을 정하는 입력 창의 내용입니다. (11.27 사용자 요청)
//
// 언제 뜨나요?
// - 마을에 처음 들어왔을 때 (마을을 만든 직후, 초대 링크로 입주한 직후) → 캐릭터 꾸미기 창보다 먼저
// - 메뉴의 "닉네임" 줄을 눌렀을 때 (언제든 바꿀 수 있음)
//
// 💡 입력칸에는 지금 이름(LINE·카카오 닉네임)이 미리 채워져 있어서, 그대로 쓰고 싶으면 버튼만 누르면 됩니다.

import { useState } from "react";
import { PRIMARY_BUTTON } from "@/components/ui/styles";
import { useMessages } from "@/i18n/LocaleContext";
import { initialNickname, NICKNAME_MAX, validateNickname } from "@/lib/village/nickname";
import { UI_COLORS } from "@/lib/village/theme";

interface NicknameFormProps {
  /** 지금 보이는 내 이름 (입력칸에 미리 채웁니다) */
  currentName: string;
  /** 확인 버튼을 눌렀을 때. 저장이 끝날 때까지 기다립니다 */
  onConfirm: (nickname: string) => Promise<void>;
}

export default function NicknameForm({ currentName, onConfirm }: NicknameFormProps) {
  const t = useMessages();
  const [nickname, setNickname] = useState(() => initialNickname(currentName));
  // 저장 중에는 버튼을 잠가 두 번 눌리지 않게 합니다
  const [saving, setSaving] = useState(false);
  const check = validateNickname(nickname);

  const handleSubmit = async () => {
    if (check !== "ok" || saving) return;
    setSaving(true);
    try {
      await onConfirm(nickname.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        // 기본 동작(페이지 새로고침)을 막습니다
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <p className="text-sm leading-relaxed" style={{ color: UI_COLORS.muted }}>
        {t.nicknameDesc}
      </p>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t.nicknamePlaceholder}
          aria-label={t.nickname}
          autoComplete="off"
          // text-base(16px): 아이폰이 입력할 때 화면을 확대하지 않는 최소 글자 크기
          className="h-13 w-full rounded-2xl border border-transparent px-4 text-base outline-none transition-colors placeholder:text-[#a9aec0] focus:border-[#232b52]/30"
          style={{ backgroundColor: UI_COLORS.surface }}
        />
        <div className="flex justify-between gap-3 text-xs">
          <p role="status" className="font-semibold" style={{ color: UI_COLORS.accent }}>
            {check === "tooLong" ? t.nicknameTooLong.replace("{max}", String(NICKNAME_MAX)) : ""}
          </p>
          <p className="shrink-0 tabular-nums" style={{ color: check === "tooLong" ? UI_COLORS.accent : UI_COLORS.muted }}>
            {[...nickname.trim()].length} / {NICKNAME_MAX}
          </p>
        </div>
      </div>
      <button type="submit" className={PRIMARY_BUTTON} disabled={check !== "ok" || saving}>
        {t.nicknameConfirm}
      </button>
    </form>
  );
}
