// 캐릭터가 걸어갈 목표를 담아 두는 작은 "보관함"입니다. (11.26 성능: 탭할 때 끊김 줄이기)
//
// 💡 왜 따로 두나요?
//    예전에는 걸어갈 목표를 마을 화면(VillageView)의 React 상태(useState)로 두었습니다.
//    그러면 땅을 누를 때마다 React가 마을 화면 전체(집 20채, 우체통, 장식…)를 다시 훑어봅니다.
//    휴대폰에서는 그 일이 6~11ms 걸려서, 걷기 시작하는 순간 화면이 한두 장 끊겼습니다.
//    이 보관함에 넣으면 "목표를 실제로 쓰는 부품"(캐릭터, 누른 자리 표시)만 다시 그립니다.
//
// 💡 useSyncExternalStore: React 바깥에 있는 값이 바뀌면 그 값을 쓰는 부품만 다시 그리게 해 주는 React 기능입니다.

import { useSyncExternalStore } from "react";

/** 걸어갈 목표. 땅을 누를 때마다 id가 바뀝니다 (같은 자리를 다시 눌러도 새 목표로 받아들이기 위해) */
export type WalkTarget = { x: number; z: number; id: number };

export type WalkStore = {
  /** 지금 목표 (없으면 null) */
  get: () => WalkTarget | null;
  /** 새 목표 넣기 */
  set: (point: { x: number; z: number }) => void;
  /** 목표가 바뀔 때 불러 줄 함수 등록. 돌려받은 함수를 부르면 등록이 풀립니다 */
  subscribe: (listener: () => void) => () => void;
  /**
   * 내 캐릭터가 지금 서 있는 자리 (캐릭터가 아직 그려지기 전이면 null).
   * 함께 걷기(Task 025-5)에서 다른 주민에게 "나 지금 여기 있어요"를 알릴 때 읽습니다.
   */
  getPos: () => { x: number; z: number } | null;
  /** 캐릭터가 움직일 때마다 자리를 적어 둡니다. 아무에게도 알리지 않으므로 화면이 다시 그려지지 않습니다 */
  setPos: (x: number, z: number) => void;
};

export function createWalkStore(): WalkStore {
  let target: WalkTarget | null = null;
  const listeners = new Set<() => void>();
  // 지금 자리는 같은 객체의 숫자만 고쳐 씁니다 (걷는 동안 매 장면 불리므로 새로 만들지 않습니다)
  const pos = { x: 0, z: 0 };
  let hasPos = false;
  return {
    get: () => target,
    getPos: () => (hasPos ? pos : null),
    setPos: (x, z) => {
      pos.x = x;
      pos.z = z;
      hasPos = true;
    },
    set: (point) => {
      target = { x: point.x, z: point.z, id: (target?.id ?? 0) + 1 };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** 보관함의 목표를 읽습니다. 목표가 바뀌면 이 함수를 쓴 부품만 다시 그려집니다 */
export function useWalkTarget(store: WalkStore): WalkTarget | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
