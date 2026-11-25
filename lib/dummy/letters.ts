// 서버·DB가 아직 없을 때 편지 쓰기·편지함 화면을 눌러 보기 위한 "가짜 편지 저장소"입니다. (로드맵 Task 005)
// 보낸 편지는 이 브라우저의 저장 공간(localStorage)에 넣어 두어, 새로고침해도 남습니다.
// 진짜 데이터베이스(Supabase)를 연결하면(Task 009) 이 파일의 load/save만 바꾸면 되고,
// 화면 부품들은 "편지 목록"과 "보내기·지우기 함수"만 받기 때문에 그대로 둘 수 있습니다.

import { readStorageJson, writeStorage } from "@/lib/storage";
import { DEFAULT_PAPER, toPaperKey, type PaperKey } from "@/lib/letters/papers";
import type { DummyVillage } from "./village";

/** 내가 보낸 편지 한 통 (한 사람에게 한 통뿐이라, 받는 사람 id가 곧 편지의 이름표입니다) */
export type DummySentLetter = {
  /** 받는 주민의 id */
  recipientId: string;
  content: string;
  /** 어떤 편지지에 썼는지 */
  paper: PaperKey;
  /** 고친 시각 (한 번도 고치지 않았으면 null) */
  editedAt: string | null;
};

/** 내가 받은 편지 한 통. 잠겨 있을 때는 보낸 사람·내용을 아예 담지 않습니다(null) */
export type DummyReceivedLetter = {
  id: string;
  senderName: string | null;
  content: string | null;
  paper: PaperKey | null;
};

/** 가짜 편지 글 (보낸 편지의 처음 내용) */
const SAMPLE_SENT = "メリークリスマス！今年もたくさん遊んでくれてありがとう。";
/** 가짜 편지 글 (받은 편지 내용, 잠금이 풀렸을 때만 보임) */
const SAMPLE_RECEIVED = "いつもありがとう。来年もよろしくね！🎄";

/** 처음 들어왔을 때의 보낸 편지 목록: 가짜 마을이 "보냈다"고 정해 둔 주민들에게 한 통씩 */
export function initialSentLetters(village: DummyVillage): DummySentLetter[] {
  return village.sentTo.map((recipientId) => ({ recipientId, content: SAMPLE_SENT, paper: DEFAULT_PAPER, editedAt: null }));
}

/**
 * 받은 편지 목록 (가짜): 나 말고 짝수 번째 주민들이 보냈다고 가정합니다.
 * locked가 true면 "몇 통인지"만 알 수 있고, 보낸 사람과 내용은 null입니다.
 */
export function receivedLetters(village: DummyVillage, locked: boolean): DummyReceivedLetter[] {
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
  list: DummySentLetter[],
  recipientId: string,
  content: string,
  paper: PaperKey,
  now: Date,
): DummySentLetter[] {
  const exists = list.some((l) => l.recipientId === recipientId);
  if (!exists) return [...list, { recipientId, content, paper, editedAt: null }];
  return list.map((l) =>
    l.recipientId === recipientId ? { ...l, content, paper, editedAt: now.toISOString() } : l,
  );
}

/** 그 사람에게 보낸 편지를 지운 새 목록을 돌려줍니다 */
export function removeLetter(list: DummySentLetter[], recipientId: string): DummySentLetter[] {
  return list.filter((l) => l.recipientId !== recipientId);
}

/** 저장해 둔 값이 "보낸 편지 목록" 모양이 맞는지 확인합니다. 아니면(깨졌으면) fallback을 돌려줍니다 */
export function parseSentLetters(value: unknown, fallback: DummySentLetter[]): DummySentLetter[] {
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
export function loadSentLetters(villageId: string, fallback: DummySentLetter[]): DummySentLetter[] {
  return parseSentLetters(readStorageJson(sentKey(villageId)), fallback);
}

export function saveSentLetters(villageId: string, list: DummySentLetter[]) {
  writeStorage(sentKey(villageId), JSON.stringify(list));
}
