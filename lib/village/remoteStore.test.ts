import { describe, expect, it, vi } from "vitest";
import { createRemoteStore } from "./remoteStore";

const move = (x: number, z: number, tx = x, tz = z) => ({ x, z, tx, tz });

describe("createRemoteStore", () => {
  it("처음에는 비어 있고, 빈 목록은 늘 같은 배열이다", () => {
    const store = createRemoteStore();
    expect(store.getIds()).toEqual([]);
    expect(store.getIds()).toBe(store.getIds());
    expect(store.read("a")).toBeUndefined();
  });

  it("처음 보는 id를 넣으면 목록이 새 배열로 바뀌고 알림이 간다", () => {
    const store = createRemoteStore();
    const listener = vi.fn();
    store.subscribeIds(listener);
    const before = store.getIds();
    store.upsert("a", move(1, 2, 3, 4));
    expect(store.getIds()).toEqual(["a"]);
    expect(store.getIds()).not.toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.read("a")).toEqual({ x: 1, z: 2, tx: 3, tz: 4, seq: 0 });
  });

  it("이미 있는 주민의 자리·목표가 바뀌어도 목록 배열은 그대로이고 알림도 가지 않는다", () => {
    const store = createRemoteStore();
    store.upsert("a", move(1, 2));
    store.upsert("b", move(5, 6));
    const listener = vi.fn();
    store.subscribeIds(listener);
    const ids = store.getIds();
    const entry = store.read("a");
    store.upsert("a", move(1, 2, 9, 9));
    store.upsert("a", move(9, 9, 0, 0));
    expect(store.getIds()).toBe(ids);
    expect(listener).not.toHaveBeenCalled();
    // 같은 객체를 고쳐 쓰고, 새 소식마다 seq가 늘어납니다
    expect(store.read("a")).toBe(entry);
    expect(store.read("a")).toEqual({ x: 9, z: 9, tx: 0, tz: 0, seq: 2 });
  });

  it("빼면 목록에서 사라지고 알림이 간다. 없는 id를 빼면 아무 일도 없다", () => {
    const store = createRemoteStore();
    store.upsert("a", move(1, 2));
    store.upsert("b", move(5, 6));
    const listener = vi.fn();
    store.subscribeIds(listener);
    store.remove("zzz");
    expect(listener).not.toHaveBeenCalled();
    store.remove("a");
    expect(store.getIds()).toEqual(["b"]);
    expect(store.read("a")).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clear는 모두 비운다. 이미 비어 있으면 알리지 않는다", () => {
    const store = createRemoteStore();
    const listener = vi.fn();
    store.subscribeIds(listener);
    store.clear();
    expect(listener).not.toHaveBeenCalled();
    store.upsert("a", move(1, 2));
    store.clear();
    expect(store.getIds()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("등록을 풀면 더 이상 알림이 오지 않는다", () => {
    const store = createRemoteStore();
    const listener = vi.fn();
    const off = store.subscribeIds(listener);
    off();
    store.upsert("a", move(1, 2));
    expect(listener).not.toHaveBeenCalled();
  });
});
