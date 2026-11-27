// "지금 이 마을에 접속해 있는 다른 주민이 누구인지"를 담아 두는 보관함입니다. (Task 025-6)
//
// 💡 remoteStore.ts(다른 주민의 자리 보관함)와 무엇이 다른가요?
//    - remoteStore: 캐릭터로 "그리는" 주민만 들어 있습니다 (한 화면에 가까운 MAX_REMOTE_AVATARS명까지).
//    - onlineStore: 접속해 있는 주민 "모두"가 들어 있습니다. 집 이름표의 초록 점(접속 중 표시)에 씁니다.
//      그래서 9번째 접속자도 캐릭터는 안 보이지만 "접속 중"인 것은 알 수 있습니다.
// 💡 주민이 들어오거나 나갈 때만 React에 알립니다. 누가 걸어 다니는 것으로는 화면이 다시 그려지지 않습니다.

import { useSyncExternalStore } from "react";

export type OnlineStore = {
  /** 지금 접속해 있는 다른 주민의 id 목록 (나는 빠져 있습니다). 바뀔 때만 새 배열이 됩니다 */
  getIds: () => readonly string[];
  /** 목록이 바뀔 때 불러 줄 함수 등록. 돌려받은 함수를 부르면 등록이 풀립니다 */
  subscribe: (listener: () => void) => () => void;
  /** 목록을 통째로 바꿉니다. 내용이 같으면 아무 일도 하지 않습니다 */
  set: (ids: readonly string[]) => void;
};

/** 빈 목록은 늘 같은 배열을 씁니다 (React가 "바뀐 게 없다"고 알아채게) */
const EMPTY: readonly string[] = [];

export function createOnlineStore(): OnlineStore {
  let ids: readonly string[] = EMPTY;
  const listeners = new Set<() => void>();
  return {
    getIds: () => ids,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      const sorted = [...next].sort();
      if (sorted.length === ids.length && sorted.every((id, i) => id === ids[i])) return;
      ids = sorted.length === 0 ? EMPTY : sorted;
      listeners.forEach((listener) => listener());
    },
  };
}

/** 접속 중인 주민 목록을 읽습니다. 누가 들어오거나 나갈 때만 이 함수를 쓴 부품이 다시 그려집니다 */
export function useOnlineIds(store: OnlineStore | undefined): readonly string[] {
  return useSyncExternalStore(store ? store.subscribe : subscribeNothing, store ? store.getIds : getEmpty, getEmpty);
}

const subscribeNothing = () => () => {};
const getEmpty = () => EMPTY;
