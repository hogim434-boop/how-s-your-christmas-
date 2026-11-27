// "같은 마을에 지금 접속해 있는 다른 주민들"의 자리와 걸어갈 목표를 담아 두는 보관함입니다. (Task 025-2)
//
// 💡 walkStore.ts(내 캐릭터의 목표 보관함)와 같은 방식입니다.
//    - 주민이 "들어오거나 나갈 때"만 React에 알립니다 → 캐릭터 목록을 그리는 부품만 다시 그립니다.
//    - 자리·목표가 바뀔 때는 React에 알리지 않습니다 → 3D가 매 장면 이 보관함을 직접 읽습니다.
//      (알리면 누가 걸을 때마다 화면을 다시 훑어 끊기게 됩니다)
// 💡 이 보관함은 "누가 넣었는지" 모릅니다. 개발용 가짜 주민(lib/dummy/ghosts.ts)이 넣든,
//    나중에 실시간 통신(Task 025-5)이 넣든 3D 쪽 코드는 똑같이 동작합니다.

import { useSyncExternalStore } from "react";

/** 다른 주민 한 명의 움직임: 지금 자리(x, z)와 걸어갈 목표(tx, tz). 서 있으면 tx = x, tz = z */
export type RemoteMove = { x: number; z: number; tx: number; tz: number };

/** 보관함에 들어 있는 한 줄. seq는 새 소식이 올 때마다 1씩 늘어납니다 (3D가 "새 목표가 왔다"를 알아채는 표시) */
export type RemoteEntry = RemoteMove & { seq: number };

export type RemoteStore = {
  /** 지금 접속해 있는 다른 주민의 id 목록. 주민이 늘거나 줄 때만 새 배열로 바뀝니다 */
  getIds: () => readonly string[];
  /** id 목록이 바뀔 때 불러 줄 함수 등록. 돌려받은 함수를 부르면 등록이 풀립니다 */
  subscribeIds: (listener: () => void) => () => void;
  /** 한 주민의 지금 값 (없으면 undefined). 3D가 매 장면 읽습니다 */
  read: (id: string) => RemoteEntry | undefined;
  /** 주민의 움직임을 넣습니다. 처음 보는 id면 목록에 추가됩니다 */
  upsert: (id: string, move: RemoteMove) => void;
  /** 주민을 뺍니다 (나갔을 때) */
  remove: (id: string) => void;
  /** 모두 비웁니다 (연결이 끊겼을 때) */
  clear: () => void;
};

/** 빈 목록은 늘 같은 배열을 씁니다 (React가 "바뀐 게 없다"고 알아채게) */
const EMPTY: readonly string[] = [];

export function createRemoteStore(): RemoteStore {
  const entries = new Map<string, RemoteEntry>();
  let ids: readonly string[] = EMPTY;
  const listeners = new Set<() => void>();
  const notifyIds = () => {
    ids = entries.size === 0 ? EMPTY : [...entries.keys()];
    listeners.forEach((listener) => listener());
  };
  return {
    getIds: () => ids,
    subscribeIds: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read: (id) => entries.get(id),
    upsert: (id, move) => {
      const entry = entries.get(id);
      if (entry) {
        // 이미 있는 주민: 값만 고칩니다 (목록은 그대로라 React는 모릅니다)
        entry.x = move.x;
        entry.z = move.z;
        entry.tx = move.tx;
        entry.tz = move.tz;
        entry.seq += 1;
        return;
      }
      entries.set(id, { x: move.x, z: move.z, tx: move.tx, tz: move.tz, seq: 0 });
      notifyIds();
    },
    remove: (id) => {
      if (entries.delete(id)) notifyIds();
    },
    clear: () => {
      if (entries.size === 0) return;
      entries.clear();
      notifyIds();
    },
  };
}

/** 보관함의 id 목록을 읽습니다. 주민이 들어오거나 나갈 때만 이 함수를 쓴 부품이 다시 그려집니다 */
export function useRemoteIds(store: RemoteStore): readonly string[] {
  return useSyncExternalStore(store.subscribeIds, store.getIds, store.getIds);
}
