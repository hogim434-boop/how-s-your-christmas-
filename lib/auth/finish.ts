// 로그인 처리(카카오·LINE)의 마지막 단계에서 함께 쓰는 서버 도우미입니다. (로드맵 Task 007)

import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { resolveAfterLogin } from "./next";
import { getLastVillageId, getMyVillageIds } from "./session";

/**
 * 우리 앱의 주소 앞부분 (예: http://localhost:3000, https://우리앱.vercel.app).
 * 💡 배포하면 요청이 중간 서버를 거쳐 들어와서 주소가 안쪽 주소로 보일 수 있습니다.
 *    그때는 중간 서버가 적어 준 "원래 주소"(x-forwarded-host)를 씁니다. (Supabase 공식 예시와 같은 방식)
 */
export function appOrigin(request: Request): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return origin;
}

/** 우리 앱 안의 다른 주소로 보내는 응답 */
export function redirectTo(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, appOrigin(request)));
}

/**
 * 방금 로그인한 사람을 보낼 주소를 정합니다.
 * - supabase: 방금 로그인 상태가 만들어진 "그 연결"을 넘겨받아 씁니다 (그 사람의 권한으로 마을 목록을 읽기 위해)
 */
export async function destinationAfterLogin(
  supabase: SupabaseClient<Database>,
  userId: string,
  from: { next?: string | null; invite?: string | null },
): Promise<string> {
  return resolveAfterLogin({
    next: from.next,
    inviteCode: from.invite,
    villageIds: await getMyVillageIds(userId, supabase),
    lastVillageId: await getLastVillageId(),
  });
}
