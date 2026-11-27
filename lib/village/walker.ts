// 캐릭터가 "한 장면(프레임) 동안 얼마나 걸어가는지" 계산하는 곳입니다. (Task 025-2)
//
// 💡 왜 따로 두나요?
//    예전에는 이 계산이 내 캐릭터 부품(components/village/Player.tsx) 안에 들어 있었습니다.
//    이제 "같은 마을에 접속한 다른 주민"도 걸어 다녀야 해서, 내 캐릭터와 다른 주민이
//    똑같은 계산을 함께 쓰도록 여기로 옮겼습니다. → 누구의 화면에서 보든 같은 길로, 같은 속도로 걷습니다.
// 💡 3D 도구(three.js)를 쓰지 않는 "순수 계산"이라서, 화면 없이도 자동 테스트로 확인할 수 있습니다.

import { resolveCollisions, type Circle, type Point } from "./collision";
import { findPath } from "./pathfind";

/** 걷는 속도 (3D 길이 단위/초) */
export const WALK_SPEED = 4.5;
/** 몸 반지름 (충돌 계산용) */
export const BODY_RADIUS = 0.5;
/** 도착으로 보는 거리 */
export const ARRIVE_DISTANCE = 0.08;
/** 몸 돌리는 빠르기 (클수록 빨리 돌아봄) */
export const TURN_SPEED = 12;
/** 거의 못 움직이는 상태가 이만큼(초) 이어지면 "막혔다"고 보고 멈춥니다 */
export const STUCK_SECONDS = 0.4;
/** 한 장면에 계산하는 시간의 최댓값(초). 탭 전환 등으로 시간이 크게 튀는 것을 막습니다 */
export const MAX_STEP_SECONDS = 0.05;

/** 걷는 캐릭터 한 명의 상태. 매 장면 이 값을 "직접 고쳐" 씁니다 (새로 만들지 않아야 빠릅니다) */
export type WalkerState = {
  x: number;
  z: number;
  /** 몸이 향한 방향(라디안) */
  rotY: number;
  /** 앞으로 차례로 지나갈 경유지 목록 (맨 앞이 지금 향하는 곳, 마지막이 최종 목표). 비어 있으면 서 있는 중 */
  route: Point[];
  /** 거의 못 움직인 채 지난 시간(초) */
  stuck: number;
};

/** 처음 상태 만들기: (x, z)에 서 있는 캐릭터 */
export function createWalker(x: number, z: number, rotY = 0): WalkerState {
  return { x, z, rotY, route: [], stuck: 0 };
}

/**
 * 새 목표로 가는 길을 정합니다.
 *  1) 목표가 장애물 안이면 바깥으로, 경계 밖이면 안으로 옮기고
 *  2) 지금 서 있는 곳에서 거기까지, 트리·집을 돌아가는 길(경유지 목록)을 찾습니다 (pathfind.ts)
 */
export function planRoute(state: WalkerState, target: Point, obstacles: Circle[], boundsRadius: number): void {
  const goal = resolveCollisions(target, obstacles, boundsRadius, BODY_RADIUS);
  state.route = findPath({ x: state.x, z: state.z }, goal, obstacles, boundsRadius, BODY_RADIUS);
  state.stuck = 0;
}

/**
 * 한 장면만큼 걷습니다. state를 직접 고치고, "걷는 중"이면 true를 돌려줍니다.
 * - dt: 지난 장면부터 흐른 시간(초)
 * - speedScale: 속도 배율 (기본 1)
 */
export function stepWalker(
  state: WalkerState,
  dt: number,
  obstacles: Circle[],
  boundsRadius: number,
  speedScale = 1,
): boolean {
  const stepDt = Math.min(dt, MAX_STEP_SECONDS);
  const dest = state.route[0];
  if (!dest) return false;

  const dx = dest.x - state.x;
  const dz = dest.z - state.z;
  const dist = Math.hypot(dx, dz);
  if (dist < ARRIVE_DISTANCE) {
    // 이 경유지에 도착: 다음 경유지로 넘어가고, 더 없으면 멈춥니다
    state.route.shift();
    return state.route.length > 0;
  }

  // 이번 장면에 가려는 거리 (남은 거리보다 멀리 가지 않음)
  const step = Math.min(WALK_SPEED * speedScale * stepDt, dist);
  const wanted = { x: state.x + (dx / dist) * step, z: state.z + (dz / dist) * step };
  // 장애물을 만나면 바깥으로 밀려나서 가장자리를 따라 미끄러집니다
  const next = resolveCollisions(wanted, obstacles, boundsRadius, BODY_RADIUS);
  const moved = Math.hypot(next.x - state.x, next.z - state.z);

  // 거의 못 움직이는 상태가 0.4초 이어지면(정면으로 막힘) 멈춥니다
  if (moved < step * 0.25) {
    state.stuck += stepDt;
    if (state.stuck > STUCK_SECONDS) {
      state.route = [];
      return false;
    }
  } else {
    state.stuck = 0;
  }

  // 실제로 움직인 방향으로 몸을 부드럽게 돌립니다 (각도의 가장 짧은 길로)
  if (moved > 1e-5) {
    const heading = Math.atan2(next.x - state.x, next.z - state.z);
    let diff = heading - state.rotY;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    state.rotY += diff * Math.min(1, TURN_SPEED * stepDt);
  }
  state.x = next.x;
  state.z = next.z;
  return true;
}
