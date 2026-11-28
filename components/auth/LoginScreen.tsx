"use client";

// 로그인 화면의 내용입니다. (F010 로그인, F012 초대 링크, F015 coming soon)
// 버튼을 누르면 진짜 LINE·카카오 로그인이 시작됩니다. (로드맵 Task 007)
//  - LINE: 우리 앱의 서버 주소(/auth/line/start)로 이동 → LINE 로그인 화면 → /auth/line/callback
//  - 카카오: /auth/kakao/start → 카카오 로그인 화면 → /auth/kakao/callback (11.27: LINE처럼 우리 서버가 직접 통신)
//  로그인이 끝나면 서버가 알맞은 화면(가려던 곳·초대받은 마을·내 마을·마을 만들기)으로 보내 줍니다.

import type { CSSProperties } from "react";
import { DM_Serif_Display } from "next/font/google";
import { MessageCircle } from "lucide-react";
import { LanguageButton } from "@/components/LanguageButton";
import { KakaoLoginButton } from "./KakaoLoginButton";
import { useMessages } from "@/i18n/LocaleContext";
import type { Messages } from "@/i18n/messages";
import type { AuthError, Notice } from "@/lib/auth/next";

// 로고 전용 글꼴: 굵기 차이가 뚜렷한 세리프(획 끝에 삐침이 있는 글꼴)의 기울임꼴.
// 💡 next/font: 글꼴 파일을 우리 사이트에서 직접 내려 주어, 글꼴이 늦게 바뀌며 화면이 덜컹거리는 일을 막아 줍니다.
const logoFont = DM_Serif_Display({ weight: "400", style: "italic", subsets: ["latin"], display: "swap" });

/** 화면 위 글자·장식 색 (밤하늘 위에 올라갑니다) */
const TITLE_COLORS = {
  /** 트리 꼭대기 별과 같은 샴페인 금색 */
  gold: "#f0d9a4",
  /** 안내 상자 바탕: 밤하늘색을 살짝 비치게 */
  glass: "rgba(20, 26, 54, 0.55)",
} as const;

/** 등장 움직임: 아래에서 살짝 떠오르며 나타납니다 ("움직임 줄이기"를 켠 사람에게는 움직이지 않습니다) */
const RISE = "motion-safe:animate-[title-rise_900ms_cubic-bezier(0.2,0.8,0.2,1)_both]";
/** 등장을 ms(밀리초)만큼 늦춥니다. 위에서부터 차례로 나타나게 하려고 요소마다 다른 값을 줍니다 */
const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

interface LoginScreenProps {
  /** 초대 링크의 코드 (초대로 온 것이 아니면 없음) */
  inviteCode?: string;
  /** 초대받은 마을의 이름 */
  inviteVillageName?: string;
  /** 로그인 전에 가려던 주소 (로그인 뒤 그곳으로 돌아갑니다) */
  next?: string;
  /** 로그인 실패·취소 안내 종류 */
  error?: AuthError;
  /** 그 밖의 안내 종류 */
  notice?: Notice;
}

/** 안내 종류 → 보여 줄 문구 */
function noticeText(t: Messages, error?: AuthError, notice?: Notice): string | null {
  if (error === "cancelled") return t.loginCancelled;
  if (error === "state_mismatch") return t.loginStateMismatch;
  if (error === "config") return t.loginConfigError;
  if (error === "failed") return t.loginFailed;
  if (notice === "not_resident") return t.notResidentNotice;
  return null;
}

/** 로그인 버튼 색: 각 서비스의 대표 색 */
const BRAND = {
  line: { backgroundColor: "#06C755", color: "#ffffff" },
  kakao: { backgroundColor: "#FEE500", color: "#191600" },
} as const;

