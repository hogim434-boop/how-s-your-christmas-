"use client";

// 로그인 화면의 내용입니다. (F010 로그인, F012 초대 링크, F015 coming soon)
// ⚠️ 지금은 "눌러 볼 수 있는 틀"입니다. 버튼을 누르면 진짜 로그인 없이 다음 화면으로 넘어갑니다.
//    진짜 LINE·카카오 로그인은 로드맵 Task 007에서 연결합니다.
//  - 초대 링크로 왔으면: 마을 이름을 보여 주고, 로그인하면 그 마을(꾸미기 창)로 갑니다
//  - 그냥 왔으면: 로그인하면 마을 만들기 화면으로 갑니다

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useMessages } from "@/i18n/LocaleContext";
import { UI_COLORS } from "@/lib/village/theme";

interface LoginScreenProps {
  /** 초대 링크의 코드 (초대로 온 것이 아니면 없음) */
  inviteCode?: string;
  /** 초대받은 마을의 이름 */
  inviteVillageName?: string;
}

/** 로그인 버튼 색: 각 서비스의 대표 색 */
const BRAND = {
  line: { backgroundColor: "#06C755", color: "#ffffff" },
  kakao: { backgroundColor: "#FEE500", color: "#191600" },
} as const;

export function LoginScreen({ inviteCode, inviteVillageName }: LoginScreenProps) {
  const t = useMessages();
  // 로그인한 뒤에 갈 곳 (진짜 로그인이 생기면 서버가 정해 줍니다)
  const nextHref = inviteCode ? "/village/demo?customize=1" : "/villages/new";

  return (
    // pointer-events-none: 빈 곳은 뒤의 3D 장면을 그대로 만질 수 있게. 버튼만 누를 수 있게 켭니다
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-14">
      <div className="flex flex-col items-center gap-2 text-center" style={{ color: UI_COLORS.navy }}>
        <h1 className="text-3xl font-bold leading-tight">{t.appName}</h1>
        <p className="text-sm opacity-80">{t.tagline}</p>

        {inviteVillageName && (
          <p
            className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-semibold shadow-[0_4px_16px_rgba(20,26,54,0.14)]"
          >
            {t.invitedTo.replace("{name}", inviteVillageName)}
          </p>
        )}
      </div>

      {/* 버튼 묶음: 뒤의 3D 장면 위에서도 글자가 잘 보이도록 반투명 흰 판 위에 올립니다 */}
      <div className="pointer-events-auto mx-auto flex w-full max-w-sm flex-col gap-3 rounded-[28px] bg-white p-4 shadow-[0_12px_48px_rgba(20,26,54,0.16)]">
        <Link
          href={nextHref}
          className="flex h-13 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition active:scale-[0.98]"
          style={BRAND.line}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          {t.loginWithLine}
        </Link>
        <Link
          href={nextHref}
          className="flex h-13 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition active:scale-[0.98]"
          style={BRAND.kakao}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          {t.loginWithKakao}
        </Link>
        <p className="px-2 pt-1 text-center text-xs leading-relaxed" style={{ color: UI_COLORS.muted }}>
          {t.loginNotifyHint}
          <br />
          {t.appComingSoon}
        </p>
      </div>
    </div>
  );
}
