import { describe, expect, it } from "vitest";
import { buildObstacles } from "./collision";
import { PLAYER_START } from "./layout";
import {
  LIVE_BUDGET_PER_SECOND,
  clampToBounds,
  diffKeys,
  hashText,
  MAX_REMOTE_AVATARS,
  joinReplyWindowMs,
  nearestIds,
  parseMove,
  sendIntervalMs,
  spawnPoint,
  villageTopic,
} from "./liveProtocol";

describe("spawnPoint", () => {
  const ids = Array.from({ length: 200 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

  it("같은 사용자 번호면 늘 같은 자리", () => {
    expect(spawnPoint(ids[7])).toEqual(spawnPoint(ids[7]));
    expect(hashText("abc")).toBe(hashText("abc"));
  });

  it("처음 자리(PLAYER_START) 둘레 가까이에 있고, 트리·가로등과 겹치지 않는다", () => {
    const obstacles = buildObstacles([]);
    for (const id of ids) {
      const p = spawnPoint(id);
      expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
      expect(Math.hypot(p.x - PLAYER_START.x, p.z - PLAYER_START.z)).toBeLessThan(2.6);
      for (const c of obstacles) expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThanOrEqual(c.r + 0.5 - 1e-6);
    }
  });

  it("사람마다 자리가 흩어진다 (200명 중 서로 다른 자리가 100곳 이상)", () => {
    const spots = new Set(ids.map((id) => { const p = spawnPoint(id); return `${p.x.toFixed(2)},${p.z.toFixed(2)}`; }));
    expect(spots.size).toBeGreaterThan(100);
  });
});

describe("villageTopic", () => {
  it("village: 뒤에 마을 번호를 붙인다", () => {
    expect(villageTopic("11111111-2222-3333-4444-555555555555")).toBe("village:11111111-2222-3333-4444-555555555555");
  });
});

describe("parseMove", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const ok = { id, x: 1, z: -2, tx: 3.5, tz: 4 };

  it("바른 값은 그대로 돌려준다 (남는 칸은 버린다)", () => {
    expect(parseMove({ ...ok, extra: "x" }, 20)).toEqual(ok);
  });

  it("객체가 아니면 null", () => {
    for (const bad of [null, undefined, "글자", 3, true, []]) expect(parseMove(bad, 20)).toBeNull();
  });

  it("id가 없거나 사용자 번호 모양이 아니면 null", () => {
    expect(parseMove({ ...ok, id: undefined }, 20)).toBeNull();
    expect(parseMove({ ...ok, id: 7 }, 20)).toBeNull();
    expect(parseMove({ ...ok, id: "ghost-1" }, 20)).toBeNull();
    expect(parseMove({ ...ok, id: id.toUpperCase().replace(/1/g, "A") }, 20)).toBeNull();
  });

  it("숫자 칸이 글자·NaN·무한대·빈칸이면 null", () => {
    for (const key of ["x", "z", "tx", "tz"] as const) {
      for (const bad of ["1", NaN, Infinity, -Infinity, null, undefined]) {
        expect(parseMove({ ...ok, [key]: bad }, 20)).toBeNull();
      }
      const missing: Record<string, unknown> = { ...ok };
      delete missing[key];
      expect(parseMove(missing, 20)).toBeNull();
    }
  });

  it("지금 자리나 목표가 마을 경계 밖이면 null (경계에 붙은 자리는 통과)", () => {
    expect(parseMove({ ...ok, x: 30, z: 0 }, 20)).toBeNull();
    expect(parseMove({ ...ok, tx: 15, tz: 15 }, 20)).toBeNull();
    expect(parseMove({ ...ok, tx: 1e12 }, 20)).toBeNull();
    expect(parseMove({ ...ok, x: 20, z: 0, tx: 0, tz: -20 }, 20)).not.toBeNull();
  });
});

describe("clampToBounds", () => {
  it("경계 안의 자리는 그대로 둔다", () => {
    expect(clampToBounds({ x: 3, z: -4 }, 20)).toEqual({ x: 3, z: -4 });
    expect(clampToBounds({ x: 0, z: 0 }, 20)).toEqual({ x: 0, z: 0 });
  });

  it("경계 밖의 자리는 같은 방향의 경계 위로 당긴다", () => {
    const p = clampToBounds({ x: 30, z: 40 }, 20);
    expect(p.x).toBeCloseTo(12);
    expect(p.z).toBeCloseTo(16);
  });

  it("당긴 값은 받는 쪽 검사(parseMove)를 통과한다", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const far = clampToBounds({ x: -500, z: 120 }, 20);
    expect(parseMove({ id, x: 0, z: 0, tx: far.x, tz: far.z }, 20)).not.toBeNull();
    // 당기지 않고 그대로 보내면 버려집니다 (고치기 전의 동작)
    expect(parseMove({ id, x: 0, z: 0, tx: -500, tz: 120 }, 20)).toBeNull();
  });
});

