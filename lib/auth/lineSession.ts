// 🔒 "LINE에서 확인된 사람"을 Supabase에 로그인시키는 서버 전용 코드입니다. (로드맵 Task 007)
//
// 순서
//  1) 이 LINE 사용자의 Supabase 계정이 없으면 만듭니다 (가짜 이메일 주소 사용 → lineUrls.ts의 lineEmail)
//  2) 사용자 줄(users 표)이 없으면 만듭니다
//  3) 관리자 기능으로 "1회용 로그인 표"를 만들고, 바로 그 표를 써서 로그인 상태(쿠키)를 만듭니다
//     (11.26 실제로 확인: 메일은 발송되지 않고, 표는 한 번만 쓸 수 있습니다)

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { ensureUser } from "./ensureUser";
import { lineEmail } from "./lineUrls";

/**
 * LINE 사용자를 로그인시키고 그 사람의 Supabase 계정 번호를 돌려줍니다.
 * - supabase: 접속한 사람의 쿠키에 연결된 연결(lib/supabase/server.ts). 로그인 상태가 이 쿠키에 저장됩니다
 */
export async function signInLineUser(supabase: SupabaseClient<Database>, profile: { sub: string; name: string | null }): Promise<string> {
  const admin = createAdminClient();
  const email = lineEmail(profile.sub);

  // 1) 이미 가입한 사람인지 찾기
  const { data: existing, error: findError } = await admin
    .from("users")
    .select("id")
    .eq("auth_provider", "line")
    .eq("provider_user_id", profile.sub)
    .maybeSingle();
  if (findError) throw new Error(`LINE 사용자 찾기 실패: ${findError.message}`);

  if (!existing) {
    // 처음 온 사람: 로그인 계정 만들기. email_confirm: 메일 확인 절차를 건너뜁니다 (가짜 주소라 메일을 받을 수 없음)
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { provider: "line", name: profile.name },
    });
    // "이미 있는 주소"라는 오류는 괜찮습니다 (예전에 계정만 만들어지고 다음 단계에서 실패한 경우). 아래에서 이어서 복구합니다
    if (createError && createError.code !== "email_exists") {
      throw new Error(`LINE 계정 만들기 실패: ${createError.message}`);
    }
  }

  // 3-a) 1회용 로그인 표 만들기. 메일을 보내지 않고 표만 돌려받습니다
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  const userId = link?.user?.id;
  if (linkError || !tokenHash || !userId) {
    throw new Error(`로그인 표 만들기 실패: ${linkError?.message ?? "표가 비어 있음"}`);
  }
  if (existing && existing.id !== userId) {
    throw new Error("LINE 사용자와 로그인 계정이 서로 맞지 않습니다");
  }

  // 2) 사용자 줄 만들기 (이미 있으면 그대로)
  await ensureUser({ id: userId, provider: "line", providerUserId: profile.sub, name: profile.name });

  // 3-b) 표를 써서 로그인 상태 만들기 → 쿠키에 저장됩니다
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (verifyError || verified.user?.id !== userId) {
    throw new Error(`로그인 상태 만들기 실패: ${verifyError?.message ?? "다른 사용자"}`);
  }
  return userId;
}
