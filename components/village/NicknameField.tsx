"use client";

// 닉네임 입력칸 한 묶음(이름표 + 입력칸 + 글자 수)입니다. (11.27 사용자 요청)
// 마을 만들기 화면과 초대 화면이 함께 씁니다. → 닉네임은 "마을을 만들 때 / 초대받아 들어갈 때" 정합니다.
//
// 💡 name="nickname": 초대 화면에서는 이 칸이 <form> 안에 있어서, 버튼을 누르면 주소 뒤에 ?nickname=값 으로 붙어 서버로 갑니다.

import { useMessages } from "@/i18n/LocaleContext";
import { NICKNAME_MAX, validateNickname } from "@/lib/village/nickname";
import { UI_COLORS } from "@/lib/village/theme";

interface NicknameFieldProps {
  /** 입력칸의 id (이름표와 연결하는 데 씁니다. 한 화면에 하나씩 달라야 합니다) */
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** true면 글자 수를 이름표 줄 오른쪽에 두어 높이를 줄입니다 (마을 만들기 화면: 한 화면에 다 들어오게) */
  compact?: boolean;
}

export function NicknameField({ id, value, onChange, compact = false }: NicknameFieldProps) {
  const t = useMessages();
  const check = validateNickname(value);
  const count = (
    <p className="shrink-0 text-xs tabular-nums" style={{ color: check === "tooLong" ? UI_COLORS.accent : UI_COLORS.muted }}>
      {[...value.trim()].length} / {NICKNAME_MAX}
    </p>
  );
  const tooLong = check === "tooLong" ? t.nicknameTooLong.replace("{max}", String(NICKNAME_MAX)) : "";
  if (compact) {
    return (
      <div className="flex w-full flex-col gap-1.5 text-left">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-sm font-semibold">
            {t.nicknameLabel}
          </label>
          {count}
        </div>
        <input
          id={id}
          name="nickname"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.nicknamePlaceholder}
          autoComplete="off"
          className="h-12 w-full rounded-2xl border border-transparent px-4 text-base outline-none transition-colors placeholder:text-[#a9aec0] focus:border-[#232b52]/30"
          style={{ backgroundColor: UI_COLORS.surface }}
        />
        {/* 안내는 있을 때만 자리를 차지합니다 */}
        <p role="status" className="text-xs font-semibold empty:hidden" style={{ color: UI_COLORS.accent }}>
          {tooLong}
        </p>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <label htmlFor={id} className="text-sm font-semibold">
        {t.nicknameLabel}
      </label>
      <input
        id={id}
        name="nickname"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.nicknamePlaceholder}
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
          {[...value.trim()].length} / {NICKNAME_MAX}
        </p>
      </div>
    </div>
  );
}
