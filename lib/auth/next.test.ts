// 화면 이동 규칙(next.ts)이 약속을 지키는지 확인하는 테스트입니다.
import { describe, expect, it } from "vitest";
import { devToolsEnabled, isProtectedPath, loginUrl, parseAuthError, parseNotice, resolveAfterLogin, safeInviteCode, safeNextPath } from "./next";

describe("safeNextPath", () => {
  it("우리 앱 안의 주소는 그대로 돌려준다", () => {
    expect(safeNextPath("/village/abc")).toBe("/village/abc");
    expect(safeNextPath("/villages/new")).toBe("/villages/new");
    expect(safeNextPath("/village/abc?customize=1")).toBe("/village/abc?customize=1");
  });

  it("다른 사이트로 넘어갈 수 있는 값은 받지 않는다", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/a\\b",
      "javascript:alert(1)",
      "evil.com",
      "/a\nb",
      "/a\u0000b",
      "",
      "/",
      "/" + "a".repeat(400),
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });

  it("글자가 아닌 값(없음, 배열)은 받지 않는다", () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(["/village/a"])).toBeNull();
  });

  it("로그인 처리용 주소로는 돌려보내지 않는다", () => {
    expect(safeNextPath("/auth/callback")).toBeNull();
    expect(safeNextPath("/auth/line/start?next=/x")).toBeNull();
  });
});

describe("safeInviteCode", () => {
  it("영문·숫자·-·_ 만 받는다", () => {
    expect(safeInviteCode("Ab3_-x")).toBe("Ab3_-x");
    expect(safeInviteCode("a/b")).toBeNull();
    expect(safeInviteCode("../x")).toBeNull();
    expect(safeInviteCode("")).toBeNull();
    expect(safeInviteCode("a".repeat(65))).toBeNull();
    expect(safeInviteCode(undefined)).toBeNull();
  });
});

describe("isProtectedPath", () => {
  it("마을 만들기와 마을 화면은 로그인이 필요하다", () => {
    expect(isProtectedPath("/villages/new")).toBe(true);
    expect(isProtectedPath("/village/3f2a")).toBe(true);
    expect(isProtectedPath("/village/3f2a/anything")).toBe(true);
  });

  it("로그인 화면, 초대 화면, 연습용 마을은 로그인 없이 열린다", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/invite/abc")).toBe(false);
    expect(isProtectedPath("/village/demo")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
  });

  it("연습용 마을과 이름만 비슷한 주소는 로그인이 필요하다", () => {
    expect(isProtectedPath("/village/demo2")).toBe(true);
  });
});

describe("loginUrl", () => {
  it("붙일 것이 없으면 그냥 첫 화면", () => {
    expect(loginUrl()).toBe("/");
  });

  it("돌아갈 주소와 안내를 ? 뒤에 붙인다", () => {
    expect(loginUrl({ next: "/village/a" })).toBe("/?next=%2Fvillage%2Fa");
    expect(loginUrl({ error: "cancelled" })).toBe("/?error=cancelled");
    expect(loginUrl({ invite: "abc", notice: "not_resident" })).toBe("/?invite=abc&notice=not_resident");
  });

  it("위험한 next는 붙이지 않는다", () => {
    expect(loginUrl({ next: "//evil.com" })).toBe("/");
  });
});

describe("resolveAfterLogin", () => {
  it("속한 마을이 없으면 마을 만들기로", () => {
    expect(resolveAfterLogin({ villageIds: [] })).toBe("/villages/new");
  });

  it("속한 마을이 있으면 마지막으로 들어간 마을로", () => {
    expect(resolveAfterLogin({ villageIds: ["v2", "v1"], lastVillageId: "v1" })).toBe("/village/v1");
  });

  it("마지막 마을 기억이 없거나 이제 주민이 아니면 가장 최근에 입주한 마을로", () => {
    expect(resolveAfterLogin({ villageIds: ["v2", "v1"] })).toBe("/village/v2");
    expect(resolveAfterLogin({ villageIds: ["v2", "v1"], lastVillageId: "gone" })).toBe("/village/v2");
  });

  it("원래 가려던 주소가 있으면 그곳으로", () => {
    expect(resolveAfterLogin({ villageIds: ["v1"], next: "/villages/new" })).toBe("/villages/new");
  });

  it("초대 링크로 왔으면 그 초대 화면이 가장 먼저", () => {
    expect(resolveAfterLogin({ villageIds: ["v1"], next: "/village/v1", inviteCode: "abc" })).toBe("/invite/abc");
  });

  it("위험한 next·초대 코드는 무시한다", () => {
    expect(resolveAfterLogin({ villageIds: [], next: "https://evil.com", inviteCode: "../x" })).toBe("/villages/new");
  });
});

describe("parseAuthError / parseNotice", () => {
  it("아는 값만 받는다", () => {
    expect(parseAuthError("cancelled")).toBe("cancelled");
    expect(parseAuthError("<script>")).toBeUndefined();
    expect(parseNotice("not_resident")).toBe("not_resident");
    expect(parseNotice(["not_resident"])).toBeUndefined();
  });
});

describe("devToolsEnabled", () => {
  it("내 컴퓨터에서 개발할 때만 켜진다", () => {
    expect(devToolsEnabled("development")).toBe(true);
  });
  it("배포된 서비스(운영)와 그 밖의 경우에는 꺼진다", () => {
    expect(devToolsEnabled("production", undefined)).toBe(false);
    expect(devToolsEnabled("test", undefined)).toBe(false);
    expect(devToolsEnabled(undefined, undefined)).toBe(false);
  });
  it("운영 빌드라도 HYC_DEV_TOOLS=1 이면 켜진다 (내 컴퓨터에서 성능을 잴 때)", () => {
    expect(devToolsEnabled("production", "1")).toBe(true);
  });
  it("HYC_DEV_TOOLS 값이 1이 아니면 켜지지 않는다", () => {
    for (const flag of ["0", "true", "", " 1"]) expect(devToolsEnabled("production", flag)).toBe(false);
  });
});
