"use client";

// 초대 링크를 눌렀을 때 처음 보이는 화면의 내용입니다. (F012)
// 어느 마을에 초대받았는지 보여 주고, 버튼을 누르면 로그인 화면으로 갑니다.
// (로그인 뒤 그 마을에 자동으로 입주하는 처리는 로드맵 Task 008)

import Link from "next/link";
import { MailOpen } from "lucide-react";
import { useMessages } from "@/i18n/LocaleContext";
import { UI_COLORS } from "@/lib/village/theme";
import { PRIMARY_BUTTON } from "@/components/ui/styles";

interface InviteLandingProps {
  /** 초대 코드 (주소의 /invite/ 뒤 부분) */
  code: string;
  villageName: string;
}

export function InviteLanding({ code, villageName }: InviteLandingProps) {
  const t = useMessages();
  return (
    <div
      className="flex w-full max-w-sm flex-col items-center gap-3 rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_12px_48px_rgba(20,26,54,0.14)]"
      style={{ color: UI_COLORS.navy }}
    >
      <span
        className="flex size-16 items-center justify-center rounded-[22px]"
        style={{ backgroundColor: `${UI_COLORS.accent}1a`, color: UI_COLORS.accent }}
      >
        <MailOpen className="size-8" aria-hidden="true" />
      </span>
      <p className="mt-1 text-sm" style={{ color: UI_COLORS.muted }}>
        {t.inviteLandingTitle}
      </p>
      <h1 className="break-words text-2xl font-bold tracking-tight">{villageName}</h1>
      <Link
        // 초대 코드를 로그인 화면에 넘깁니다 (주소에 쓸 수 없는 글자는 안전하게 바꿈)
        href={`/?invite=${encodeURIComponent(code)}`}
        className={`${PRIMARY_BUTTON} mt-3`}
      >
        {t.inviteEnter}
      </Link>
      <p className="text-xs" style={{ color: UI_COLORS.muted }}>
        {t.appName}
      </p>
    </div>
  );
}
