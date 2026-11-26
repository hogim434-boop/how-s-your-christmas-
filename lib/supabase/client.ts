// 브라우저(화면)에서 Supabase에 연결할 때 쓰는 도구입니다. (로드맵 Task 007)
// 💡 "use client" 파일(버튼을 누르는 화면 부품)에서만 가져다 씁니다.
//    로그인 상태는 브라우저 쿠키에 저장되고, 서버 쪽 연결(server.ts)과 같은 쿠키를 함께 씁니다.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

export function createClient() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
