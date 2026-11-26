// 장애물(트리·집·우체통·가로등)을 돌아서 가는 길을 찾는 계산입니다.
//
// 왜 필요한가요? (11.27, Task 010-1)
//  캐릭터는 원래 목표를 향해 "똑바로"만 걸었습니다. 그래서 길 중간에 대왕 트리나 집이 있으면
//  거기에 부딪혀 멈춰 버렸습니다 (예: 주민 3명 마을에서 트리 건너편 우체통으로 가기).
//  이제는 똑바로 갈 수 없을 때 장애물을 돌아가는 "경유지" 목록을 만들어 그 순서대로 걷습니다.
//
// 방법 (A* 길 찾기):
//  1) 마을 바닥을 작은 네모 칸(0.5 크기)으로 나눕니다.
//  2) 장애물과 겹치는 칸은 "못 가는 칸"으로 표시합니다.
//  3) 출발 칸에서 도착 칸까지, 갈 수 있는 칸만 밟아 가는 가장 짧은 길을 찾습니다.
//  4) 칸을 따라가면 길이 지그재그가 되므로, 똑바로 갈 수 있는 구간은 한 번에 잇도록 다듬습니다.
// 화면을 누를 때 한 번만 계산하므로 느려지지 않습니다 (칸 수는 많아야 몇만 개).

import { PLAZA_CENTER } from "./layout";
import type { Circle, Point } from "./collision";

/** 바닥을 나누는 칸의 크기 */
const CELL = 0.5;
/** 칸을 막을 때 장애물에 더하는 여유. 길이 장애물에 바짝 붙지 않게 합니다 */
const CELL_MARGIN = 0.15;
/** 똑바로 갈 수 있는지 볼 때 허용하는 아주 작은 겹침 (장애물에 딱 붙어 서 있는 경우를 위해) */
const TOUCH_TOLERANCE = 0.03;

/** 점 c에서 선분 a→b까지의 가장 가까운 거리 */
function distanceToSegment(c: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz;
  // t: 선분 위에서 c와 가장 가까운 곳 (0 = a, 1 = b)
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((c.x - a.x) * abx + (c.z - a.z) * abz) / len2));
  return Math.hypot(a.x + abx * t - c.x, a.z + abz * t - c.z);
}

/** a에서 b까지 똑바로 걸어도 어떤 장애물에도 걸리지 않는지 */
export function segmentClear(a: Point, b: Point, circles: Circle[], bodyRadius: number): boolean {
  for (const c of circles) {
    if (distanceToSegment(c, a, b) < c.r + bodyRadius - TOUCH_TOLERANCE) return false;
  }
  return true;
}

/**
 * start에서 goal까지 가는 경유지 목록을 돌려줍니다 (start는 빼고, 마지막은 goal).
 * - 똑바로 갈 수 있으면 [goal] 하나만 돌려줍니다.
 * - 길을 못 찾으면(사방이 막힌 경우) 예전처럼 [goal]을 돌려줘서 갈 수 있는 데까지 갑니다.
 */
