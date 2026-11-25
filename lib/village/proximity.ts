// 캐릭터 가까이에 있는 우체통을 찾는 순수 함수입니다. (3D 없이 테스트할 수 있게 분리)
// "가까이 오면 편지 쓰기 버튼이 뜨는" 기능에서 씁니다. (11.25 사용자 요청: A안 우체통 위 말풍선)

export type Spot = { id: string; x: number; z: number };

/** 우체통에서 이 거리 안으로 들어오면 버튼이 뜹니다 */
export const PROMPT_RADIUS = 3.2;

/**
 * 캐릭터 위치에서 radius 안에 있는 가장 가까운 자리를 돌려줍니다. 없으면 null.
 * 두 우체통이 모두 가까우면 더 가까운 쪽 하나만 고릅니다 (버튼이 두 개 뜨지 않게).
 */
export function nearestSpot(player: { x: number; z: number }, spots: Spot[], radius = PROMPT_RADIUS): Spot | null {
  let best: Spot | null = null;
  let bestDist = radius;
  for (const s of spots) {
    const d = Math.hypot(s.x - player.x, s.z - player.z);
    if (d <= bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/**
 * 우체통을 눌렀을 때 캐릭터가 걸어갈 자리: 우체통에서 광장 가운데 쪽으로 gap만큼 떨어진 곳.
 * (우체통 바로 위로 가면 충돌에 밀려나므로 앞에 섭니다)
 */
export function approachPoint(spot: { x: number; z: number }, gap = 1.6): { x: number; z: number } {
  const d = Math.hypot(spot.x, spot.z);
  if (d < 1e-6) return { x: spot.x, z: spot.z + gap };
  return { x: spot.x - (spot.x / d) * gap, z: spot.z - (spot.z / d) * gap };
}
