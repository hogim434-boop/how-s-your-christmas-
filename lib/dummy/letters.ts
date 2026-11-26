// 연습용 마을(/village/demo)에서 편지 쓰기·편지함을 눌러 보기 위한 "가짜 편지 저장소"입니다. (로드맵 Task 005)
// 보낸 편지는 이 브라우저의 저장 공간(localStorage)에 넣어 두어, 새로고침해도 남습니다.
// 진짜 마을의 편지는 데이터베이스에 저장합니다 → lib/letters/store.ts (Task 009). 편지의 모양은 두 쪽이 같습니다(lib/letters/types.ts).

import { readStorageJson, writeStorage } from "@/lib/storage";
import { DEFAULT_PAPER, toPaperKey, type PaperKey } from "@/lib/letters/papers";
import type { ReceivedLetter, SentLetter } from "@/lib/letters/types";
import type { DummyVillage } from "./village";

/** 가짜 편지 글 (보낸 편지의 처음 내용) */
const SAMPLE_SENT = "メリークリスマス！今年もたくさん遊んでくれてありがとう。";
/** 가짜 편지 글 (받은 편지 내용, 잠금이 풀렸을 때만 보임) */
const SAMPLE_RECEIVED = "いつもありがとう。来年もよろしくね！🎄";

/** 처음 들어왔을 때의 보낸 편지 목록: 가짜 마을이 "보냈다"고 정해 둔 주민들에게 한 통씩 */
export function initialSentLetters(village: DummyVillage): SentLetter[] {
  return village.sentTo.map((recipientId) => ({ recipientId, content: SAMPLE_SENT, paper: DEFAULT_PAPER, editedAt: null }));
}

/**
 * 받은 편지 목록 (가짜): 나 말고 짝수 번째 주민들이 보냈다고 가정합니다.
 * locked가 true면 "몇 통인지"만 알 수 있고, 보낸 사람과 내용은 null입니다.
 */
export function receivedLetters(village: DummyVillage, locked: boolean): ReceivedLetter[] {
  return village.residents
    .filter((r, i) => !r.isMe && i % 2 === 0)
    .map((r) => ({
      id: `from-${r.id}`,
      senderName: locked ? null : r.name,
      content: locked ? null : SAMPLE_RECEIVED,
      paper: locked ? null : "snow",
    }));
}

/**
 * 편지를 보내거나 고칩니다. 원래 목록은 그대로 두고 "새 목록"을 돌려줍니다.
 * - 그 사람에게 보낸 편지가 없으면: 새로 추가 (editedAt은 null)
 * - 이미 있으면: 내용·편지지를 바꾸고 고친 시각을 적음
 */
export function upsertLetter(
  list: SentLetter[],
  recipientId: string,
  content: string,
  paper: PaperKey,
  now: Date,
): SentLetter[] {
  const exists = list.some((l) => l.recipientId === recipientId);
  if (!exists) return [...list, { recipientId, content, paper, editedAt: null }];
  return list.map((l) =>
    l.recipientId === recipientId ? { ...l, content, paper, editedAt: now.toISOString() } : l,
  );
}

/** 그 사람에게 보낸 편지를 지운 새 목록을 돌려줍니다 */
export function removeLetter(list: SentLetter[], recipientId: string): SentLetter[] {
  return list.filter((l) => l.recipientId !== recipientId);
}

/** 저장해 둔 값이 "보낸 편지 목록" 모양이 맞는지 확인합니다. 아니면(깨졌으면) fallback을 돌려줍니다 */
export function parseSentLetters(value: unknown, fallback: SentLetter[]): SentLetter[] {
  if (!Array.isArray(value)) return fallback;
  const ok = value.every(
    (v) =>
      typeof v === "object" &&
      v !== null &&
      typeof v.recipientId === "string" &&
      typeof v.content === "string" &&
      (v.editedAt === null || typeof v.editedAt === "string"),
  );
  if (!ok) return fallback;
  // 편지지 기능이 생기기 전에 저장된 편지에는 paper가 없어서, 기본 편지지로 채워 줍니다
  return value.map((v) => ({
    recipientId: v.recipientId,
    content: v.content,
    paper: toPaperKey(v.paper),
    editedAt: v.editedAt,
  }));
}

const sentKey = (villageId: string) => `hyc.dummy.letters.${villageId}`;

/** 이 브라우저에 저장해 둔 보낸 편지 목록을 읽습니다 (없으면 fallback) */
export function loadSentLetters(villageId: string, fallback: SentLetter[]): SentLetter[] {
  return parseSentLetters(readStorageJson(sentKey(villageId)), fallback);
}

export function saveSentLetters(villageId: string, list: SentLetter[]) {
  writeStorage(sentKey(villageId), JSON.stringify(list));
}
