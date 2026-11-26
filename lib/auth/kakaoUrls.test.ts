import { describe, expect, it } from "vitest";
import { buildKakaoAuthorizeUrl, kakaoEmail, parseKakaoUser } from "./kakaoUrls";

describe("buildKakaoAuthorizeUrl", () => {
  it("닉네임만 요청하고 이메일은 요청하지 않는다", () => {
    const url = new URL(buildKakaoAuthorizeUrl({ clientId: "abc", redirectUri: "https://app.test/auth/kakao/callback", state: "s".repeat(32) }));
    expect(url.origin + url.pathname).toBe("https://kauth.kakao.com/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("profile_nickname");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("abc");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/auth/kakao/callback");
    expect(url.searchParams.get("state")).toBe("s".repeat(32));
    expect(url.toString()).not.toContain("account_email");
  });
});

describe("parseKakaoUser", () => {
  it("사용자 번호(숫자)와 닉네임을 꺼낸다", () => {
    expect(parseKakaoUser({ id: 1234567890, kakao_account: { profile: { nickname: "호" } } })).toEqual({ id: "1234567890", name: "호" });
  });
  it("닉네임이 예전 자리(properties)에 있어도 꺼낸다", () => {
    expect(parseKakaoUser({ id: 7, properties: { nickname: "눈사람" } })).toEqual({ id: "7", name: "눈사람" });
  });
  it("닉네임이 없으면 이름은 null", () => {
    expect(parseKakaoUser({ id: 7 })).toEqual({ id: "7", name: null });
    expect(parseKakaoUser({ id: 7, kakao_account: { profile: { nickname: "  " } } })).toEqual({ id: "7", name: null });
  });
  it("번호가 없거나 이상하면 null", () => {
    expect(parseKakaoUser(null)).toBeNull();
    expect(parseKakaoUser({})).toBeNull();
    expect(parseKakaoUser({ id: "abc" })).toBeNull();
    expect(parseKakaoUser({ id: 1.5 })).toBeNull();
    expect(parseKakaoUser({ id: "12; drop" })).toBeNull();
  });
});

describe("kakaoEmail", () => {
  it("사용자마다 다른, 실제로는 없는 주소를 만든다", () => {
    expect(kakaoEmail("123")).toBe("kakao_123@kakao.hows-your-christmas.invalid");
  });
});
