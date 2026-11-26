// 요청이 들어올 때마다 "로그인 유효 기간"을 확인하고, 끝나 가면 새로 받아 쿠키에 넣어 주는 곳입니다. (로드맵 Task 007)
//
// 💡 왜 필요한가요?
//    로그인하면 짧게만 유효한 "출입증"(약 1시간)과, 출입증을 새로 받는 "갱신표"가 쿠키에 저장됩니다.
//    화면을 그리는 서버 부품은 쿠키를 고쳐 쓸 수 없어서, 화면보다 먼저 실행되는 이곳(proxy)이 대신 갱신합니다.
// 공식 안내: https://supabase.com/docs/guides/auth/server-side/creating-a-client

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

/**
 * 로그인 상태를 확인(필요하면 갱신)합니다.
 * - response: 갱신된 쿠키가 담긴 응답. 꼭 이것을 돌려줘야 브라우저의 쿠키가 바뀝니다
 * - userId: 로그인한 사람의 번호 (로그인하지 않았으면 null)
 * - withCookies: 다른 응답(다른 주소로 보내기 등)을 돌려줄 때, 갱신된 쿠키를 옮겨 담아 주는 함수
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // 1) 뒤이어 실행될 화면 부품이 새 쿠키를 읽도록 요청에 넣고
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        // 2) 브라우저의 쿠키도 바뀌도록 응답에 넣습니다
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // ⚠️ 위에서 연결을 만든 직후 바로 getClaims()를 불러야 합니다 (공식 안내: 사이에 다른 코드를 넣으면 로그인이 풀리는 문제가 생길 수 있음)
  // getClaims: 쿠키의 출입증이 진짜인지(서명) 확인하고 그 안의 정보를 꺼냅니다. 쿠키는 누구나 꾸며 낼 수 있어서 꼭 확인이 필요합니다.
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  const withCookies = (other: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => other.cookies.set(cookie));
    return other;
  };

  return { response, userId, withCookies };
}
