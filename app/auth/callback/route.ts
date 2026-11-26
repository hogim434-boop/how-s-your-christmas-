// 카카오 로그인을 마치고 돌아오는 주소입니다. 주소: /auth/callback  (로드맵 Task 007)
//
// 흐름
//  ① 로그인 화면에서 "카카오로 시작하기" → Supabase → 카카오 로그인 화면
//  ② 카카오 → Supabase → 여기로 돌아옴 (주소에 ?code=1회용 코드 가 붙어 있음)
//  ③ 그 코드를 진짜 로그인 상태(쿠키)로 바꿈
//  ④ 처음 온 사람이면 사용자 줄을 만들고, 알맞은 화면으로 보냄
//
// 💡 Route Handler: 화면이 아니라 "요청을 받아 처리하고 응답하는" 서버 코드입니다. 파일 이름은 route.ts.
// 공식 안내: https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao

import type { NextRequest } from "next/server";
import { ensureUser } from "@/lib/auth/ensureUser";
import { destinationAfterLogin, redirectTo } from "@/lib/auth/finish";
import { kakaoProfile } from "@/lib/auth/kakao";
import { loginUrl, type AuthError } from "@/lib/auth/next";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // 로그인 전에 가려던 곳과 초대 코드 (로그인 화면이 이 주소에 붙여서 보냈습니다)
  const from = { next: params.get("next"), invite: params.get("invite") };
  // 실패하면 로그인 화면으로 돌려보내고, 왜 실패했는지 안내를 붙입니다
  const fail = (error: AuthError) => redirectTo(request, loginUrl({ ...from, error }));

  // 카카오 화면에서 "취소"를 누르면 error=access_denied 로 돌아옵니다
  const oauthError = params.get("error");
  if (oauthError) return fail(oauthError === "access_denied" ? "cancelled" : "failed");

  const code = params.get("code");
  if (!code) return fail("failed");

  try {
    const supabase = await createClient();
    // ③ 1회용 코드 → 로그인 상태. 성공하면 쿠키가 저장됩니다
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return fail("failed");

    const profile = kakaoProfile(data.user);
    if (!profile) {
      // 카카오 정보를 읽지 못하면 사용자 줄을 만들 수 없으므로, 반쯤 로그인된 상태로 두지 않고 되돌립니다
      await supabase.auth.signOut();
      return fail("failed");
    }

    try {
      // ④ 처음 로그인이면 사용자 줄 만들기 (이미 있으면 그대로)
      await ensureUser({ id: data.user.id, provider: "kakao", providerUserId: profile.providerUserId, name: profile.name });
    } catch (cause) {
      await supabase.auth.signOut();
      throw cause;
    }

    return redirectTo(request, await destinationAfterLogin(supabase, data.user.id, from));
  } catch (cause) {
    console.error("[auth/callback] 카카오 로그인 처리 실패", cause);
    return fail("failed");
  }
}
