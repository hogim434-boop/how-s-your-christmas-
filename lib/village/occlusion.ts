// "집이 캐릭터를 가리기 시작했나?"를 계산하는 순수 함수입니다. (11.25 사용자 요청)
// 화면 위에서 집이 차지하는 네모와 캐릭터가 차지하는 네모가 겹치기 시작하고,
// 집이 캐릭터보다 카메라에 더 가까우면 "가린다"고 봅니다.

/** 화면 위 네모 (좌표는 -1~1 범위의 화면 좌표) */
export type Rect = { minX: number; minY: number; maxX: number; maxY: number };

/** 점 여러 개를 모두 감싸는 가장 작은 네모 */
export function boundingRect(points: { x: number; y: number }[]): Rect {
  const r: Rect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of points) {
    r.minX = Math.min(r.minX, p.x);
    r.minY = Math.min(r.minY, p.y);
    r.maxX = Math.max(r.maxX, p.x);
    r.maxY = Math.max(r.maxY, p.y);
  }
  return r;
}

/** 두 네모가 조금이라도 겹치는지 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

/**
 * 집이 캐릭터를 가리는지.
 * - houseRect / playerRect: 화면 위 네모
 * - houseDistance / playerDistance: 카메라에서 각각까지의 거리 (집이 더 가까워야 가릴 수 있음)
 */
export function isOccluding(houseRect: Rect, playerRect: Rect, houseDistance: number, playerDistance: number): boolean {
  return houseDistance < playerDistance && rectsOverlap(houseRect, playerRect);
}

type Pt = { x: number; y: number };

/**
 * 점들을 고무줄로 감쌌을 때의 바깥 테두리(볼록 껍질)를 돌려줍니다. (Andrew의 monotone chain 방법)
 * 네모보다 집의 실제 모양(비스듬한 지붕 등)에 훨씬 가깝게 맞습니다.
 */
export function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * 볼록한 도형 두 개가 겹치는지 (분리축 검사: 두 도형 사이에 "틈 선"을 하나라도 그을 수 있으면 안 겹침)
 */
export function convexOverlap(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const nx = p2.y - p1.y;
      const ny = p1.x - p2.x;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const p of a) {
        const d = p.x * nx + p.y * ny;
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      for (const p of b) {
        const d = p.x * nx + p.y * ny;
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      if (maxA <= minB || maxB <= minA) return false;
    }
  }
  return true;
}

/** 집 윤곽(점들)과 캐릭터 윤곽(점들)으로 "가리기 시작했는지" 판단합니다 */
export function isOccludingShape(housePts: Pt[], playerPts: Pt[], houseDistance: number, playerDistance: number): boolean {
  if (houseDistance >= playerDistance) return false;
  return convexOverlap(convexHull(housePts), convexHull(playerPts));
}
