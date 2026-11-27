import { describe, expect, it } from "vitest";
import { isUnread, markOpenedInList, unreadCount } from "./reading";
import type { ReceivedLetter } from "./types";

const locked: ReceivedLetter = { id: "a", senderName: null, content: null, paper: null, openedAt: null };
const fresh: ReceivedLetter = { id: "b", senderName: "하은", content: "메리 크리스마스", paper: "snow", openedAt: null };
const seen: ReceivedLetter = { id: "c", senderName: "서연", content: "고마워", paper: "plain", openedAt: "2026-12-25T00:10:00+09:00" };

describe("isUnread / unreadCount", () => {
  it("잠긴 편지는 안 읽은 편지로 세지 않는다", () => {
    expect(isUnread(locked)).toBe(false);
  });
  it("잠금이 풀렸고 아직 안 연 편지만 안 읽은 편지", () => {
    expect(isUnread(fresh)).toBe(true);
    expect(isUnread(seen)).toBe(false);
    expect(unreadCount([locked, fresh, seen])).toBe(1);
    expect(unreadCount([])).toBe(0);
  });
});

describe("markOpenedInList", () => {
  const at = "2026-12-25T09:00:00+09:00";

  it("안 읽은 편지에 처음 연 시각을 적는다", () => {
    const next = markOpenedInList([fresh, seen], "b", at);
    expect(next[0].openedAt).toBe(at);
    expect(isUnread(next[0])).toBe(false);
  });
  it("원래 목록과 원래 편지는 바뀌지 않는다", () => {
    const list = [fresh, seen];
    const next = markOpenedInList(list, "b", at);
    expect(next).not.toBe(list);
    expect(fresh.openedAt).toBeNull();
    // 바뀌지 않은 편지는 같은 객체를 그대로 씁니다
    expect(next[1]).toBe(seen);
  });
  it("이미 연 편지의 시각은 바뀌지 않는다", () => {
    expect(markOpenedInList([seen], "c", at)[0].openedAt).toBe("2026-12-25T00:10:00+09:00");
  });
  it("잠긴 편지와 없는 편지는 그대로", () => {
    expect(markOpenedInList([locked], "a", at)[0].openedAt).toBeNull();
    expect(markOpenedInList([fresh], "없는-id", at)).toEqual([fresh]);
  });
});
