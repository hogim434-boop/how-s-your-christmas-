// "화면에서 누른 곳이 땅의 어디인지"를 계산하는 순수 함수 파일입니다. (11.26 성능: 탭할 때 끊김 줄이기)
//
// 💡 예전 방식: three.js가 땅 그물의 삼각형 약 2만 개를 하나씩 "이 시선이 지나가나?" 검사했습니다.
//    누를 때·뗄 때·클릭 때 한 번씩, 탭 한 번에 세 번이라 휴대폰에서 12ms쯤 걸렸습니다.
// 💡 지금 방식: 땅 높이는 계산식(terrain.heightAt)으로 알 수 있으니, 시선을 따라 조금씩 나아가며
//    "시선이 땅보다 낮아지는 지점"을 찾습니다. 계산은 수십 번이면 끝나고, 찾는 자리는 예전과 같습니다.

import { OUTER_BUMP_HEIGHT, PLAZA_RIM } from "./terrain";

/** 땅이 가질 수 있는 가장 높은 높이 (이보다 위에서는 땅에 닿을 일이 없어 건너뜁니다) */
const MAX_GROUND_HEIGHT = OUTER_BUMP_HEIGHT + PLAZA_RIM.height;
/** 시선을 따라 한 번에 나아가는 거리와 최대 횟수 */
const STEP = 0.5;
const MAX_STEPS = 96;
/** 지점을 좁혀 가는 횟수 (14번이면 오차 0.0001 이하) */
const REFINE_STEPS = 14;

type Vec3 = { x: number; y: number; z: number };

/**
 * 시선(origin에서 direction 방향)이 땅과 만나는 지점을 찾습니다.
 * - direction은 길이 1인 방향이어야 합니다 (three.js Ray의 direction이 그렇습니다)
 * - radius: 땅의 반지름. 그 바깥이면 null
 * - 돌려주는 distance는 origin에서 그 지점까지의 거리
 */
export function groundHit(
  origin: Vec3,
  direction: Vec3,
  heightAt: (x: number, z: number) => number,
  radius: number,
): { distance: number; point: Vec3 } | null {
  // 위나 수평을 보는 시선은 땅에 닿지 않습니다
  if (direction.y > -1e-6) return null;

  // 시선 위의 한 점이 땅보다 얼마나 위에 있는지 (0 이하면 땅에 닿았거나 땅속)
  const gap = (t: number) =>
    origin.y + direction.y * t - heightAt(origin.x + direction.x * t, origin.z + direction.z * t);

  // 살펴볼 구간: 가장 높은 땅 높이에 닿는 곳 ~ 높이 0에 닿는 곳 (땅은 0 이상이라 그 안에서 반드시 만납니다)
  const start = Math.max(0, (MAX_GROUND_HEIGHT - origin.y) / direction.y);
  const end = Math.max(start, -origin.y / direction.y);
  const step = Math.max(STEP, (end - start) / MAX_STEPS);

  // 1) 조금씩 나아가며 처음으로 땅 아래로 내려가는 구간 찾기
  let above = start;
  let below = end;
  if (gap(start) > 0) {
    for (let t = start + step; ; t += step) {
      const at = Math.min(t, end);
      if (gap(at) <= 0) {
        below = at;
        break;
      }
      above = at;
      if (at === end) break;
    }
    // 2) 그 구간을 반씩 좁혀 정확한 지점 찾기
    for (let i = 0; i < REFINE_STEPS; i++) {
      const mid = (above + below) / 2;
      if (gap(mid) > 0) above = mid;
      else below = mid;
    }
  } else {
    below = start;
  }

  const x = origin.x + direction.x * below;
  const z = origin.z + direction.z * below;
  if (Math.hypot(x, z) > radius) return null;
  return { distance: below, point: { x, y: origin.y + direction.y * below, z } };
}
