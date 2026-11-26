// 서버에서 마을 한 곳의 정보를 데이터베이스에서 읽어 오는 곳입니다. (로드맵 Task 008)
//
// 💡 "지금 접속한 사람의 권한"으로 읽습니다. 데이터베이스 보안 규칙(RLS)이
//    "그 마을 주민만 읽기"로 되어 있어서, 주민이 아닌 사람이 부르면 아무것도 읽히지 않습니다(null).
// 💡 쿠키를 읽는 연결을 쓰므로, 꼭 <Suspense> 안쪽의 부품에서 불러야 합니다. (cacheComponents 모드)

import "server-only";
import { connection } from "next/server";
import { SENT_LETTER_COLUMNS } from "@/lib/letters/types";
import { createClient } from "@/lib/supabase/server";
import { mergeNames, toVillageData, type VillageData } from "./data";

/**
 * 마을 정보(이름·종류·초대 코드·주민 목록·장식 단계)와 내 편지(보낸 것·받은 것)를 읽습니다.
 * 마을이 없거나 내가 주민이 아니면 null.
 */
export async function loadVillage(villageId: string, userId: string): Promise<VillageData | null> {
  const supabase = await createClient();

  // 💡 Promise.all: 서로 기다릴 필요가 없는 질문들을 동시에 보내서 시간을 아낍니다
  const [villageResult, residentsResult, progressResult, unlockResult, sentResult] = await Promise.all([
    supabase.from("villages").select("id, name, kind, invite_code").eq("id", villageId).maybeSingle(),
    supabase.from("residents").select("user_id, character_parts, joined_at, nickname").eq("village_id", villageId),
    supabase.rpc("village_progress", { p_village: villageId }),
    // 편지 잠금이 풀리는 시각: 화면 시계가 아니라 데이터베이스가 아는 시각을 씁니다 (개발용 앞당기기 포함)
    supabase.rpc("letter_unlock_time"),
    // 내가 이 마을에서 보낸 편지 (지운 편지는 보안 규칙이 걸러 줍니다)
    supabase.from("letters").select(SENT_LETTER_COLUMNS).eq("village_id", villageId).eq("sender_id", userId).order("created_at"),
  ]);

  if (villageResult.error) throw new Error(`마을을 읽지 못했습니다: ${villageResult.error.message}`);
  if (!villageResult.data) return null;
  if (residentsResult.error) throw new Error(`주민 목록을 읽지 못했습니다: ${residentsResult.error.message}`);
  if (progressResult.error) throw new Error(`진행 상황을 읽지 못했습니다: ${progressResult.error.message}`);
  if (unlockResult.error) throw new Error(`잠금 시각을 읽지 못했습니다: ${unlockResult.error.message}`);
  if (sentResult.error) throw new Error(`보낸 편지를 읽지 못했습니다: ${sentResult.error.message}`);

  // 💡 "지금 시각"은 볼 때마다 달라지는 값입니다. Next.js는 화면을 미리 만들어 둘 수 있는지 검사하는데,
  //    이런 값을 만나면 "미리 만들면 안 되는 값"이라고 경고합니다. connection()은 "여기서부터는
  //    사람이 실제로 들어왔을 때만 계산합니다"라고 Next.js에 알려 주는 약속입니다.
  await connection();
  const lettersClosed = Date.now() >= new Date(unlockResult.data).getTime();

  // 주민들의 이름은 사용자 표에 있어서 한 번 더 읽습니다 (같은 마을 이웃의 이름만 읽을 수 있음)
  const userIds = residentsResult.data.map((r) => r.user_id);
  // 받은 편지: 잠금 시각 전에는 "몇 통인지"만 알려 주는 함수를, 지난 뒤에는 편지 표를 읽습니다.
  // 💡 잠금 전에 편지 표를 읽어도 보안 규칙이 한 줄도 돌려주지 않습니다. 화면에서 숨기는 것이 아니라
  //    데이터베이스가 아예 내려주지 않기 때문에, 개발자 도구로도 미리 볼 수 없습니다.
  const receivedQuery = lettersClosed
    ? supabase.from("letters").select("id, sender_id, content, paper").eq("village_id", villageId).eq("recipient_id", userId).order("created_at")
    : supabase.rpc("received_letters_locked", { p_village: villageId });
  const [usersResult, receivedResult] = await Promise.all([
    supabase.from("users").select("id, name").in("id", userIds),
    receivedQuery,
  ]);
  if (usersResult.error) throw new Error(`주민 이름을 읽지 못했습니다: ${usersResult.error.message}`);
  if (receivedResult.error) throw new Error(`받은 편지를 읽지 못했습니다: ${receivedResult.error.message}`);

  return toVillageData({
    village: villageResult.data,
    residents: residentsResult.data,
    names: mergeNames(usersResult.data, residentsResult.data),
    doneCount: progressResult.data?.[0]?.done_count ?? 0,
    userId,
    lettersClosed,
    sentLetters: sentResult.data,
    receivedLetters: receivedResult.data,
  });
}
