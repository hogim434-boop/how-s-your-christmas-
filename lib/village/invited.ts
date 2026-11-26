// 초대 코드로 "어느 마을에 초대받았는지"(이름과 종류)를 찾는 곳입니다. (로드맵 Task 008, F012)
//
// 💡 로그인하지 않은 사람도 초대 화면에서 마을 이름을 봐야 합니다.
//    그래서 표를 직접 읽지 않고(주민만 읽을 수 있음), 이름과 종류 두 가지만 돌려주는
//    데이터베이스 함수 village_name_by_invite를 부릅니다. 그 밖의 정보는 새어 나가지 않습니다.

import "server-only";
import type { VillageKind } from "@/types/domain";
import { safeInviteCode } from "@/lib/auth/next";
import { createClient } from "@/lib/supabase/server";

export type InvitedVillage = { name: string; kind: VillageKind };

/** 초대 코드에 해당하는 마을. 코드가 이상하거나 그런 마을이 없으면 null */
export async function findInvitedVillage(code: string | null | undefined): Promise<InvitedVillage | null> {
  const safe = safeInviteCode(code);
  if (!safe) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("village_name_by_invite", { p_code: safe });
  if (error) throw new Error(`초대받은 마을을 찾지 못했습니다: ${error.message}`);
  const row = data[0];
  return row ? { name: row.name, kind: row.kind === "couple" ? "couple" : "friends" } : null;
}
