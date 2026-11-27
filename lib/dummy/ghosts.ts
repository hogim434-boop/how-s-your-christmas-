// 개발용 "가짜 주민"을 보관함에 넣어 주는 곳입니다. (Task 025-2)
// 주소에 ?ghosts=5 를 붙이면 다른 주민 5명이 접속해 있는 것처럼 보이고, &ghostwalk=1 이면 걸어 다닙니다.
// 실시간 통신 없이 "다른 주민 그리기"를 확인하고, 몇 명까지 그려도 느려지지 않는지 잴 때 씁니다.
//
// 💡 난수는 Math.random이 아니라 "시드가 같으면 늘 같은 수열"을 주는 함수를 씁니다.
//    → 잴 때마다 같은 자리에서 시작해서 결과를 비교할 수 있습니다.

import { resolveCollisions, type Circle, type Point } from "@/lib/village/collision";
import type { RemoteStore } from "@/lib/village/remoteStore";
import { BODY_RADIUS } from "@/lib/village/walker";

/** 가짜 주민 수의 최댓값. 목표 상한(25명, Task 026)보다 조금 넉넉하게 두어 그 너머도 재 볼 수 있게 합니다 */
export const MAX_GHOSTS = 30;

/** 가짜 주민 이름 */
const GHOST_NAMES = [
  "하은", "さくら", "민준", "はると", "서연", "ひなた", "지우", "りん", "도윤", "あおい",
  "수아", "そうた", "예린", "みお", "현우", "ゆな", "지안", "れん", "소라",
  "ゆい", "시우", "かいと", "채원", "めい", "준서", "こはる", "다은", "りく", "유나", "つむぎ",
];

export const ghostId = (i: number) => `ghost-${i + 1}`;

/** 가짜 주민의 id → 이름 목록 (이름표용) */
export function ghostNames(count: number): Record<string, string> {
  const names: Record<string, string> = {};
  for (let i = 0; i < Math.min(count, MAX_GHOSTS); i++) names[ghostId(i)] = GHOST_NAMES[i % GHOST_NAMES.length];
  return names;
}

/** 시드가 같으면 항상 같은 수열을 돌려주는 작은 난수 함수 (mulberry32) */
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 가짜 주민이 서 있거나 걸어갈 범위: 광장 둘레 (가운데에서 이 거리 사이) */
const MIN_RADIUS = 4.5;
const MAX_RADIUS = 14;

interface GhostOptions {
  store: RemoteStore;
  /** 가짜 주민 수 (0~MAX_GHOSTS) */
  count: number;
  /** true면 2~5초마다 새 목표를 줘서 걸어 다니게 합니다 */
  walk: boolean;
  /** 마을의 장애물과 경계 (서 있는 자리가 집·트리 안이 되지 않게) */
  obstacles: Circle[];
  boundsRadius: number;
}

/** 가짜 주민을 보관함에 넣습니다. 돌려받은 함수를 부르면 모두 빼고 멈춥니다 */
export function startGhosts({ store, count, walk, obstacles, boundsRadius }: GhostOptions): () => void {
  const n = Math.max(0, Math.min(MAX_GHOSTS, Math.floor(count)));
  const random = seededRandom(20261225);
  const maxRadius = Math.max(MIN_RADIUS + 1, Math.min(MAX_RADIUS, boundsRadius - 1.5));
  const randomPoint = (): Point => {
    const angle = random() * Math.PI * 2;
    const radius = MIN_RADIUS + random() * (maxRadius - MIN_RADIUS);
    return resolveCollisions({ x: Math.sin(angle) * radius, z: Math.cos(angle) * radius }, obstacles, boundsRadius, BODY_RADIUS);
  };

  const timers: ReturnType<typeof setTimeout>[] = [];
  for (let i = 0; i < n; i++) {
    const id = ghostId(i);
    // 지금 서 있다고 알려 둔 자리 (새 목표를 줄 때 "여기서 출발"로 함께 보냅니다)
    let at = randomPoint();
    store.upsert(id, { x: at.x, z: at.z, tx: at.x, tz: at.z });
    if (!walk) continue;
    const wander = () => {
      const to = randomPoint();
      store.upsert(id, { x: at.x, z: at.z, tx: to.x, tz: to.z });
      at = to;
      timers[i] = setTimeout(wander, 2000 + random() * 3000);
    };
    timers[i] = setTimeout(wander, 300 + random() * 2000);
  }
  return () => {
    timers.forEach((timer) => clearTimeout(timer));
    for (let i = 0; i < n; i++) store.remove(ghostId(i));
  };
}
