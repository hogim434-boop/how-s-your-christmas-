import { describe, expect, it } from "vitest";
import { getDummyVillage } from "./village";
import { initialSentLetters, parseSentLetters, receivedLetters, removeLetter, upsertLetter } from "./letters";

const village = getDummyVillage({ id: "demo", n: 6, level: 0 });
const now = new Date("2026-11-25T12:00:00+09:00");

describe("보낸 편지 목록", () => {
  it("처음 목록은 가짜 마을의 sentTo와 같다", () => {
    expect(initialSentLetters(village).map((l) => l.recipientId)).toEqual(village.sentTo);
  });
  it("처음 보내면 추가되고 고친 시각은 없다", () => {
    const next = upsertLetter([], "r3", "안녕", "plain", now);
    expect(next).toEqual([{ recipientId: "r3", content: "안녕", paper: "plain", editedAt: null }]);
  });
  it("같은 사람에게 다시 보내면 통수는 그대로이고 내용과 고친 시각이 바뀐다", () => {
    const first = upsertLetter([], "r3", "안녕", "plain", now);
    const next = upsertLetter(first, "r3", "고친 글", "snow", now);
    expect(next).toHaveLength(1);
    expect(next[0]).toEqual({ recipientId: "r3", content: "고친 글", paper: "snow", editedAt: now.toISOString() });
    // 원래 목록은 바뀌지 않는다
    expect(first[0].content).toBe("안녕");
  });
  it("지우면 그 사람 편지만 사라진다", () => {
    const list = upsertLetter(upsertLetter([], "r2", "a", "plain", now), "r3", "b", "plain", now);
    expect(removeLetter(list, "r2").map((l) => l.recipientId)).toEqual(["r3"]);
  });
});

describe("받은 편지 목록", () => {
  it("잠겨 있으면 보낸 사람과 내용이 없다", () => {
    const list = receivedLetters(village, true);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((l) => l.senderName === null && l.content === null)).toBe(true);
  });
  it("열리면 보낸 사람과 내용이 있다", () => {
    expect(receivedLetters(village, false).every((l) => l.senderName && l.content)).toBe(true);
    // 연습용 편지는 늘 아직 안 연 편지로 시작합니다 (개봉 연출 확인용)
    expect(receivedLetters(village, false).every((l) => l.openedAt === null)).toBe(true);
  });
  it("주민이 나 혼자면 받은 편지가 없다", () => {
    expect(receivedLetters(getDummyVillage({ id: "demo", n: 1, level: 0 }), true)).toEqual([]);
  });
});

describe("parseSentLetters (저장값 확인)", () => {
  const fallback = [{ recipientId: "r2", content: "기본", paper: "plain" as const, editedAt: null }];
  it("없거나 깨진 값이면 fallback", () => {
    expect(parseSentLetters(null, fallback)).toBe(fallback);
    expect(parseSentLetters("이상한 값", fallback)).toBe(fallback);
    expect(parseSentLetters([{ recipientId: 1 }], fallback)).toBe(fallback);
  });
  it("모양이 맞으면 그대로 쓴다 (빈 목록도 올바른 값)", () => {
    expect(parseSentLetters([], fallback)).toEqual([]);
    const saved = [{ recipientId: "r4", content: "글", paper: "tree", editedAt: null }];
    expect(parseSentLetters(saved, fallback)).toEqual(saved);
  });
  it("편지지 기능 전에 저장된 편지(paper 없음)는 기본 편지지로 채운다", () => {
    const old = [{ recipientId: "r4", content: "글", editedAt: null }];
    expect(parseSentLetters(old, fallback)).toEqual([{ recipientId: "r4", content: "글", paper: "plain", editedAt: null }]);
  });
});
