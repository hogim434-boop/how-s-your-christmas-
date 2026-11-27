// 데이터베이스 줄 → 화면용 마을 정보 변환(toVillageData)이 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { DEFAULT_PARTS } from "@/lib/character/parts";
import { toVillageData, type VillageRows } from "./data";

const village = { id: "v1", name: "우리 마을", kind: "friends", invite_code: "abc234abc234" };
const row = (user_id: string, joined_at: string, character_parts: unknown = null) => ({ user_id, joined_at, character_parts });

function rows(overrides: Partial<VillageRows> = {}): VillageRows {
  return {
    village,
    residents: [row("u2", "2026-11-26T10:00:02Z"), row("u1", "2026-11-26T10:00:01Z")],
    names: { u1: "하은", u2: "ゆうき" },
    doneCount: 0,
    userId: "u2",
    lettersClosed: false,
    sentLetters: [],
    receivedLetters: [],
    ...overrides,
  };
}

describe("toVillageData", () => {
  it("마을 이름·종류·초대 코드를 옮긴다", () => {
    const data = toVillageData(rows());
    expect(data).toMatchObject({ id: "v1", name: "우리 마을", kind: "friends", inviteCode: "abc234abc234", isDemo: false });
  });

  it("주민은 입주한 순서대로, 나에게만 isMe 표시", () => {
    const data = toVillageData(rows());
    expect(data.residents.map((r) => r.id)).toEqual(["u1", "u2"]);
    expect(data.residents.map((r) => r.isMe)).toEqual([false, true]);
    expect(data.residents.map((r) => r.name)).toEqual(["하은", "ゆうき"]);
  });

  it("입주 시각이 같으면 사용자 번호 순서 (집 자리가 흔들리지 않게)", () => {
    const same = "2026-11-26T10:00:00Z";
    const data = toVillageData(rows({ residents: [row("b", same), row("a", same)] }));
    expect(data.residents.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("이름을 읽지 못한 주민은 기본 이름", () => {
    const data = toVillageData(rows({ names: { u1: "  " } }));
    expect(data.residents.map((r) => r.name)).toEqual(["Friend", "Friend"]);
  });

  it("꾸미기 값: 없으면 null, 올바르면 그대로, 깨졌으면 기본 모양", () => {
    const good = { ...DEFAULT_PARTS, hat: "hat_2" };
    const data = toVillageData(
      rows({ residents: [row("u1", "1", good), row("u2", "2", { hair: "이상한 값" }), row("u3", "3")] }),
    );
    expect(data.residents[0].characterParts).toEqual(good);
    expect(data.residents[1].characterParts).toEqual(DEFAULT_PARTS);
    expect(data.residents[2].characterParts).toBeNull();
  });

  it("장식 단계는 지금 주민 수로 계산한다 (3명 → 4명이 되면 내려감)", () => {
    const three = [row("u1", "1"), row("u2", "2"), row("u3", "3")];
    // 3명: 써야 할 편지 6통. 3통이면 50% → 5단계
    expect(toVillageData(rows({ residents: three, doneCount: 3 })).level).toBe(5);
    // 4명: 써야 할 편지 12통. 3통이면 25% → 2단계
    expect(toVillageData(rows({ residents: [...three, row("u4", "4")], doneCount: 3 })).level).toBe(2);
  });

  it("한 일 개수와 마감 여부, 보낸 편지를 옮긴다", () => {
    const data = toVillageData(
      rows({
        doneCount: 4,
        lettersClosed: true,
        sentLetters: [{ id: "l1", recipient_id: "u1", content: "안녕", paper: "tree", edited_at: "2026-12-01T00:00:00Z" }],
      }),
    );
    expect(data.doneCount).toBe(4);
    expect(data.lettersClosed).toBe(true);
    expect(data.sentLetters).toEqual([
      { id: "l1", recipientId: "u1", content: "안녕", paper: "tree", editedAt: "2026-12-01T00:00:00Z" },
    ]);
  });

  it("받은 편지: 잠겨 있으면 번호만, 풀렸으면 보낸 사람 이름과 내용", () => {
    const lockedData = toVillageData(rows({ receivedLetters: [{ id: "l1" }, { id: "l2" }] }));
    expect(lockedData.receivedLetters).toEqual([
      { id: "l1", senderName: null, content: null, paper: null, openedAt: null },
      { id: "l2", senderName: null, content: null, paper: null, openedAt: null },
    ]);
    const open = toVillageData(
      rows({
        lettersClosed: true,
        receivedLetters: [
          // l1은 이미 열어 본 편지(처음 연 시각이 있음), l2는 아직 안 연 편지
          { id: "l1", sender_id: "u1", content: "메리 크리스마스", paper: "snow", opened_at: "2026-12-25T00:10:00+09:00" },
          { id: "l2", sender_id: "떠난 사람", content: "잘 지내", paper: "모르는 편지지", opened_at: null },
        ],
      }),
    );
    expect(open.receivedLetters).toEqual([
      { id: "l1", senderName: "하은", content: "메리 크리스마스", paper: "snow", openedAt: "2026-12-25T00:10:00+09:00" },
      { id: "l2", senderName: "Friend", content: "잘 지내", paper: "plain", openedAt: null },
    ]);
  });

  it("혼자인 마을과 커플 마을(1명)은 0단계", () => {
    expect(toVillageData(rows({ residents: [row("u1", "1")], doneCount: 5 })).level).toBe(0);
    const couple = { ...village, kind: "couple" };
    expect(toVillageData(rows({ village: couple, residents: [row("u1", "1")], doneCount: 5 })).level).toBe(0);
    expect(toVillageData(rows({ village: couple, doneCount: 5 })).kind).toBe("couple");
    expect(toVillageData(rows({ village: couple, doneCount: 5 })).level).toBe(5);
  });
});
