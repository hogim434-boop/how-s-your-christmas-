// 편지를 데이터베이스에 저장·수정·삭제하는 곳입니다. 브라우저에서 부릅니다. (로드맵 Task 009)
//
// 💡 브라우저에서 바로 저장해도 안전한 이유: 데이터베이스가 스스로 규칙을 지킵니다.
//    - 내 이름으로만, 내가 사는 마을에만 쓸 수 있음 (보안 규칙 RLS)
//    - 받는 사람도 그 마을 주민이어야 함, 잠금 시각은 화면이 정할 수 없음 (트리거)
//    - 한 사람에게 한 통, 12.25부터는 쓰기·수정·삭제 불가
//    화면은 "부탁"만 하고, 안 되는 일은 데이터베이스가 거절합니다. 거절 이유는 errors.ts가 풀어 줍니다.

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { parseLetterError, type LetterError } from "./errors";
import type { PaperKey } from "./papers";
import { SENT_LETTER_COLUMNS, toSentLetter, type SentLetter } from "./types";

type Failure = { ok: false, reason: LetterError };
export type LetterResult = { ok: true; letter: SentLetter } | Failure;

/** 새 편지 보내기 */
export async function sendLetter(input: {
  villageId: string;
  senderId: string;
  recipientId: string;
  content: string;
  paper: PaperKey;
}): Promise<LetterResult> {
  // 💡 화면이 넣을 수 있는 칸은 이 다섯 개뿐입니다. 잠금 시각(unlock_at) 같은 칸은 데이터베이스가 채웁니다.
  //    (자동으로 만든 타입은 unlock_at을 "꼭 넣어야 하는 칸"으로 보기 때문에 타입만 맞춰 줍니다)
  const row = {
    village_id: input.villageId,
    sender_id: input.senderId,
    recipient_id: input.recipientId,
    content: input.content,
    paper: input.paper,
  } as Database["public"]["Tables"]["letters"]["Insert"];
  const { data, error } = await createClient().from("letters").insert(row).select(SENT_LETTER_COLUMNS).single();
  if (error || !data) return { ok: false, reason: parseLetterError(error) };
  return { ok: true, letter: toSentLetter(data) };
}

/** 이미 보낸 편지 고치기 (내용·편지지만) */
export async function editLetter(letterId: string, content: string, paper: PaperKey): Promise<LetterResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("letters")
    .update({ content, paper })
    .eq("id", letterId)
    .select(SENT_LETTER_COLUMNS);
  if (error) return { ok: false, reason: parseLetterError(error) };
  if (data.length === 1) return { ok: true, letter: toSentLetter(data[0]) };
  // 고쳐진 줄이 없음: 잠금 시각이 지났거나(보안 규칙이 조용히 막음), 이미 지운 편지입니다. 어느 쪽인지 확인합니다
  return { ok: false, reason: (await isClosedNow()) ? "closed" : "not_found" };
}

/** 편지 지우기 (진짜 지우지 않고 숨김 처리 — 데이터베이스 함수 delete_letter) */
export async function deleteLetter(letterId: string): Promise<{ ok: true } | Failure> {
  const { error } = await createClient().rpc("delete_letter", { p_letter: letterId });
  return error ? { ok: false, reason: parseLetterError(error) } : { ok: true };
}

/** 내가 이 마을에서 보낸 편지 목록을 다시 읽습니다 (다른 기기에서 보낸 편지가 있을 때 맞추기 위해). 실패하면 null */
export async function fetchSentLetters(villageId: string, userId: string): Promise<SentLetter[] | null> {
  const { data, error } = await createClient()
    .from("letters")
    .select(SENT_LETTER_COLUMNS)
    .eq("village_id", villageId)
    .eq("sender_id", userId)
    .order("created_at");
  return error ? null : data.map(toSentLetter);
}

/**
 * 마을의 진행 숫자를 다시 읽습니다 → 진행률·장식 단계 계산에 씁니다. 실패하면 null
 * - doneCount: 지금까지 한 일의 개수(편지 수 등)
 * - residentCount: 지금 주민 수. 화면을 열어 둔 사이에 새 주민이 들어왔을 수 있어서 함께 읽습니다
 *   (주민이 늘면 "써야 할 편지 수"도 늘어나므로, 옛 주민 수로 계산하면 진행률이 실제보다 높게 나옵니다)
 */
export async function fetchProgress(villageId: string): Promise<{ doneCount: number; residentCount: number } | null> {
  const { data, error } = await createClient().rpc("village_progress", { p_village: villageId });
  const row = error ? null : data[0];
  return row ? { doneCount: row.done_count ?? 0, residentCount: row.resident_count ?? 0 } : null;
}

/** 데이터베이스 기준으로 편지 보내기가 끝났는지 (잠금 시각이 지났는지) */
async function isClosedNow(): Promise<boolean> {
  const { data, error } = await createClient().rpc("letter_unlock_time");
  return !error && data !== null && Date.now() >= new Date(data).getTime();
}
