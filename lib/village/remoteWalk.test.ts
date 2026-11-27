import { describe, expect, it } from "vitest";
import {
  POSE_IDLE,
  POSE_WALK,
  advancePose,
  advanceRemoteWalk,
  createPose,
  poseRow,
  switchPose,
  type PoseClip,
} from "./remoteWalk";
import { createWalker } from "./walker";

const BOUNDS = 30;

describe("advanceRemoteWalk", () => {
  it("목표가 지금 자리면 아무것도 하지 않는다", () => {
    const a = { walker: createWalker(1, 2), seq: -1 };
    const budget = { left: 2 };
    const result = advanceRemoteWalk(a, { x: 1, z: 2, tx: 1, tz: 2, seq: 0 }, 1 / 60, [], BOUNDS, false, budget);
    expect(result).toBe("none");
    expect(a.seq).toBe(0);
    expect(budget.left).toBe(2); // 길 찾기 몫을 쓰지 않음
  });

  it("새 목표가 오면 길을 찾아 걷기 시작하고, 도착하면 멈춘다", () => {
    const a = { walker: createWalker(0, 6), seq: -1 };
    const entry = { x: 0, z: 6, tx: 3, tz: 6, seq: 0 };
    const budget = { left: 2 };
    expect(advanceRemoteWalk(a, entry, 1 / 60, [], BOUNDS, false, budget)).toBe("walking");
    expect(budget.left).toBe(1);
    expect(a.walker.x).toBeGreaterThan(0);
    let last = "walking";
    for (let i = 0; i < 600 && last !== "stopped"; i++) {
      last = advanceRemoteWalk(a, entry, 1 / 60, [], BOUNDS, false, { left: 2 });
    }
    expect(last).toBe("stopped");
    expect(Math.hypot(a.walker.x - 3, a.walker.z - 6)).toBeLessThan(0.1);
    // 도착한 뒤에는 다시 "변화 없음"
    expect(advanceRemoteWalk(a, entry, 1 / 60, [], BOUNDS, false, { left: 2 })).toBe("none");
  });

  it("길 찾기 몫이 없으면 다음 장면으로 미룬다", () => {
    const a = { walker: createWalker(0, 6), seq: -1 };
    const entry = { x: 0, z: 6, tx: 3, tz: 6, seq: 0 };
    expect(advanceRemoteWalk(a, entry, 1 / 60, [], BOUNDS, false, { left: 0 })).toBe("none");
    expect(a.seq).toBe(-1); // 아직 반영하지 않음
    expect(advanceRemoteWalk(a, entry, 1 / 60, [], BOUNDS, false, { left: 1 })).toBe("walking");
  });

  it("오래 멈췄다 돌아오면 걷던 사람을 목표 자리에 바로 세운다", () => {
    const a = { walker: createWalker(0, 6), seq: -1 };
    const entry = { x: 0, z: 6, tx: 5, tz: 6, seq: 0 };
    advanceRemoteWalk(a, entry, 1 / 60, [], BOUNDS, false, { left: 2 });
    const result = advanceRemoteWalk(a, entry, 1 / 60, [], BOUNDS, true, { left: 2 });
    expect(result).toBe("stopped");
    expect(a.walker.x).toBeCloseTo(5, 5);
    expect(a.walker.route).toHaveLength(0);
  });
});

describe("동작 시간표", () => {
  const idle: PoseClip = { start: 0, count: 64, duration: 64 / 60 };
  const walk: PoseClip = { start: 64, count: 64, duration: 64 / 60 };

  it("poseRow: 시간에 맞는 줄을 고르고, 끝나면 처음으로 돌아간다", () => {
    expect(poseRow(idle, 0)).toBe(0);
    expect(poseRow(idle, 1 / 60)).toBe(1);
    expect(poseRow(walk, 10 / 60)).toBe(74);
    expect(poseRow(walk, 64 / 60)).toBe(64); // 한 바퀴 → 처음
    expect(poseRow(idle, 63.6 / 60)).toBe(0); // 마지막 줄을 넘겨 반올림 → 처음
  });

  it("switchPose: 지금 동작이 이전 동작이 되고 새 동작은 0초부터 섞이기 시작한다", () => {
    const pose = createPose(0.5);
    switchPose(pose, POSE_WALK);
    expect(pose).toEqual({ to: POSE_WALK, toTime: 0, from: POSE_IDLE, fromTime: 0.5, blend: 0 });
    switchPose(pose, POSE_WALK); // 같은 동작이면 그대로
    expect(pose.blend).toBe(0);
  });

  it("advancePose: 0.25초에 걸쳐 섞임이 끝나고, 시간은 한 바퀴 안에서 돈다", () => {
    const pose = createPose(1);
    switchPose(pose, POSE_WALK);
    advancePose(pose, 0.1, 0.25, idle.duration, walk.duration);
    expect(pose.blend).toBeCloseTo(0.4, 5);
    expect(pose.toTime).toBeCloseTo(0.1, 5);
    expect(pose.fromTime).toBeCloseTo((1 + 0.1) % idle.duration, 5);
    advancePose(pose, 0.1, 0.25, idle.duration, walk.duration);
    advancePose(pose, 0.1, 0.25, idle.duration, walk.duration);
    expect(pose.blend).toBe(1);
    for (let i = 0; i < 100; i++) advancePose(pose, 0.1, 0.25, idle.duration, walk.duration);
    expect(pose.toTime).toBeLessThan(walk.duration);
  });
});
