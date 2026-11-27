// "누른 자리 표시"(빨간 동그라미)를 땅 위 어디에, 어떤 기울기로 놓을지 계산하는 순수 함수입니다.
//
// (11.27 버그 수정) 전에는 표시의 높이를 0.08로 고정했습니다. 그런데 눈밭에는 최대 0.75 높이의 둔덕이 있어서
// 둔덕 위를 누르면 표시가 눈 속에 묻혀 보이지 않았습니다. 이제 그 자리의 땅 높이와 기울기에 맞춥니다.

/** 땅에서 살짝 띄우는 높이. 땅과 딱 붙으면 두 면이 겹쳐 지글거립니다 */
export const MARKER_LIFT = 0.08;
/** 땅의 기울기를 잴 때 양옆으로 살펴보는 거리 (동그라미가 가장 커졌을 때의 반지름쯤) */
const SLOPE_SAMPLE = 0.6;

export type MarkerPlacement = {
  /** 표시 가운데의 높이 */
  y: number;
  /** 땅이 바라보는 방향(법선). 길이는 1이고, 평평한 땅이면 (0, 1, 0) */
  normal: { x: number; y: number; z: number };
};

/** (x, z)를 눌렀을 때 표시를 놓을 높이와 기울기 */
export function markerPlacement(x: number, z: number, heightAt: (x: number, z: number) => number): MarkerPlacement {
  const d = SLOPE_SAMPLE;
  const east = heightAt(x + d, z);
  const west = heightAt(x - d, z);
  const south = heightAt(x, z + d);
  const north = heightAt(x, z - d);
  // 양옆·앞뒤의 높이 차이로 기울기를 구합니다
  const slopeX = (east - west) / (2 * d);
  const slopeZ = (south - north) / (2 * d);
  const length = Math.hypot(slopeX, 1, slopeZ);
  // 둔덕 꼭대기처럼 볼록한 곳은 가운데가, 오목한 곳은 둘레가 더 높습니다 → 높은 쪽에 맞춰 묻히지 않게 합니다
  const y = Math.max(heightAt(x, z), (east + west + south + north) / 4) + MARKER_LIFT;
  return { y, normal: { x: -slopeX / length, y: 1 / length, z: -slopeZ / length } };
}
