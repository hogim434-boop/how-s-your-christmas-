// "함께 걷기"(같은 마을에 접속한 주민이 서로 보이는 기능, Task 025)에서 쓰는 약속들입니다.
// 시작 자리 계산과, 실시간 통신의 메시지 규칙(무엇을 언제 보내고, 받은 값을 어떻게 확인하는지)이 있습니다.
// 모두 계산만 하는 순수 함수라서 테스트(liveProtocol.test.ts)로 확인합니다. 실제 연결은 useLiveWalk.ts가 합니다.

import { buildObstacles, resolveCollisions, type Point } from "./collision";
import { PLAYER_START } from "./layout";
import { BODY_RADIUS } from "./walker";

/** 시작 자리를 흩어 놓는 원의 반지름 */
const SPAWN_RING_RADIUS = 1.5;

/** 글자를 숫자 하나로 바꿉니다 (같은 글자면 늘 같은 숫자). FNV-1a라는 간단한 방법입니다 */
export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 마을에 들어왔을 때 서 있을 자리.
 * 모두가 같은 한 점에서 시작하면 캐릭터가 겹쳐 보이므로, 사용자 번호로 정한 방향으로 조금씩 흩어 놓습니다.
 * 같은 사용자 번호면 누구의 화면에서 계산해도 같은 자리가 나옵니다.
 */
export function spawnPoint(userId: string): Point {
  const angle = (hashText(userId) % 3600) / 3600 * Math.PI * 2;
  const wanted = {
    x: PLAYER_START.x + Math.sin(angle) * SPAWN_RING_RADIUS,
    z: PLAYER_START.z + Math.cos(angle) * SPAWN_RING_RADIUS,
  };
  // 광장의 트리·가로등과 겹치면 바깥으로 밀어냅니다 (집은 멀리 있어서 볼 필요가 없습니다)
  return resolveCollisions(wanted, buildObstacles([]), Infinity, BODY_RADIUS);
}

// ---------------------------------------------------------------------------
// 실시간 통신의 메시지 규칙 (Task 025-5)
// ---------------------------------------------------------------------------
// 💡 원칙: "지금 어디 있는지"를 계속 보내지 않고, "어디로 걸어갈지(목표)"만 보냅니다.
//    받은 쪽이 같은 걷기 계산(walker.ts)으로 직접 걸려 보내므로, 메시지는 땅을 누를 때 한 번이면 됩니다.

/** 마을 하나가 1초에 쓸 수 있는 메시지 수(받는 사람 수만큼 곱해 셉니다). Supabase 무료 한도는 프로젝트 전체 초당 100개 */
export const LIVE_BUDGET_PER_SECOND = 25;

/**
 * 한 화면에 캐릭터로 그리는 다른 주민의 최대 수. 넘으면 가까운 순으로 이만큼만 그리고, 나머지는 집 이름표의 초록 점으로만 보입니다.
 * - 8 (Task 025-3): 주민마다 따로 그리던 때의 권장값
 * - 25 (Task 026): 모두를 한 번에 그리는 방식(RemoteCrowd.tsx)으로 바꾸면서 올림. 반 친구 전체(약 25명)가 함께 있는 경우를 목표로 함
 * - 30 (11.27 사용자 요청): 사용자의 실제 휴대폰에서 25명일 때 밤 화면이 초당 50장 가까이 나와 여유가 있다고 보고 올림
 * 휴대폰에서 느리면 이 숫자 하나만 낮추면 됩니다 (그리기 쪽 한도는 RemoteCrowd.tsx의 CROWD_CAPACITY = 32 — 이 값을 넘겨 올릴 때는 그쪽도 함께 올려야 합니다)
 */
export const MAX_REMOTE_AVATARS = 30;

/** 내 방송 사이 간격의 가장 긴 값(밀리초). 사람이 아무리 많아도 이보다 길게 기다리지 않습니다 (sendIntervalMs 설명 참고) */
export const MAX_SEND_INTERVAL_MS = 10000;

/** 걸어갈 목표를 알리는 방송의 이름. 짧을수록 메시지가 작아집니다 */
export const MOVE_EVENT = "m";

/** 방송 한 건: 보낸 사람(id), 지금 자리(x, z), 걸어갈 목표(tx, tz). 서 있으면 tx = x, tz = z */
export type MoveMessage = { id: string; x: number; z: number; tx: number; tz: number };

/** 마을의 실시간 채널 이름. 데이터베이스의 권한 규칙(마이그레이션 07)이 이 모양만 허락합니다 */
export function villageTopic(villageId: string): string {
  return `village:${villageId}`;
}

/** 사용자 번호(uuid)의 모양 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** 경계에 딱 붙은 자리가 계산 오차로 버려지지 않게 두는 여유 */
const BOUNDS_MARGIN = 0.5;

/**
 * 받은 방송이 쓸 수 있는 값인지 확인합니다. 이상하면 null.
 * 💡 받은 값은 믿지 않습니다: 다른 사람의 브라우저가 보낸 값이라, 글자·빈칸·엄청 큰 숫자가 올 수 있습니다.
 *    (그대로 쓰면 캐릭터가 마을 밖으로 나가거나 계산이 망가집니다)
 */
export function parseMove(payload: unknown, boundsRadius: number): MoveMessage | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.id !== "string" || !UUID_PATTERN.test(p.id)) return null;
  const numbers = [p.x, p.z, p.tx, p.tz];
  if (!numbers.every((n): n is number => typeof n === "number" && Number.isFinite(n))) return null;
  const [x, z, tx, tz] = numbers;
  const limit = boundsRadius + BOUNDS_MARGIN;
  if (Math.hypot(x, z) > limit || Math.hypot(tx, tz) > limit) return null;
  return { id: p.id, x, z, tx, tz };
}

