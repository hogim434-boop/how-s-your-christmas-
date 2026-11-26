// LINE 로그인 임시 값(lineState.ts) 테스트입니다.
import { describe, expect, it } from "vitest";
import { decodeLineState, encodeLineState } from "./lineState";

const value = { state: "s".repeat(32), nonce: "n".repeat(32), next: "/village/a", invite: null };

describe("lineState", () => {
  it("넣었다가 꺼내면 같은 값", () => {
    expect(decodeLineState(encodeLineState(value))).toEqual(value);
  });

  it("없거나 깨진 값, 너무 짧은 state는 null", () => {
    expect(decodeLineState(undefined)).toBeNull();
    expect(decodeLineState("not json")).toBeNull();
    expect(decodeLineState("123")).toBeNull();
    expect(decodeLineState(JSON.stringify({ ...value, state: "short" }))).toBeNull();
    expect(decodeLineState(JSON.stringify({ state: value.state }))).toBeNull();
  });

  it("next·invite가 글자가 아니면 비운다", () => {
    expect(decodeLineState(JSON.stringify({ ...value, next: 5, invite: ["a"] }))).toEqual({ ...value, next: null, invite: null });
  });
});
