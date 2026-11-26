"use client";

// 초대 링크를 눌렀을 때 처음 보이는 화면의 내용입니다. (F012·F013)
// 어느 마을에 초대받았는지 보여 주고, 버튼을 누르면 로그인(이미 했으면 바로 입주)으로 갑니다.
// 초대 코드에 해당하는 마을이 없으면 "사용할 수 없는 초대 링크" 안내를 보여 줍니다.

import Link from "next/link";
import { MailOpen, MailX } from "lucide-react";
import { useMessages } from "@/i18n/LocaleContext";
import { UI_COLORS } from "@/lib/village/theme";
import type { InviteError } from "@/lib/village/join";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";

interface InviteLandingProps {
  /** 초대 코드 (주소의 /invite/ 뒤 부분) */
  code: string;
  /** 초대받은 마을 이름. 그런 마을이 없으면 undefined */
  villageName?: string;
  /** 이미 로그인한 사람인지 (그러면 로그인 화면을 건너뛰고 바로 입주합니다) */
  loggedIn: boolean;
  /** 입주하려다 실패해서 돌아왔을 때의 이유 */
  error?: InviteError;
}

const CARD = "flex w-full max-w-sm flex-col items-center gap-3 rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_12px_48px_rgba(20,26,54,0.14)]";

export function InviteLanding({ code, villageName, loggedIn, error }: InviteLandingProps) {
  const t = useMessages();

  // ── 없는 초대 코드 ──
  if (!villageName) {
    return (
      <div className={CARD} style={{ color: UI_COLORS.navy }}>
        <span
          className="flex size-16 items-center justify-center rounded-[22px]"
          style={{ backgroundColor: UI_COLORS.surface, color: UI_COLORS.muted }}
        >
          <MailX className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{t.inviteInvalidTitle}</h1>
        <p className="text-sm" style={{ color: UI_COLORS.muted }}>
          {t.inviteInvalidDesc}
        </p>
        <Link href="/" className={`${SECONDARY_BUTTON} mt-3`}>
          {t.backToStart}
        </Link>
      </div>
    );
  }

  const enterHref = loggedIn
    ? `/invite/${encodeURIComponent(code)}/join`
    : // 초대 코드를 로그인 화면에 넘깁니다 (로그인이 끝나면 자동으로 입주)
      `/?invite=${encodeURIComponent(code)}`;

  return (
    <div className={CARD} style={{ color: UI_COLORS.navy }}>
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
      {/* 입주하려다 실패해서 돌아온 경우의 안내 (화면 읽기 도구가 바로 읽어 주도록 role="alert") */}
      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: UI_COLORS.accent }}>
          {error === "couple_full" ? t.inviteCoupleFull : t.inviteJoinFailed}
        </p>
      )}
      {/* 가득 찬 마을에는 들어갈 수 없으므로 버튼을 보여 주지 않습니다 */}
      {error !== "couple_full" && (
        // 💡 <Link>가 아니라 일반 <a>를 씁니다. <Link>는 화면에 보이기만 해도 그 주소를 미리 불러오는데,
        //    입주 주소는 "불러오는 것 자체가 입주"라서 누르기 전에 불리면 안 됩니다.
        <a href={enterHref} className={`${PRIMARY_BUTTON} mt-3`}>
          {t.inviteEnter}
        </a>
      )}
      <p className="text-xs" style={{ color: UI_COLORS.muted }}>
        {t.appName}
      </p>
    </div>
  );
}
