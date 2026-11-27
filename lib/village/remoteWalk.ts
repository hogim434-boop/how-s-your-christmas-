// "다른 주민 한 명"이 한 장면 동안 어떻게 움직이는지 계산하는 곳입니다. (Task 026)
// 3D 도구(three.js)를 쓰지 않는 순수 계산이라 테스트(remoteWalk.test.ts)로 확인합니다.
//
// 두 가지를 다룹니다.
//  1) 걷기: 보관함(remoteStore)에 새 목표가 왔는지 보고, 길을 찾고, 한 장면만큼 걸려 보냅니다.
//  2) 동작 시간표: 서 있는 동작·걷는 동작 중 "지금 어느 순간의 자세를 보여 줄지"를 정합니다.
//     💡 자세는 미리 구워 둔 그림(components/village/crowdModel.ts)의 "몇 번째 줄"인지로 나타냅니다.

import type { Circle } from "./collision";
import type { RemoteEntry } from "./remoteStore";
import { ARRIVE_DISTANCE, planRoute, stepWalker, type WalkerState } from "./walker";

/** 걷기에 필요한 값: 자리·방향(walker)과, 마지막으로 반영한 보관함의 소식 번호(seq) */
export type RemoteWalk = {
  walker: WalkerState;
  /** 보관함의 seq와 다르면 새 목표가 온 것 */
  seq: number;
};

/** 한 장면에 할 수 있는 "길 찾기" 횟수. 여러 명이 나눠 씁니다 (한 장면에 몰리면 화면이 멈칫하므로) */
export type PlanBudget = { left: number };

/**
 * 한 장면만큼 걷습니다. a.walker를 직접 고칩니다.
 * 돌려주는 값:
 *  - "none": 서 있는 중이라 아무것도 바뀌지 않음
 *  - "walking": 걸어서 자리가 바뀜
 *  - "stopped": 이번 장면에 멈춤 (도착, 막힘, 또는 오래 멈췄다 돌아와 목표 자리에 바로 세움)
 *
 * - resumed: 그리기가 오래 멈췄다가 방금 다시 시작됐는지. true면 걷던 사람을 목표 자리에 바로 세웁니다.
 *   💡 편지 쓰기 창을 열어 둔 동안에는 3D가 멈춥니다. 그 사이 다른 주민은 이미 도착했을 텐데,
 *      멈춘 자리에서 이어 걷게 하면 한참 전의 걸음을 뒤늦게 보게 됩니다.
 */
export function advanceRemoteWalk(
  a: RemoteWalk,
  entry: RemoteEntry,
  delta: number,
  obstacles: Circle[],
  boundsRadius: number,
  resumed: boolean,
  budget: PlanBudget,
): "none" | "walking" | "stopped" {
  const w = a.walker;
  let result: "none" | "walking" | "stopped" = "none";

  if (resumed && (a.seq !== entry.seq || w.route.length > 0)) {
    // 길을 한 번 찾아 그 길의 끝(장애물을 피해 실제로 멈추게 될 자리)에 바로 세웁니다
    a.seq = entry.seq;
    planRoute(w, { x: entry.tx, z: entry.tz }, obstacles, boundsRadius);
    const end = w.route[w.route.length - 1];
    if (end) {
      w.x = end.x;
      w.z = end.z;
    }
    w.route = [];
    result = "stopped";
  }

  // 새 소식이 왔으면 그 목표로 가는 길을 다시 찾습니다 (지금 서 있는 곳에서 이어서 걸어 순간 이동하지 않습니다)
  if (a.seq !== entry.seq) {
    if (Math.hypot(entry.tx - w.x, entry.tz - w.z) <= ARRIVE_DISTANCE) {
      a.seq = entry.seq; // 이미 그 자리: 길을 찾을 필요 없음
    } else if (budget.left > 0) {
      budget.left--;
      a.seq = entry.seq;
      planRoute(w, { x: entry.tx, z: entry.tz }, obstacles, boundsRadius);
    }
    // 이번 장면 몫을 다 썼으면 seq를 그대로 둡니다 → 다음 장면에 다시 시도 (그동안은 하던 대로 걷거나 서 있음)
  }

  // 걷기: 내 캐릭터와 같은 계산 (walker.ts)
  if (w.route.length > 0) result = stepWalker(w, delta, obstacles, boundsRadius) ? "walking" : "stopped";
  return result;
}

// ---------------------------------------------------------------------------
// 동작 시간표
// ---------------------------------------------------------------------------

/** 동작 번호: 서 있기 / 걷기 */
export const POSE_IDLE = 0;
export const POSE_WALK = 1;
export type PoseClipId = typeof POSE_IDLE | typeof POSE_WALK;

/** 구워 둔 동작 하나: 그림의 몇 번째 줄부터(start) 몇 줄인지(count), 한 바퀴가 몇 초인지(duration) */
export type PoseClip = { start: number; count: number; duration: number };

/** 동작의 time초 시점에 해당하는 그림의 줄 번호. 동작은 끝나면 처음으로 돌아가 되풀이됩니다 */
export function poseRow(clip: PoseClip, time: number): number {
  const frame = Math.round((time / clip.duration) * clip.count);
  return clip.start + (((frame % clip.count) + clip.count) % clip.count);
}

/**
 * 한 사람의 동작 상태.
 * 동작을 바꿀 때는 뚝 끊기지 않게, 이전 동작(from)에서 지금 동작(to)으로 fadeSeconds 동안 서서히 섞습니다.
 */
export type PoseState = {
  to: PoseClipId;
  toTime: number;
  from: PoseClipId;
  fromTime: number;
  /** 섞인 정도 0~1. 1이면 지금 동작(to)만 보입니다 */
  blend: number;
};

/** 처음 상태: startTime초 시점부터 서 있는 동작 */
export function createPose(startTime = 0): PoseState {
  return { to: POSE_IDLE, toTime: startTime, from: POSE_IDLE, fromTime: 0, blend: 1 };
}

/** 동작 바꾸기 (걷기 ↔ 서 있기). 지금 동작이 "이전 동작"이 되고, 새 동작은 처음(0초)부터 시작합니다 */
export function switchPose(pose: PoseState, next: PoseClipId) {
  if (pose.to === next) return;
  pose.from = pose.to;
  pose.fromTime = pose.toTime;
  pose.to = next;
  pose.toTime = 0;
  pose.blend = 0;
}

/** 한 장면만큼 동작 시간을 흘려보냅니다. duration은 동작 한 바퀴의 길이(초) — 넘치면 처음으로 돌립니다 */
export function advancePose(pose: PoseState, dt: number, fadeSeconds: number, idleDuration: number, walkDuration: number) {
  const toDuration = pose.to === POSE_IDLE ? idleDuration : walkDuration;
  pose.toTime = (pose.toTime + dt) % toDuration;
  if (pose.blend < 1) {
    const fromDuration = pose.from === POSE_IDLE ? idleDuration : walkDuration;
    pose.fromTime = (pose.fromTime + dt) % fromDuration;
    pose.blend = Math.min(1, pose.blend + dt / fadeSeconds);
  }
}
