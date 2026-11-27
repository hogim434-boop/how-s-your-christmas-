// 초대 코드로 마을에 입주시키는 주소입니다. 주소: /invite/초대코드/join (로드맵 Task 008, F013)
//
// 누가 여기로 오나요?
//  - 초대 화면에서 닉네임을 적고 "이 마을에 들어가기"를 누른 사람 (주소 뒤에 ?nickname=값 이 붙어 옵니다)
//
// 하는 일
//  1) 로그인하지 않았으면 → 로그인 화면 (초대 코드는 기억)
//  2) 데이터베이스의 join_village 함수로 입주 (이미 주민이면 아무 일도 일어나지 않아 집이 늘지 않음)
//  3) 처음 입주 → 닉네임 저장 → 그 마을 + 캐릭터 꾸미기 / 원래 주민 → 바로 그 마을 (닉네임은 건드리지 않음)
//  4) 없는 코드·가득 찬 커플 마을 → 초대 화면에서 안내
//
// 💡 Route Handler: 화면을 그리지 않고 "요청을 받아 처리한 뒤 다른 주소로 보내는" 서버 코드입니다.
//    (node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md)
// 💡 Next.js 16: 주소의 [code] 부분(params)은 Promise라서 await로 꺼냅니다.

import type { NextRequest } from "next/server";
import { redirectTo } from "@/lib/auth/finish";
import { loginUrl, safeInviteCode } from "@/lib/auth/next";
import { getMyVillageIds } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { joinDestination, joinFailureDestination, parseJoinError } from "@/lib/village/join";
import { validateNickname } from "@/lib/village/nickname";

export async function GET(request: NextRequest, { params }: RouteContext<"/invite/[code]/join">) {
  // 주소로 받은 값은 누구나 바꿀 수 있으므로, 안전한 모양일 때만 씁니다
  const code = safeInviteCode((await params).code);
  if (!code) return redirectTo(request, "/");

  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    if (!userId) return redirectTo(request, loginUrl({ invite: code }));

    // 입주하기 전의 내 마을 목록: "처음 입주인지, 원래 주민인지"를 가리기 위해 먼저 읽어 둡니다
    const before = await getMyVillageIds(userId, supabase);

    const { data: villageId, error } = await supabase.rpc("join_village", { p_code: code });
    if (error || !villageId) {
      const reason = parseJoinError(error?.message);
      if (reason === "not_signed_in") return redirectTo(request, loginUrl({ invite: code }));
      if (reason === "failed") console.error("[invite/join] 입주 실패", error);
      return redirectTo(request, joinFailureDestination(code, reason));
    }

    const wasResident = before.includes(villageId);
    // 처음 입주한 사람만 닉네임을 저장합니다. 주소로 받은 값이라 규칙(1~10자)에 맞을 때만 씁니다.
    // 저장에 실패해도 입주는 끝났으므로 그대로 마을로 보냅니다 (로그인 닉네임이 보이고, 메뉴에서 다시 정할 수 있음)
    const nickname = request.nextUrl.searchParams.get("nickname")?.trim() ?? "";
    if (!wasResident && validateNickname(nickname) === "ok") {
      const { error: nicknameError } = await supabase
        .from("residents")
        .update({ nickname })
        .eq("village_id", villageId)
        .eq("user_id", userId);
      if (nicknameError) console.error("[invite/join] 닉네임 저장 실패", nicknameError);
    }
    return redirectTo(request, joinDestination(villageId, wasResident));
  } catch (cause) {
    console.error("[invite/join] 입주 처리 중 오류", cause);
    return redirectTo(request, joinFailureDestination(code, "failed"));
  }
}
