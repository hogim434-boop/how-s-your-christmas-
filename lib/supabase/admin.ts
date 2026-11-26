// 🔒 "비밀 키"로 Supabase에 연결하는 도구입니다. 서버에서만 씁니다. (로드맵 Task 007)
//
// 💡 비밀 키는 모든 보안 규칙(RLS)을 건너뛰는 만능 열쇠입니다.
//    그래서 꼭 필요한 일에만 씁니다:
//     - 처음 로그인한 사람의 users 줄 만들기 (화면에서는 만들 수 없게 막아 두었습니다)
//     - LINE으로 로그인한 사람의 계정 찾기·만들기와 로그인 상태 만들기
// ⚠️ 이 파일을 "use client" 파일에서 가져오면 안 됩니다. 아래 server-only 줄이 그런 실수를 빌드 오류로 막아 줍니다.

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Supabase 비밀 키가 없습니다. .env.local 파일에 SUPABASE_SECRET_KEY 를 넣고 서버를 다시 켜 주세요. (Vercel에 배포한 경우: Project Settings → Environment Variables에 넣고 다시 배포)");
  }
  return createClient<Database>(supabaseEnv().url, secretKey, {
    // 이 연결은 "특정 사용자"가 아니라 서버 자신이므로, 로그인 상태를 저장하거나 갱신하지 않습니다
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
