// 눈 쌓인 땅의 높낮이(울퉁불퉁함)를 계산하는 순수 함수 파일입니다. (11.25 사용자 요청: 실제 눈밭 같은 현실감, A안)
//
// 원칙
//  - 둔덕은 "위로만" 솟습니다(높이 0 이상). 땅에 놓인 물체가 공중에 뜨지 않고, 살짝 눈에 묻힌 듯 보입니다.
//  - 광장, 집 자리, 우체통 둘레는 평평(높이 0)하게 둡니다. 집·우체통이 비스듬히 묻히지 않게.
//  - 울타리 안은 낮은 둔덕, 울타리 바깥(숲)은 조금 더 큰 언덕.
//  - 같은 마을이면 언제나 같은 모양 (무작위처럼 보이지만 정해진 규칙의 "노이즈")
//
// 💡 노이즈(noise): 부드럽게 이어지는 무작위 무늬입니다. 완전한 무작위는 지글지글하지만,
//    노이즈는 언덕처럼 매끈하게 오르내려서 자연스러운 지형을 만들 때 씁니다.

import { PLAZA_RADIUS, type HouseSlot } from "./layout";

/** 울타리 안 둔덕의 최대 높이 */
export const INNER_BUMP_HEIGHT = 0.75;
/** 울타리 바깥 언덕의 최대 높이 */
export const OUTER_BUMP_HEIGHT = 1.6;
/** 둔덕 하나의 대략적인 폭 (클수록 완만하고 넓은 둔덕) */
const BUMP_SIZE = 7;
/** 노이즈 값이 이보다 커야 솟아오릅니다 → 땅의 절반쯤은 평평, 나머지에 둔덕이 생김 */
const BUMP_THRESHOLD = 0.42;
/** 집 중심에서 이 거리까지는 평평, 그다음 이 거리까지 서서히 솟음 */
const HOUSE_FLAT = { inner: 4.4, outer: 6.8 };
/** 울타리 줄 양쪽으로 평평하게 두는 폭 (울타리 기둥이 둔덕에 묻히지 않게) */
const FENCE_FLAT = { inner: 0.8, outer: 2.6 };
/** 우체통 둘레 평평한 거리 */
const MAILBOX_FLAT = { inner: 1.0, outer: 2.2 };

/** 0~1 사이로 부드럽게 올라가는 곡선 (a 이하면 0, b 이상이면 1) */
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 격자 점마다 정해진 0~1 숫자 (같은 점이면 항상 같은 값) */
function hash(ix: number, iz: number): number {
  const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** 값 노이즈: 격자 점의 값을 부드럽게 섞어 매끈한 무늬를 만듭니다 (결과 0~1) */
function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** 큰 무늬 + 작은 무늬를 겹친 노이즈 (결과 대략 0~1) */
function fbm(x: number, z: number): number {
  return valueNoise(x, z) * 0.7 + valueNoise(x * 2.3 + 17, z * 2.3 - 9) * 0.3;
}

/**
 * 광장 테두리의 눈 둔덕: 광장에서 치워 낸 눈이 가장자리에 낮게 쌓인 띠 (11.25 사용자 요청)
 * inner~outer 사이에서 봉긋 솟고, 둘레를 따라 높이가 들쭉날쭉합니다.
 */
export const PLAZA_RIM = { inner: PLAZA_RADIUS - 0.45, outer: PLAZA_RADIUS + 1.5, height: 0.3 };

/** (x, z) 위치의 테두리 눈 둔덕 높이 (띠 밖이면 0) */
export function plazaRimHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= PLAZA_RIM.inner || r >= PLAZA_RIM.outer) return 0;
  const t = (r - PLAZA_RIM.inner) / (PLAZA_RIM.outer - PLAZA_RIM.inner);
  // 가운데가 봉긋하고 양 끝은 완만하게 눈밭으로 이어지는 곡선 × 둘레를 따라 달라지는 높이(0.45~1배)
  return PLAZA_RIM.height * Math.sin(Math.PI * t) ** 2 * (0.45 + 0.55 * valueNoise(x * 0.55 + 40, z * 0.55 - 23));
}

export type Terrain = {
  /** (x, z) 위치의 땅 높이: 캐릭터·나무가 딛는 높이 (눈 둔덕 + 광장 테두리 둔덕) */
  heightAt: (x: number, z: number) => number;
  /** 넓은 눈밭 그물만의 높이 (광장 테두리 둔덕은 따로 촘촘한 띠로 그리므로 뺀 값) */
  baseHeightAt: (x: number, z: number) => number;
};

/**
 * 마을 하나의 지형을 만듭니다.
 * - slots: 집 자리(그 둘레는 평평하게)
 * - fenceRadius: 울타리 반지름(안·밖 둔덕 크기가 달라짐)
 * - edgeRadius: 울퉁불퉁한 땅이 끝나는 반지름. 그 바깥은 평평한 먼 눈밭이라, 이음매가 없게 여기서 높이 0으로 내려옵니다
 */
export function createTerrain(slots: HouseSlot[], fenceRadius: number, edgeRadius: number): Terrain {
  // 우체통 위치는 집 자리에서 바로 알 수 있습니다
  const mailboxes = slots.map((s) => s.mailbox);
  // 계산을 빠르게: 집 평평 구역에 들어갈 가능성이 있는 집만 거르는 데 쓰는 반지름 제곱
  const houseOuter2 = HOUSE_FLAT.outer * HOUSE_FLAT.outer;
  const mailboxOuter2 = MAILBOX_FLAT.outer * MAILBOX_FLAT.outer;

  const baseHeightAt = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    // 광장 안은 평평, 광장 가장자리에서 서서히 솟기 시작
    let mask = smoothstep(PLAZA_RADIUS + 0.5, PLAZA_RADIUS + 3.5, r) * (1 - smoothstep(edgeRadius - 6, edgeRadius, r));
    if (mask === 0) return 0;
    mask *= smoothstep(FENCE_FLAT.inner, FENCE_FLAT.outer, Math.abs(r - fenceRadius));
    if (mask === 0) return 0;

    for (const s of slots) {
      const dx = x - s.x;
      const dz = z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < houseOuter2) mask *= smoothstep(HOUSE_FLAT.inner, HOUSE_FLAT.outer, Math.sqrt(d2));
    }
    for (const m of mailboxes) {
      const dx = x - m.x;
      const dz = z - m.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < mailboxOuter2) mask *= smoothstep(MAILBOX_FLAT.inner, MAILBOX_FLAT.outer, Math.sqrt(d2));
    }
    if (mask === 0) return 0;

    // 울타리 안은 낮은 둔덕, 바깥은 큰 언덕 (울타리 근처에서 부드럽게 바뀜)
    const outside = smoothstep(fenceRadius - 1, fenceRadius + 6, r);
    const amplitude = INNER_BUMP_HEIGHT + (OUTER_BUMP_HEIGHT - INNER_BUMP_HEIGHT) * outside;
    const n = fbm(x / BUMP_SIZE, z / BUMP_SIZE);
    const bump = Math.max(0, n - BUMP_THRESHOLD) / (1 - BUMP_THRESHOLD);
    return amplitude * bump * mask;
  };

  const heightAt = (x: number, z: number) => baseHeightAt(x, z) + plazaRimHeight(x, z);

  return { heightAt, baseHeightAt };
}
