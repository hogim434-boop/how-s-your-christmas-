import { describe, expect, it } from "vitest";
import { mergeNames } from "./data";
import { initialNickname, NICKNAME_MAX, validateNickname } from "./nickname";

describe("validateNickname", () => {
  it("1~10자는 통과", () => {
    expect(validateNickname("호")).toBe("ok");
    expect(validateNickname("가".repeat(NICKNAME_MAX))).toBe("ok");
  });
  it("비었거나 띄어쓰기뿐이면 empty", () => {
    expect(validateNickname("")).toBe("empty");
    expect(validateNickname("   ")).toBe("empty");
  });
  it("10자를 넘으면 tooLong", () => {
    expect(validateNickname("가".repeat(NICKNAME_MAX + 1))).toBe("tooLong");
  });
  it("앞뒤 띄어쓰기는 세지 않고, 이모지는 한 글자로 센다", () => {
    expect(validateNickname("  " + "가".repeat(NICKNAME_MAX) + "  ")).toBe("ok");
    expect(validateNickname("🎄".repeat(NICKNAME_MAX))).toBe("ok");
  });
});

describe("initialNickname", () => {
  it("긴 로그인 닉네임은 10자까지만 채운다", () => {
    expect(initialNickname("가".repeat(30))).toBe("가".repeat(NICKNAME_MAX));
    expect(validateNickname(initialNickname("abcdefghi jklmn"))).toBe("ok");
  });
});

describe("mergeNames", () => {
  const users = [
    { id: "a", name: "LINE이름" },
    { id: "b", name: "카카오이름" },
  ];
  it("마을 닉네임이 있으면 그것을, 없으면 로그인 닉네임을 쓴다", () => {
    const names = mergeNames(users, [
      { user_id: "a", nickname: "호호" },
      { user_id: "b", nickname: null },
    ]);
    expect(names).toEqual({ a: "호호", b: "카카오이름" });
  });
  it("띄어쓰기뿐인 닉네임은 없는 것으로 본다", () => {
    expect(mergeNames(users, [{ user_id: "a", nickname: "  " }]).a).toBe("LINE이름");
  });
});
