// 서버에서 "지금 접속한 사람의 로그인 상태로" Supabase에 연결할 때 쓰는 도구입니다. (로드맵 Task 007)
// 💡 로그인 상태는 브라우저가 요청마다 함께 보내는 쿠키에 들어 있습니다. 그 쿠키를 읽어 연결을 만듭니다.
//    이 연결로 한 일은 그 사람의 권한으로 처리되어, 데이터베이스 보안 규칙(RLS)이 그대로 적용됩니다.
//
// Next.js 16: cookies()는 Promise라서 await로 꺼냅니다.
// 공식 안내: https://supabase.com/docs/guides/auth/server-side/creating-a-client

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

export async function createClient() {
  // 💡 connection(): "여기서부터는 사람이 실제로 들어왔을 때만 계산합니다"라고 Next.js에 알려 주는 약속입니다.
  //    Supabase는 로그인 기간이 지났는지 보려고 안에서 "지금 시각"(Date.now)을 읽습니다.
  //    Next.js는 화면을 미리 만들어 둘 수 있는지 검사하다가 이런 값을 만나면 개발 화면에 경고를 띄우므로,
  //    로그인 정보를 다루기 전에 먼저 알려 둡니다.
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = supabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 화면을 그리는 부품(Server Component)에서는 쿠키를 쓸 수 없어 여기로 옵니다.
          // 로그인 기간 늘리기는 proxy.ts가 맡고 있으므로 무시해도 됩니다.
        }
      },
    },
  });
}