describe("sendIntervalMs", () => {
  it("사람이 적으면 0.5초, 많으면 길어지고, 10초를 넘지 않는다", () => {
    expect(sendIntervalMs(1)).toBe(500);
    expect(sendIntervalMs(2)).toBe(500);
    expect(sendIntervalMs(3)).toBe(500);
    expect(sendIntervalMs(5)).toBe(1000);
    expect(sendIntervalMs(10)).toBe(4000);
    expect(sendIntervalMs(14)).toBe(7840);
    expect(sendIntervalMs(20)).toBe(10000);
    expect(sendIntervalMs(200)).toBe(10000);
  });

  it("모두가 가장 빠르게 보내도 마을 전체가 초당 예산을 넘지 않는다 (4~15명)", () => {
    // 16명부터는 간격이 10초에서 더 늘지 않아 예산을 넘습니다 (20명이 모두 쉬지 않고 눌러도 초당 40개로, 무료 한도 100개 안)
    expect((20 * 20) / (sendIntervalMs(20) / 1000)).toBe(40);
    for (let n = 4; n <= 15; n++) {
      // n명이 각자 간격마다 한 번 보내고, 한 번에 n개(보냄 1 + 받음 n-1)로 셉니다
      const perSecond = (n * n) / (sendIntervalMs(n) / 1000);
      expect(perSecond).toBeLessThanOrEqual(LIVE_BUDGET_PER_SECOND + 1e-9);
    }
  });
});

describe("상한 30명일 때의 메시지 수 (Task 026)", () => {
  // 나 + 다른 주민 30명 = 31명이 모두 쉬지 않고 누르는 최악의 경우
  const n = MAX_REMOTE_AVATARS + 1;

  it("상한은 30명", () => {
    expect(MAX_REMOTE_AVATARS).toBe(30);
  });

  it("걷기 방송: 마을 하나가 무료 한도(초당 100개) 안에 들어온다", () => {
    const perSecond = (n * n) / (sendIntervalMs(n) / 1000);
    expect(perSecond).toBeCloseTo(96.1, 1);
    expect(perSecond).toBeLessThan(100);
  });

  it("새 주민에게 답하기: 답이 몰려도 초당 40개를 넘지 않는다", () => {
    // 31명 중 30명이 한 번씩 답함 (한 번에 받는 사람 수만큼 = 31개로 셈)
    const perSecond = ((n - 1) * n) / (joinReplyWindowMs(n) / 1000);
    expect(joinReplyWindowMs(n)).toBe(24025);
    expect(perSecond).toBeLessThan(40);
  });
});

describe("joinReplyWindowMs", () => {
  it("적어도 1초이고, 사람이 많을수록 넓어진다", () => {
    expect(joinReplyWindowMs(2)).toBe(1000);
    expect(joinReplyWindowMs(6)).toBe(1000);
    expect(joinReplyWindowMs(10)).toBe(2500);
    expect(joinReplyWindowMs(20)).toBe(10000);
  });
});

describe("diffKeys", () => {
  it("새로 들어온 사람과 나간 사람을 나눈다", () => {
    expect(diffKeys(["a", "b"], ["b", "c"])).toEqual({ joined: ["c"], left: ["a"] });
  });
  it("같으면 둘 다 비어 있다 (순서가 달라도)", () => {
    expect(diffKeys(["a", "b"], ["b", "a"])).toEqual({ joined: [], left: [] });
  });
  it("처음(빈 목록)에서는 모두 새로 들어온 사람, 모두 사라지면 모두 나간 사람", () => {
    expect(diffKeys([], ["a", "b"])).toEqual({ joined: ["a", "b"], left: [] });
    expect(diffKeys(["a", "b"], [])).toEqual({ joined: [], left: ["a", "b"] });
  });
  it("같은 이름이 두 번 와도 한 번만 센다", () => {
    expect(diffKeys(["a"], ["a", "b", "b"])).toEqual({ joined: ["b"], left: [] });
  });
});

describe("nearestIds", () => {
  const me = { x: 0, z: 0 };
  const others = [
    { id: "far", x: 10, z: 0 },
    { id: "near", x: 1, z: 0 },
    { id: "mid", x: 0, z: -5 },
  ];
  it("상한보다 적으면 모두 (순서 그대로)", () => {
    expect(nearestIds(me, others, 8)).toEqual(["far", "near", "mid"]);
  });
  it("상한을 넘으면 가까운 순으로 그만큼만", () => {
    expect(nearestIds(me, others, 2)).toEqual(["near", "mid"]);
    expect(nearestIds({ x: 10, z: 0 }, others, 1)).toEqual(["far"]);
  });
  it("거리가 같으면 id 순서로 정해 늘 같은 결과", () => {
    const tie = [{ id: "b", x: 1, z: 0 }, { id: "a", x: -1, z: 0 }, { id: "c", x: 0, z: 1 }];
    expect(nearestIds(me, tie, 2)).toEqual(["a", "b"]);
  });
  it("이미 그리고 있는 사람은 여유 거리만큼 유리하다 (경계에서 들락날락하지 않게)", () => {
    const two = [{ id: "shown", x: 5, z: 0 }, { id: "other", x: 4, z: 0 }];
    // 여유가 없으면 더 가까운 other
    expect(nearestIds(me, two, 1)).toEqual(["other"]);
    // shown을 이미 그리고 있으면: 1만큼 가까운 정도로는 바뀌지 않음 (여유 2)
    expect(nearestIds(me, two, 1, new Set(["shown"]))).toEqual(["shown"]);
    // 여유보다 확실히 더 가까워지면 바뀜
    expect(nearestIds(me, [two[0], { id: "other", x: 2, z: 0 }], 1, new Set(["shown"]))).toEqual(["other"]);
  });
  it("상한이 0이면 아무도 고르지 않는다", () => {
    expect(nearestIds(me, others, 0)).toEqual([]);
  });
});