export function LoginScreen({ inviteCode, inviteVillageName, next, error, notice }: LoginScreenProps) {
  const t = useMessages();
  // 로그인 뒤 돌아갈 곳과 초대 코드를 주소 뒤(?next=...&invite=...)에 붙여 서버로 넘깁니다
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (inviteCode) params.set("invite", inviteCode);
  const query = params.toString() ? `?${params.toString()}` : "";

  const message = noticeText(t, error, notice);

  return (
    // pointer-events-none: 배경은 구경만 하는 화면이라, 버튼만 누를 수 있게 켭니다
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between text-white">
      {/* 위·아래 그늘: 카드 상자 없이도 글자가 또렷하게 보이도록, 밤하늘색을 위아래에서 옅게 덮습니다 */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-[#0d1330]/80 via-[#0d1330]/35 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#0a0f28]/90 via-[#0a0f28]/45 to-transparent" />

      {/* ── 오른쪽 위: 언어 고르기(지구본) 버튼 ── 로그인 전에도 언어를 바꿀 수 있게 합니다 (11.27 사용자 요청) */}
      {/* z-10: 아래 로고·안내 글자보다 위에 떠서, 펼친 목록이 가려지지 않게 합니다. safe-area: 휴대폰 위쪽 노치를 피합니다 */}
      {/* 자리를 잡는 상자(absolute)와 버튼(안에서 목록의 기준점이 되는 relative)을 나눕니다. 한 요소에 둘을 같이 쓰면 자리가 어긋납니다 */}
      <div className={`${RISE} pointer-events-auto absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-10`}>
        <LanguageButton />
      </div>

      {/* ── 위: 로고 ── */}
      <header className="relative flex flex-col items-center px-6 pt-[max(3.25rem,calc(env(safe-area-inset-top)+2rem))] text-center">
        {/* 작은 별: 트리 꼭대기 별(✦)과 같은 모양 */}
        <span aria-hidden="true" className={`${RISE} text-lg leading-none`} style={{ ...delay(0), color: TITLE_COLORS.gold }}>
          ✦
        </span>
        {/* 화면 읽기 도구는 h1을 "How's your Christmas" 한 문장으로 읽습니다 */}
        <h1 aria-label={t.appName} style={delay(120)} className={`${RISE} mt-3 flex flex-col items-center`}>
          <span aria-hidden="true" className="text-[11px] font-semibold uppercase tracking-[0.42em] text-white/80 [font-family:var(--font-sans)]">
            How&rsquo;s your
          </span>
          <span
            aria-hidden="true"
            className={`${logoFont.className} mt-1 text-[3.5rem] leading-none sm:text-7xl`}
            style={{ color: "#fffaf0", textShadow: "0 2px 24px rgba(255, 214, 140, 0.45), 0 1px 2px rgba(10, 15, 40, 0.6)" }}
          >
            Christmas
          </span>
        </h1>
        {/* 한 줄 소개: 양옆의 가는 선은 장식입니다 */}
        <p style={delay(260)} className={`${RISE} mt-4 flex items-center gap-3 text-balance text-[13px] text-white/85`}>
          <span aria-hidden="true" className="h-px w-6 shrink-0 bg-white/35" />
          {t.tagline}
          <span aria-hidden="true" className="h-px w-6 shrink-0 bg-white/35" />
        </p>

        {inviteVillageName && (
          <p
              className={`${RISE} mt-5 rounded-full border px-5 py-2.5 text-sm font-semibold backdrop-blur-md`}
            style={{ ...delay(380), backgroundColor: TITLE_COLORS.glass, borderColor: `${TITLE_COLORS.gold}66`, color: TITLE_COLORS.gold }}
          >
            {t.invitedTo.replace("{name}", inviteVillageName)}
          </p>
        )}

        {/* 로그인 실패·취소, 주민이 아닌 마을 접근 같은 안내. role="alert": 화면 읽기 도구가 바로 읽어 줍니다 */}
        {message && (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md"
            style={{ backgroundColor: TITLE_COLORS.glass }}
          >
            {message}
          </p>
        )}
      </header>

      {/* ── 아래: 로그인 버튼 ── 흰 카드 없이 배경 위에 바로 올립니다 (참고: 동물의 숲·젤다의 타이틀 화면) */}
      <div className="pointer-events-auto relative mx-auto flex w-full max-w-sm flex-col gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* 일반 <a> 태그를 씁니다. Next.js의 <Link>는 주소를 미리 불러오는데, 이 주소는 불러오는 순간 로그인이 시작되기 때문입니다 */}
        <a
          href={`/auth/line/start${query}`}
          className={`${RISE} flex h-14 items-center justify-center gap-2 rounded-full text-[15px] font-semibold shadow-[0_10px_30px_rgba(6,199,85,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-105 active:scale-[0.98]`}
          style={{ ...delay(520), ...BRAND.line }}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          {t.loginWithLine}
        </a>
        {/* 카카오: 휴대폰에서 카카오톡 앱으로 넘어가도록 카카오 스크립트로 시작합니다. 스크립트를 못 쓰면 LINE처럼 우리 서버의 시작 주소로 갑니다 */}
        <KakaoLoginButton
          query={query}
          className={`${RISE} flex h-14 items-center justify-center gap-2 rounded-full text-[15px] font-semibold shadow-[0_10px_30px_rgba(254,229,0,0.25),inset_0_1px_0_rgba(255,255,255,0.5)] transition hover:brightness-105 active:scale-[0.98]`}
          style={{ ...delay(620), ...BRAND.kakao }}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          {t.loginWithKakao}
        </KakaoLoginButton>
        <p style={delay(760)} className={`${RISE} px-2 pt-2 text-center text-xs leading-relaxed text-white/75`}>
          {t.loginNotifyHint}
        </p>
        {/* 게임 타이틀 화면의 구석 글자(버전·저작권 표시)처럼 작고 흐리게 */}
        <p style={delay(760)} className={`${RISE} text-center text-[10px] uppercase tracking-[0.3em] text-white/45 [font-family:var(--font-sans)]`}>
          {t.appComingSoon}
        </p>
      </div>

    </div>
  );
}
