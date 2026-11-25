import { describe, expect, it } from "vitest";
import { draftFor, parseDraft } from "./drafts";
import { DEFAULT_PAPER, toPaperKey } from "./papers";

describe("toPaperKey", () => {
  it("아는 편지지는 그대로, 모르는 값은 기본 편지지", () => {
    expect(toPaperKey("snow")).toBe("snow");
    expect(toPaperKey("없는 편지지")).toBe(DEFAULT_PAPER);
    expect(toPaperKey(undefined)).toBe(DEFAULT_PAPER);
  });
});

describe("draftFor (임시 저장할지 정하기)", () => {
  const empty = { content: "", paper: DEFAULT_PAPER };
  it("새 편지에 글을 쓰면 저장한다", () => {
    expect(draftFor({ content: "안녕", paper: "plain" }, empty)).toEqual({ content: "안녕", paper: "plain" });
  });
  it("아무것도 안 썼거나 띄어쓰기만 있으면 저장하지 않는다", () => {
    expect(draftFor(empty, empty)).toBeNull();
    expect(draftFor({ content: "  ", paper: "plain" }, empty)).toBeNull();
  });
  it("글 없이 편지지만 바꾼 새 편지는 저장하지 않는다", () => {
    expect(draftFor({ content: "", paper: "snow" }, empty)).toBeNull();
  });
  it("보낸 편지를 고치는 중이면 저장하고, 원래대로 돌리면 지운다", () => {
    const sent = { content: "보낸 글", paper: "plain" as const };
    expect(draftFor({ content: "고친 글", paper: "plain" }, sent)).not.toBeNull();
    expect(draftFor({ content: "보낸 글", paper: "tree" }, sent)).not.toBeNull();
    expect(draftFor({ content: "보낸 글", paper: "plain" }, sent)).toBeNull();
  });
});

describe("parseDraft (저장값 확인)", () => {
  it("없거나 깨진 값이면 null", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("x")).toBeNull();
    expect(parseDraft({ paper: "snow" })).toBeNull();
  });
  it("편지지가 이상하면 기본 편지지로 고쳐서 쓴다", () => {
    expect(parseDraft({ content: "글", paper: "?" })).toEqual({ content: "글", paper: DEFAULT_PAPER });
    expect(parseDraft({ content: "글", paper: "candy" })).toEqual({ content: "글", paper: "candy" });
  });
});
