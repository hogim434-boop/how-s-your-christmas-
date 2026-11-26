// 화면이 쓰는 "마을 정보"의 모양과, 데이터베이스에서 읽은 줄을 그 모양으로 바꾸는 순수 함수입니다. (로드맵 Task 008)
//
// 💡 왜 모양을 따로 정하나요?
//    데이터베이스의 표는 "마을 표", "주민 표", "사용자 표"로 나뉘어 있고 칸 이름도 snake_case(invite_code)입니다.
//    화면은 "이 마을에 누가 사는지"를 한 덩어리로 받는 편이 쓰기 쉽습니다. 그래서 여기서 한 번 바꿔 줍니다.
//    연습용 가짜 마을(lib/dummy/village.ts)도 같은 모양을 돌려주므로, 화면은 진짜인지 가짜인지 몰라도 됩니다.

import type { CharacterParts, VillageKind } from "@/types/domain";
import { DEFAULT_NAME } from "@/lib/auth/name";
import { parseCharacterParts } from "@/lib/character/parts";
import { computeDecorLevel, requiredCount } from "@/lib/decor/progress";
import { toPaperKey } from "@/lib/letters/papers";
import { toSentLetter, type ReceivedLetter, type SentLetter, type SentLetterRowData } from "@/lib/letters/types";

/** 주민 한 명 (집 한 채) */
export type VillageResident = {
  /** 사용자 번호(users.id). 편지의 보낸 사람·받는 사람도 이 번호를 씁니다 */
  id: string;
  name: string;
  /** 지금 화면을 보는 사람인지 */
  isMe: boolean;
  /** 저장해 둔 캐릭터 꾸미기 값. 아직 꾸민 적이 없으면 null */
  characterParts: CharacterParts | null;
};

/** 마을 화면을 그리는 데 필요한 정보 한 덩어리 */
export type VillageData = {
  id: string;
  name: string;
  kind: VillageKind;
  /** 초대 링크에 들어가는 값 */
  inviteCode: string;
  /** 입주한 순서대로 (집이 놓이는 순서) */
  residents: VillageResident[];
  /** 장식 단계 (0~10). 처음 읽었을 때의 값이고, 화면은 편지를 쓸 때마다 doneCount로 다시 계산합니다 */
  level: number;
  /** 마을에서 지금까지 한 일의 개수 (삭제되지 않은 편지 수 등). 진행률(%)의 분자 */
  doneCount: number;
  /** 편지 보내기가 끝났는지 (잠금 시각 12.25가 지났는지 — 데이터베이스 기준) */
  lettersClosed: boolean;
  /** 내가 이 마을에서 보낸 편지 */
  sentLetters: SentLetter[];
  /** 내가 받은 편지. 잠금 시각 전에는 "몇 통인지"만 알 수 있어 보낸 사람·내용이 null입니다 */
  receivedLetters: ReceivedLetter[];
  /** 연습용 가짜 마을이면 true (데이터베이스에 저장하지 않음) */
  isDemo: boolean;
};

/** 데이터베이스에서 읽어 온 그대로의 값들 */
export type VillageRows = {
  village: { id: string; name: string; kind: string; invite_code: string };
  residents: { user_id: string; character_parts: unknown; joined_at: string }[];
  /** 사용자 번호 → 이름 */
  names: Record<string, string | undefined>;
  /** 진행률 계산용 숫자: 지금까지 한 일의 개수 (편지 수 등) */
  doneCount: number;
  /** 지금 화면을 보는 사람의 사용자 번호 */
  userId: string;
  /** 편지 보내기가 끝났는지 */
  lettersClosed: boolean;
  /** 내가 보낸 편지 줄들 */
  sentLetters: SentLetterRowData[];
  /**
   * 내가 받은 편지 줄들.
   * 잠금 시각 전에는 데이터베이스가 번호만 돌려줍니다(보낸 사람·내용 칸이 아예 없음).
   */
  receivedLetters: { id: string; sender_id?: string; content?: string; paper?: string }[];
};

/**
 * 사용자 번호 → 이 마을에서 보일 이름.
 * 이 마을에서 정한 닉네임이 있으면 그것을, 없으면 로그인 닉네임을 씁니다.
 */
export function mergeNames(
  users: { id: string; name: string }[],
  residents: { user_id: string; nickname: string | null }[],
): Record<string, string> {
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  for (const r of residents) {
    const nickname = r.nickname?.trim();
    if (nickname) names[r.user_id] = nickname;
  }
  return names;
}

/** 데이터베이스의 줄들을 화면용 마을 정보로 바꿉니다 */
export function toVillageData(rows: VillageRows): VillageData {
  const { village, residents, names, doneCount, userId } = rows;
  const kind: VillageKind = village.kind === "couple" ? "couple" : "friends";
  // 입주한 순서대로 줄 세웁니다. 시각이 같으면 사용자 번호 순서로 (새로고침해도 집 자리가 바뀌지 않게)
  const ordered = [...residents].sort(
    (a, b) => a.joined_at.localeCompare(b.joined_at) || a.user_id.localeCompare(b.user_id),
  );
  return {
    id: village.id,
    name: village.name,
    kind,
    inviteCode: village.invite_code,
    residents: ordered.map((r) => ({
      id: r.user_id,
      name: names[r.user_id]?.trim() || DEFAULT_NAME,
      isMe: r.user_id === userId,
      // 저장된 값이 없으면 null, 있으면 "목록에 있는 모양인지" 확인한 값
      characterParts: r.character_parts == null ? null : parseCharacterParts(r.character_parts),
    })),
    // 장식 단계는 저장해 두지 않고, 읽을 때마다 "지금 주민 수"로 다시 계산합니다
    // (친구가 새로 들어오면 써야 할 편지가 늘어 단계가 내려갈 수 있음 — PRD 핵심 규칙)
    level: computeDecorLevel(doneCount, requiredCount(kind, ordered.length)),
    doneCount,
    lettersClosed: rows.lettersClosed,
    sentLetters: rows.sentLetters.map(toSentLetter),
    receivedLetters: rows.receivedLetters.map((l) => ({
      id: l.id,
      // 보낸 사람이 마을을 떠났더라도 편지는 남으므로, 이름을 못 찾으면 기본 이름을 씁니다
      senderName: l.sender_id === undefined ? null : names[l.sender_id]?.trim() || DEFAULT_NAME,
      content: l.content ?? null,
      paper: l.paper === undefined ? null : toPaperKey(l.paper),
    })),
    isDemo: false,
  };
}
