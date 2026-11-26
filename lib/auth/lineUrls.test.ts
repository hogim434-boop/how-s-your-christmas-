// LINE 로그인 주소 만들기(lineUrls.ts)가 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { buildLineAuthorizeUrl, isLineUserId, lineEmail } from "./lineUrls";

describe("buildLineAuthorizeUrl", () => {
  it("LINE 로그인 화면 주소에 필요한 값을 모두 붙인다", () => {
    const url = new URL(
      buildLineAuthorizeUrl({ channelId: "123", redirectUri: "http://localhost:3000/auth/line/callback", state: "s t", nonce: "n&1" }),
    );
    expect(url.origin + url.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/auth/line/callback");
    expect(url.searchParams.get("scope")).toBe("profile openid");
    // 특수 문자가 섞여도 값이 깨지지 않는다
    expect(url.searchParams.get("state")).toBe("s t");
    expect(url.searchParams.get("nonce")).toBe("n&1");
  });
});

describe("lineEmail / isLineUserId", () => {
  it("같은 사용자 번호면 항상 같은 주소", () => {
    expect(lineEmail("U1234abcd")).toBe("line_u1234abcd@line.hows-your-christmas.invalid");
    expect(lineEmail("U1234ABCD")).toBe(lineEmail("u1234abcd"));
  });

  it("사용자 번호 모양이 아니면 받지 않는다", () => {
    expect(isLineUserId("U" + "a1".repeat(16))).toBe(true);
    expect(isLineUserId("a@b")).toBe(false);
    expect(isLineUserId("")).toBe(false);
    expect(isLineUserId(undefined)).toBe(false);
  });
});
