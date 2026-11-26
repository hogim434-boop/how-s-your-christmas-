// 카카오 사용자 정보 꺼내기(kakaoProfile)가 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { kakaoProfile } from "./kakao";

describe("kakaoProfile", () => {
  it("연결된 카카오 정보에서 번호와 닉네임을 꺼낸다", () => {
    const user = { identities: [{ provider: "kakao", id: "x", identity_data: { sub: "12345", name: "서연" } }] };
    expect(kakaoProfile(user)).toEqual({ providerUserId: "12345", name: "서연" });
  });

  it("번호가 숫자로 와도 글자로 바꿔 준다", () => {
    const user = { identities: [{ provider: "kakao", identity_data: { provider_id: 987, nickname: "민준" } }] };
    expect(kakaoProfile(user)).toEqual({ providerUserId: "987", name: "민준" });
  });

  it("닉네임이 없으면 name은 null (부르는 쪽에서 기본 이름을 씁니다)", () => {
    const user = { identities: [{ provider: "kakao", identity_data: { sub: "1" } }], user_metadata: {} };
    expect(kakaoProfile(user)).toEqual({ providerUserId: "1", name: null });
  });

  it("덧붙은 정보(user_metadata)에서도 찾는다", () => {
    const user = { identities: [{ provider: "kakao", id: "777" }], user_metadata: { full_name: "지우" } };
    expect(kakaoProfile(user)).toEqual({ providerUserId: "777", name: "지우" });
  });

  it("카카오로 로그인한 계정이 아니면 null", () => {
    expect(kakaoProfile({ identities: [{ provider: "email", id: "a" }] })).toBeNull();
    expect(kakaoProfile({})).toBeNull();
  });
});
