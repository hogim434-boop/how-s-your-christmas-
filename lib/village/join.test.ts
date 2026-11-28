// 입주 결과 규칙(lib/village/join.ts)이 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { joinDestination, joinFailureDestination, parseInviteError, parseJoinError } from "./join";

describe("parseJoinError", () => {
  it("데이터베이스 오류 글에서 이유를 알아낸다", () => {
    expect(parseJoinError("invalid_invite")).toBe("invalid_invite");
    expect(parseJoinError("couple_full")).toBe("couple_full");
    expect(parseJoinError("village_full")).toBe("village_full");
    expect(parseJoinError("not_signed_in")).toBe("not_signed_in");
  });
  it("모르는 글·빈 값은 일반 실패", () => {
    expect(parseJoinError("connection reset")).toBe("failed");
    expect(parseJoinError(null)).toBe("failed");
    expect(parseJoinError(undefined)).toBe("failed");
  });
});

describe("joinDestination", () => {
  it("처음 입주하면 꾸미기 창을 열고, 원래 주민이면 바로 마을", () => {
    expect(joinDestination("v1", false)).toBe("/village/v1?customize=1");
    expect(joinDestination("v1", true)).toBe("/village/v1");
  });
});

describe("joinFailureDestination", () => {
  it("없는 코드는 초대 화면으로, 나머지는 이유를 붙여서", () => {
    expect(joinFailureDestination("abc", "invalid_invite")).toBe("/invite/abc");
    expect(joinFailureDestination("abc", "couple_full")).toBe("/invite/abc?error=couple_full");
    expect(joinFailureDestination("abc", "failed")).toBe("/invite/abc?error=failed");
  });
});

describe("parseInviteError", () => {
  it("아는 값만 받아들인다", () => {
    expect(parseInviteError("couple_full")).toBe("couple_full");
    expect(parseInviteError("failed")).toBe("failed");
    expect(parseInviteError("invalid_invite")).toBeUndefined();
    expect(parseInviteError(["couple_full"])).toBeUndefined();
    expect(parseInviteError(undefined)).toBeUndefined();
  });
});
