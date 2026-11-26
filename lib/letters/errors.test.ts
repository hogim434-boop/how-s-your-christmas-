// 편지 오류 분류(parseLetterError)와 편지 목록 도우미가 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { parseLetterError } from "./errors";
import { putSentLetter, toSentLetter, type SentLetter } from "./types";

describe("parseLetterError", () => {
  it("잠금 시각이 지나 거절된 경우는 closed", () => {
    expect(parseLetterError({ code: "42501", message: "new row violates row-level security policy" })).toBe("closed");
    expect(parseLetterError({ code: "P0001", message: "closed" })).toBe("closed");
  });
  it("한 사람에게 두 통은 duplicate", () => {
    expect(parseLetterError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe("duplicate");
  });
  it("우리 함수가 알려 준 이유", () => {
    expect(parseLetterError({ code: "P0001", message: "not_resident" })).toBe("not_resident");
    expect(parseLetterError({ code: "P0001", message: "not_found" })).toBe("not_found");
  });
  it("모르는 오류·빈 값은 failed", () => {
    expect(parseLetterError({ message: "Failed to fetch" })).toBe("failed");
    expect(parseLetterError(null)).toBe("failed");
    expect(parseLetterError(undefined)).toBe("failed");
  });
});

describe("toSentLetter / putSentLetter", () => {
  const row = { id: "l1", recipient_id: "u2", content: "안녕", paper: "snow", edited_at: null };
  it("데이터베이스 줄을 화면용으로 바꾼다 (모르는 편지지는 기본 편지지)", () => {
    expect(toSentLetter(row)).toEqual({ id: "l1", recipientId: "u2", content: "안녕", paper: "snow", editedAt: null });
    expect(toSentLetter({ ...row, paper: "이상한 값" }).paper).toBe("plain");
  });
  it("새 편지는 뒤에 붙이고, 같은 사람에게 보낸 편지는 그 자리를 바꾼다", () => {
    const a: SentLetter = toSentLetter(row);
    const b: SentLetter = { ...a, id: "l2", recipientId: "u3" };
    const list = putSentLetter([a], b);
    expect(list.map((l) => l.id)).toEqual(["l1", "l2"]);
    const edited = putSentLetter(list, { ...a, content: "고침", editedAt: "2026-12-01T00:00:00Z" });
    expect(edited.map((l) => l.content)).toEqual(["고침", "안녕"]);
    // 원래 목록은 그대로
    expect(list[0].content).toBe("안녕");
  });
});
