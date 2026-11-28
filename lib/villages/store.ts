// 내가 들어간 마을 목록을 데이터베이스에서 읽어 오는 곳입니다. 브라우저에서 부릅니다. (로드맵 Task 017)
//
// 💡 데이터베이스 함수(my_villages)가 "지금 로그인한 사람이 사는 마을"만 돌려줍니다.
//    화면이 사용자 번호를 넘기지 않으므로, 남의 목록을 달라고 할 방법이 없습니다.

import { createClient } from "@/lib/supabase/client";
import type { MyVillageRow } from "./list";

/** 내 마을 목록 (최근에 입주한 순). 읽지 못하면 null — 화면은 "다시 시도"를 보여 줍니다 */
export async function fetchMyVillages(): Promise<MyVillageRow[] | null> {
  try {
    const { data, error } = await createClient().rpc("my_villages");
    return error || !data ? null : data;
  } catch {
    // 인터넷이 끊긴 경우 등
    return null;
  }
}
