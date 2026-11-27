// 화면이 쓰는 "편지"의 모양입니다. 진짜 마을(데이터베이스)과 연습용 마을(가짜 편지)이 함께 씁니다. (로드맵 Task 009)

import { toPaperKey, type PaperKey } from "./papers";

/** 내가 보낸 편지 한 통 (한 사람에게 한 통뿐이라, 받는 사람 id로 찾을 수 있습니다) */
export type SentLetter = {
  /** 데이터베이스의 편지 번호. 연습용 마을의 가짜 편지에는 없습니다 */
  id?: string;
  /** 받는 주민의 id */
  recipientId: string;
  content: string;
  /** 어떤 편지지에 썼는지 */
  paper: PaperKey;
  /** 고친 시각 (한 번도 고치지 않았으면 null) */
  editedAt: string | null;
};

/** 내가 받은 편지 한 통. 잠겨 있을 때는 보낸 사람·내용을 아예 담지 않습니다(null) */
export type ReceivedLetter = {
  id: string;
  senderName: string | null;
  content: string | null;
  paper: PaperKey | null;
  /** 내가 이 편지를 처음 연 시각 (아직 안 열었거나 잠겨 있으면 null) → 개봉 연출과 "안 읽음" 표시에 씁니다 */
  openedAt: string | null;
};

/** 데이터베이스의 편지 줄(보낸 편지에 필요한 칸만) */
export type SentLetterRowData = {
  id: string;
  recipient_id: string;
  content: string;
  paper: string;
  edited_at: string | null;
};

/** 데이터베이스에서 읽을 칸 이름 (위 타입과 짝) */
export const SENT_LETTER_COLUMNS = "id, recipient_id, content, paper, edited_at";

/** 데이터베이스의 편지 줄을 화면용 모양으로 바꿉니다 */
export function toSentLetter(row: SentLetterRowData): SentLetter {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    content: row.content,
    paper: toPaperKey(row.paper),
    editedAt: row.edited_at,
  };
}

/** 목록에 편지 한 통을 넣습니다. 같은 사람에게 보낸 편지가 이미 있으면 그 자리를 바꿉니다 (원래 목록은 그대로 둠) */
export function putSentLetter(list: SentLetter[], letter: SentLetter): SentLetter[] {
  const exists = list.some((l) => l.recipientId === letter.recipientId);
  return exists ? list.map((l) => (l.recipientId === letter.recipientId ? letter : l)) : [...list, letter];
}
