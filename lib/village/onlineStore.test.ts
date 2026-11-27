import { describe, expect, it, vi } from "vitest";
import { createOnlineStore } from "./onlineStore";

describe("onlineStore", () => {
  it("처음에는 비어 있다", () => {
    expect(createOnlineStore().getIds()).toEqual([]);
  });

  it("목록이 바뀔 때만 알린다 (순서만 다른 같은 목록은 알리지 않음)", () => {
    const store = createOnlineStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(["b", "a"]);
    expect(store.getIds()).toEqual(["a", "b"]);
    expect(listener).toHaveBeenCalledTimes(1);
    const before = store.getIds();
    store.set(["a", "b"]);
    expect(listener).toHaveBeenCalledTimes(1);
    // 바뀌지 않았으면 같은 배열 그대로 (React가 다시 그리지 않게)
    expect(store.getIds()).toBe(before);
    store.set(["a"]);
    expect(listener).toHaveBeenCalledTimes(2);
    store.set([]);
    expect(store.getIds()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("등록을 풀면 더 알리지 않는다", () => {
    const store = createOnlineStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.set(["a"]);
    expect(listener).not.toHaveBeenCalled();
  });
});