export function findPath(start: Point, goal: Point, circles: Circle[], boundsRadius: number, bodyRadius: number): Point[] {
  if (segmentClear(start, goal, circles, bodyRadius)) return [goal];

  // 칸 번호 ↔ 좌표. 마을 경계를 다 덮는 정사각형 판을 씁니다
  const half = Math.ceil(boundsRadius / CELL) + 1;
  const size = half * 2 + 1;
  const toCell = (v: number) => Math.round(v / CELL) + half;
  const toWorld = (i: number) => (i - half) * CELL;
  const index = (cx: number, cz: number) => cz * size + cx;

  // 못 가는 칸 표시
  const blocked = new Uint8Array(size * size);
  const maxDist = boundsRadius - bodyRadius;
  for (let cz = 0; cz < size; cz++) {
    for (let cx = 0; cx < size; cx++) {
      const x = toWorld(cx);
      const z = toWorld(cz);
      if (Math.hypot(x - PLAZA_CENTER.x, z - PLAZA_CENTER.z) > maxDist) blocked[index(cx, cz)] = 1;
    }
  }
  for (const c of circles) {
    const reach = c.r + bodyRadius + CELL_MARGIN;
    for (let cz = Math.max(0, toCell(c.z - reach)); cz <= Math.min(size - 1, toCell(c.z + reach)); cz++) {
      for (let cx = Math.max(0, toCell(c.x - reach)); cx <= Math.min(size - 1, toCell(c.x + reach)); cx++) {
        if (Math.hypot(toWorld(cx) - c.x, toWorld(cz) - c.z) < reach) blocked[index(cx, cz)] = 1;
      }
    }
  }

  // 출발·도착 지점이 막힌 칸에 있으면(장애물 바로 옆에 서 있을 때) 가장 가까운 빈 칸에서 시작합니다
  const nearestFree = (p: Point): number | null => {
    const px = toCell(p.x);
    const pz = toCell(p.z);
    let best: number | null = null;
    let bestDist = Infinity;
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const cx = px + dx;
        const cz = pz + dz;
        if (cx < 0 || cz < 0 || cx >= size || cz >= size || blocked[index(cx, cz)]) continue;
        const d = Math.hypot(toWorld(cx) - p.x, toWorld(cz) - p.z);
        if (d < bestDist) {
          bestDist = d;
          best = index(cx, cz);
        }
      }
    }
    return best;
  };
  const from = nearestFree(start);
  const to = nearestFree(goal);
  if (from === null || to === null) return [goal];

  // A*: "지금까지 온 거리 + 남은 직선 거리"가 가장 작은 칸부터 살펴봅니다
  const cost = new Float32Array(size * size).fill(Infinity);
  const cameFrom = new Int32Array(size * size).fill(-1);
  const closed = new Uint8Array(size * size);
  const toX = to % size;
  const toZ = Math.floor(to / size);
  const estimate = (i: number) => Math.hypot((i % size) - toX, Math.floor(i / size) - toZ);
  const open: number[] = [from];
  cost[from] = 0;
  let found = false;
  while (open.length > 0) {
    // 살펴볼 후보 중 가장 좋은 칸 고르기 (칸 수가 적어서 단순하게 훑습니다)
    let bestAt = 0;
    let bestScore = Infinity;
    for (let i = 0; i < open.length; i++) {
      const score = cost[open[i]] + estimate(open[i]);
      if (score < bestScore) {
        bestScore = score;
        bestAt = i;
      }
    }
    const current = open[bestAt];
    open[bestAt] = open[open.length - 1];
    open.pop();
    if (current === to) {
      found = true;
      break;
    }
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % size;
    const cz = Math.floor(current / size);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
        const next = index(nx, nz);
        if (blocked[next] || closed[next]) continue;
        // 대각선으로 갈 때 모서리를 파고들지 않게, 옆 두 칸도 비어 있어야 합니다
        if (dx !== 0 && dz !== 0 && (blocked[index(cx + dx, cz)] || blocked[index(cx, cz + dz)])) continue;
        const nextCost = cost[current] + (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
        if (nextCost < cost[next]) {
          cost[next] = nextCost;
          cameFrom[next] = current;
          open.push(next);
        }
      }
    }
  }
  if (!found) return [goal];

  // 도착 칸에서 거꾸로 따라가 길을 만듭니다
  const cells: Point[] = [];
  for (let i = to; i !== -1; i = cameFrom[i]) cells.push({ x: toWorld(i % size), z: toWorld(Math.floor(i / size)) });
  cells.reverse();
  const raw: Point[] = [start, ...cells, goal];

  // 다듬기: 지금 자리에서 똑바로 갈 수 있는 가장 먼 경유지로 건너뜁니다
  const path: Point[] = [];
  let at = 0;
  while (at < raw.length - 1) {
    let next = raw.length - 1;
    while (next > at + 1 && !segmentClear(raw[at], raw[next], circles, bodyRadius)) next--;
    path.push(raw[next]);
    at = next;
  }
  return path;
}
