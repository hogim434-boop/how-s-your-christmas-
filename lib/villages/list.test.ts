import { describe, expect, it } from "vitest";
import { toVillageList, type MyVillageRow } from "./list";

const row = (over: Partial<MyVillageRow>): MyVillageRow => ({
  id: "v1",
  name: "마을",
  kind: "friends",
  resident_count: 3,
  done_count: 0,
  my_nickname: "나",
  ...over,
});

describe("toVillageList", () => {
  it("친구 마을: 3명이 1통 쓰면 16%, 장식 1단계", () => {
    const [item] = toVillageList([row({ done_count: 1 })], null);
    expect(item.percent).toBe(16);
    expect(item.level).toBe(1);
    expect(item.residentCount).toBe(3);
  });

  it("혼자인 마을은 0%", () => {
    const [item] = toVillageList([row({ resident_count: 1, done_count: 0 })], null);
    expect(item.percent).toBe(0);
    expect(item.level).toBe(0);
  });

  it("커플 마을: 둘이 5개를 채우면 50%, 혼자면 0%", () => {
    expect(toVillageList([row({ kind: "couple", resident_count: 2, done_count: 5 })], null)[0]).toMatchObject({ kind: "couple", percent: 50, level: 5 });
    expect(toVillageList([row({ kind: "couple", resident_count: 1, done_count: 3 })], null)[0].percent).toBe(0);
  });

  it("다 쓰면 100%, 10단계 (넘쳐도 100%)", () => {
    expect(toVillageList([row({ done_count: 6 })], null)[0]).toMatchObject({ percent: 100, level: 10 });
    expect(toVillageList([row({ done_count: 99 })], null)[0]).toMatchObject({ percent: 100, level: 10 });
  });

  it("지금 마을을 맨 위로 올리고, 나머지는 받은 순서 그대로", () => {
    const list = toVillageList([row({ id: "a" }), row({ id: "b" }), row({ id: "c" }), row({ id: "d" })], "c");
    expect(list.map((v) => v.id)).toEqual(["c", "a", "b", "d"]);
    expect(list.map((v) => v.isCurrent)).toEqual([true, false, false, false]);
  });

  it("지금 마을이 목록에 없으면 순서를 바꾸지 않는다", () => {
    const list = toVillageList([row({ id: "a" }), row({ id: "b" })], "x");
    expect(list.map((v) => v.id)).toEqual(["a", "b"]);
    expect(list.some((v) => v.isCurrent)).toBe(false);
  });

  it("모르는 종류는 친구 마을로, 이름이 없으면 빈 글자로", () => {
    const [item] = toVillageList([row({ kind: "???", my_nickname: null })], null);
    expect(item.kind).toBe("friends");
    expect(item.myNickname).toBe("");
  });

  it("빈 목록은 빈 목록", () => {
    expect(toVillageList([], "a")).toEqual([]);
  });
});