/**
 * 보내기 전에 자리를 마을 경계 안으로 당깁니다. (Task 025-7에서 찾은 문제의 수정)
 * 💡 왜? 울타리 밖의 땅을 누르면 내 캐릭터는 울타리 앞까지만 걸어가지만, 목표 값 자체는 울타리 밖입니다.
 *    그 값을 그대로 보내면 받는 쪽(parseMove)이 "마을 밖 = 이상한 값"으로 보고 버려서,
 *    다른 사람 화면에서는 내가 제자리에 서 있는 것으로 보였습니다.
 *    경계 위로 당겨 보내면 받는 쪽도 같은 울타리 앞까지 걸려 보냅니다.
 */
export function clampToBounds(point: Point, boundsRadius: number): Point {
  const d = Math.hypot(point.x, point.z);
  if (d <= boundsRadius || d === 0) return { x: point.x, z: point.z };
  return { x: (point.x / d) * boundsRadius, z: (point.z / d) * boundsRadius };
}

/**
 * 내 방송 사이에 둘 최소 간격(밀리초). n = 지금 접속한 사람 수(나 포함).
 * 한 명이 한 번 보내면 받는 사람 수만큼 메시지로 세므로, n명이 모두 보내면 n × n에 비례합니다.
 * 그래서 사람이 많을수록 간격을 넓혀 마을 전체가 초당 LIVE_BUDGET_PER_SECOND개를 넘지 않게 합니다.
 * (2~3명이면 0.5초, 10명이면 4초, 가장 길어도 MAX_SEND_INTERVAL_MS = 10초)
 *
 * 💡 16명부터는 10초에서 더 늘리지 않습니다. 더 늘리면 "누른 뒤 한참 있다가 다른 화면에서 걷기 시작"해서 함께 걷는 느낌이 사라지기 때문입니다.
 *    그래서 16명 이상이 모두 쉬지 않고 누르는 최악의 경우에는 마을당 예산(25)을 넘습니다:
 *    20명 = 초당 40개, 31명(나 + 다른 주민 30명) = 초당 약 96개. 한 마을만이라면 무료 한도(100) 안이지만 여유는 4%뿐입니다.
 *    (상한을 30명으로 올리면서 8초 → 10초로 넓힘. 8초 그대로면 31명일 때 초당 120개로 한 마을만으로 한도를 넘습니다.
 *     그런 마을이 동시에 둘이면 한도를 넘으므로, 널리 퍼지면 요금제를 올리거나 이 값을 늘려야 합니다)
 */
export function sendIntervalMs(n: number): number {
  return Math.min(MAX_SEND_INTERVAL_MS, Math.max(500, ((n * n) / LIVE_BUDGET_PER_SECOND) * 1000));
}

/**
 * 새 주민이 들어왔을 때 "나 여기 있어요"를 답하기까지 무작위로 기다릴 시간의 폭(밀리초).
 * 모두가 동시에 답하면 한순간에 메시지가 몰리므로, 이 폭 안에서 저마다 다른 때에 답합니다.
 * (10명이면 2.5초, 20명이면 10초, 26명이면 약 17초 → 사람이 많은 마을에 들어가면 다른 주민이 그 시간에 걸쳐 차례로 나타납니다)
 */
export function joinReplyWindowMs(n: number): number {
  return Math.max(1000, n * n * LIVE_BUDGET_PER_SECOND);
}

/** 접속자 목록이 이전과 어떻게 달라졌는지: 새로 들어온 사람(joined)과 나간 사람(left) */
export function diffKeys(prev: readonly string[], next: readonly string[]): { joined: string[]; left: string[] } {
  const before = new Set(prev);
  const after = new Set(next);
  return {
    joined: [...after].filter((key) => !before.has(key)),
    left: [...before].filter((key) => !after.has(key)),
  };
}

/** 이미 그리고 있는 주민에게 주는 거리 여유. 새 사람이 이만큼 더 가까워야 자리를 바꿉니다 (Task 025-6) */
export const KEEP_SHOWN_MARGIN = 2;

/**
 * 내 자리에서 가까운 순으로 max명의 id를 고릅니다. (사람이 max보다 적으면 모두)
 * 거리가 같으면 id 글자 순서로 정해, 같은 입력이면 늘 같은 결과가 나옵니다.
 * - keep: 지금 이미 그리고 있는 주민들. 이들은 거리를 keepMargin만큼 가깝게 쳐 줍니다.
 *   💡 왜? 거리가 비슷한 두 사람이 경계에 걸려 있으면, 조금 움직일 때마다 한 명이 나타났다 사라졌다 합니다.
 *      여유를 두면 "확실히 더 가까워졌을 때"만 바뀝니다.
 */
export function nearestIds(
  me: Point,
  others: readonly { id: string; x: number; z: number }[],
  max: number,
  keep?: ReadonlySet<string>,
  keepMargin = KEEP_SHOWN_MARGIN,
): string[] {
  if (others.length <= max) return others.map((o) => o.id);
  return others
    .map((o) => ({ id: o.id, d: Math.hypot(o.x - me.x, o.z - me.z) - (keep?.has(o.id) ? keepMargin : 0) }))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
    .slice(0, Math.max(0, max))
    .map((o) => o.id);
}
