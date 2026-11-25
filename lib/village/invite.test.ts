import { describe, expect, it } from "vitest";
import { inviteUrl } from "./invite";

describe("inviteUrl", () => {
  it("주소와 초대 코드를 이어 붙인다", () => {
    expect(inviteUrl("https://example.com", "abc")).toBe("https://example.com/invite/abc");
  });
  it("주소에 쓸 수 없는 글자는 안전하게 바꾼다", () => {
    expect(inviteUrl("https://example.com", "a b/c")).toBe("https://example.com/invite/a%20b%2Fc");
  });
});
