// 서버에서 "지금 접속한 사람이 누구인지", "어느 마을에 사는지"를 읽는 곳입니다. (로드맵 Task 007)
//
// 💡 cacheComponents 모드라서, 이 함수들(쿠키를 읽음)은 꼭 <Suspense> 안쪽의 부품에서 불러야 합니다.
//    (node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md)

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { LAST_VILLAGE_COOKIE, loginUrl } from "./next";

/**
 * 지금 로그인한 사람의 번호. 로그인하지 않았으면 null.
 * 💡 getClaims: 쿠키에 든 출입증이 진짜인지(서명) 확인합니다. 쿠키는 누구나 꾸며 낼 수 있어서,
 *    서버에서는 확인 없이 읽는 getSession을 믿으면 안 됩니다. (Supabase 공식 안내)
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

/**
 * 내가 속한 마을 번호들. 가장 최근에 입주한 마을이 맨 앞.
 * 로그인한 사람의 권한으로 읽으므로 데이터베이스 보안 규칙(RLS)이 적용됩니다.
 */
export async function getMyVillageIds(userId: string, client?: SupabaseClient<Database>): Promise<string[]> {
  // client: 방금 로그인 상태를 만든 연결이 있으면 그것을 이어서 씁니다 (로그인 처리 직후)
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("residents")
    .select("village_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw new Error(`내 마을 목록을 읽지 못했습니다: ${error.message}`);
  return data.map((row) => row.village_id);
}

/** 쿠키에 기억해 둔 "마지막으로 들어간 마을" 번호 (없으면 null) */
export async function getLastVillageId(): Promise<string | null> {
  return (await cookies()).get(LAST_VILLAGE_COOKIE)?.value ?? null;
}

/**
 * 이 마을의 주민만 지나가게 합니다. (마을 화면에서 부릅니다)
 * - 로그인하지 않았으면 → 로그인 화면 (로그인 뒤 이 마을로 돌아옴)
 * - 주민이 아니면 → 안내와 함께 내 마을로. 속한 마을이 없으면 마을 만들기로
 * - 주민이면 → 그 사람의 사용자 번호를 돌려줍니다
 *
 * 💡 redirect()는 "다른 주소로 보내기"입니다. 부르는 순간 아래 코드는 실행되지 않습니다.
 * 💡 문지기(proxy.ts)도 로그인 여부를 보지만, 그것은 빠른 1차 확인입니다.
 *    "이 마을의 주민인가"처럼 데이터가 걸린 확인은 이렇게 화면 쪽에서 한 번 더 합니다. (Next.js 공식 안내)
 */
export async function requireResident(villageId: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect(loginUrl({ next: `/village/${villageId}` }));

  const villageIds = await getMyVillageIds(userId);
  if (villageIds.includes(villageId)) return userId;
  redirect(villageIds.length > 0 ? `/village/${villageIds[0]}?notice=not_resident` : "/villages/new?notice=not_resident");
}
