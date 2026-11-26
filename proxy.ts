// 모든 화면 요청이 화면보다 "먼저" 거쳐 가는 문지기입니다. (로드맵 Task 007)
// 💡 Next.js 16부터 이 파일 이름은 proxy.ts입니다 (예전 이름: middleware.ts).
//
// 하는 일
//  1) 로그인 유효 기간 확인·갱신 (lib/supabase/proxy.ts)
//  2) 로그인하지 않은 사람이 마을·마을 만들기 주소로 오면 로그인 화면으로 보냄 (원래 가려던 주소는 ?next= 로 기억)
//  3) 로그인한 사람이 마을에 들어가면 "마지막으로 들어간 마을"을 쿠키에 기억 (다음 로그인 때 그 마을로)
//
// ⚠️ 여기서는 "로그인했는가"까지만 봅니다. "이 마을의 주민인가"는 마을 화면에서 확인합니다 (lib/auth/session.ts의 requireResident).

import { NextResponse, type NextRequest } from "next/server";
import { DEMO_VILLAGE_ID, LAST_VILLAGE_COOKIE, devToolsEnabled, isProtectedPath, loginUrl, villageIdFromPath } from "@/lib/auth/next";
import { updateSession } from "@/lib/supabase/proxy";

/** "마지막 마을" 쿠키를 기억하는 기간: 1년 (초) */
const LAST_VILLAGE_MAX_AGE = 60 * 60 * 24 * 365;

export async function proxy(request: NextRequest) {
  const { response, userId, withCookies } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // 연습용 마을(/village/demo)은 개발할 때만 엽니다. 배포된 서비스에서는 처음 화면으로 보냅니다 (Task 010)
  if (!devToolsEnabled() && (pathname === `/village/${DEMO_VILLAGE_ID}` || pathname.startsWith(`/village/${DEMO_VILLAGE_ID}/`))) {
    return withCookies(NextResponse.redirect(new URL("/", request.url)));
  }

  if (!userId) {
    if (isProtectedPath(pathname)) {
      // 다른 주소로 보낼 때도, 갱신된 쿠키는 그대로 옮겨 담아야 합니다 (withCookies)
      return withCookies(NextResponse.redirect(new URL(loginUrl({ next: `${pathname}${search}` }), request.url)));
    }
    return response;
  }

  const villageId = villageIdFromPath(pathname);
  if (villageId) {
    response.cookies.set(LAST_VILLAGE_COOKIE, villageId, {
      path: "/",
      maxAge: LAST_VILLAGE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

export const config = {
  // 이 문지기를 거치지 않는 주소: Next.js가 만든 파일(_next), 3D 모델 폴더(models), 그림·글꼴·모델 같은 파일
  // (이런 파일까지 거치면 3D 모델 하나를 받을 때마다 로그인 확인을 하게 되어 느려집니다)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|models/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb|gltf|bin|ktx2|hdr|woff2?|ttf|txt|xml|json)$).*)",
  ],
};
