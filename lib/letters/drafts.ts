// 쓰다 만 편지(임시 저장)를 이 브라우저에 기억해 두는 도구입니다. (11.26 사용자 요청)
// 편지를 쓰다가 창을 닫거나 새로고침해도 글이 사라지지 않고, 다시 열면 이어서 쓸 수 있습니다.
// 임시 저장은 "받는 사람마다 하나씩" 따로 둡니다. 편지를 보내면 지웁니다.
// 💡 임시 글은 서버로 보내지 않고 이 브라우저에만 둡니다. (진짜 서버를 연결한 뒤에도 같습니다)

import { readStorageJson, removeStorage, writeStorage } from "@/lib/storage";
import { toPaperKey, type PaperKey } from "./papers";

export type LetterDraft = { content: string; paper: PaperKey };

/**
 * 지금 쓰고 있는 글이 "임시 저장할 만한 글"인지 정합니다.
 * 처음 상태(새 편지면 빈 글, 고치기면 보낸 글)와 똑같으면 저장할 필요가 없어서 null을 돌려줍니다.
 */
export function draftFor(current: LetterDraft, initial: LetterDraft): LetterDraft | null {
  const sameContent = current.content === initial.content;
  const samePaper = current.paper === initial.paper;
  // 글이 비어 있고 편지지만 바꾼 새 편지는 저장하지 않습니다
  if (sameContent && (samePaper || current.content.trim() === "")) return null;
  if (!sameContent && current.content.trim() === "" && initial.content === "") return null;
  return current;
}

/** 저장해 둔 값이 임시 글 모양이 맞는지 확인합니다. 아니면(없거나 깨졌으면) null */
export function parseDraft(value: unknown): LetterDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.content !== "string") return null;
  return { content: record.content, paper: toPaperKey(record.paper) };
}

const draftKey = (villageId: string, recipientId: string) => `hyc.draft.${villageId}.${recipientId}`;

export function loadDraft(villageId: string, recipientId: string): LetterDraft | null {
  return parseDraft(readStorageJson(draftKey(villageId, recipientId)));
}

/** 임시 글을 저장합니다. null을 주면 지웁니다 */
export function saveDraft(villageId: string, recipientId: string, draft: LetterDraft | null) {
  if (draft === null) removeStorage(draftKey(villageId, recipientId));
  else writeStorage(draftKey(villageId, recipientId), JSON.stringify(draft));
}
