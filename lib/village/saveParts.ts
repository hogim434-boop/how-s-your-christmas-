// 캐릭터 꾸미기 값을 데이터베이스의 "내 주민 줄"에 저장합니다. (로드맵 Task 008, D-05: 마을마다 따로 저장)
//
// 💡 브라우저에서 바로 저장해도 안전한 이유:
//    데이터베이스 보안 규칙(RLS)이 "본인 줄의 꾸미기 값(character_parts)만 고치기"를 허용합니다.
//    다른 사람의 줄이나 다른 칸은 고치려고 해도 데이터베이스가 거절합니다.

import type { CharacterParts } from "@/types/domain";
import { createClient } from "@/lib/supabase/client";

/** 저장에 성공하면 true. (내 줄이 없거나 통신에 실패하면 false) */
export async function saveResidentParts(villageId: string, userId: string, parts: CharacterParts): Promise<boolean> {
  const { data, error } = await createClient()
    .from("residents")
    .update({ character_parts: parts })
    .eq("village_id", villageId)
    .eq("user_id", userId)
    // 고친 줄을 돌려받아 "정말 한 줄이 바뀌었는지" 확인합니다 (0줄이면 실패로 봅니다)
    .select("id");
  return !error && data.length === 1;
}

/** 이 마을에서 쓸 닉네임을 내 주민 줄에 저장합니다. 성공하면 true */
export async function saveResidentNickname(villageId: string, userId: string, nickname: string): Promise<boolean> {
  const { data, error } = await createClient()
    .from("residents")
    .update({ nickname: nickname.trim() })
    .eq("village_id", villageId)
    .eq("user_id", userId)
    .select("id");
  return !error && data.length === 1;
}
