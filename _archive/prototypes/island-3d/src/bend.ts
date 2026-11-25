import * as THREE from 'three'

// "둥근 지형" 효과를 만드는 파일입니다.
// 실제 땅은 평평하지만, 화면에 그릴 때만 카메라에서 멀리 있는 것일수록
// 아래로 내려가 보이게 해서 작은 행성 위에 있는 듯한 느낌을 줍니다.

/** 카메라에서 이 거리보다 먼 곳부터 휘어지기 시작합니다 */
export const BEND_START = 14
/** 휘는 정도. 숫자가 클수록 더 둥글게 보입니다 */
// 지금은 항상 공유 마을(미니어처) 화면만 보여 주므로 땅을 휘지 않습니다 (0 = 평평).
// 예전 섬 화면처럼 둥글게 휘게 하려면 0.006 정도를 넣으면 됩니다.
export const BEND_K: number = 0

// three.js 가 모든 물체의 위치를 계산할 때 쓰는 공통 코드(셰이더 조각)에
// "멀수록 아래로 내리기" 한 줄을 끼워 넣습니다. 그래서 모든 물체에 한 번에 적용됩니다.
// projectionMatrix[3][3] == 0.0 은 "원근 카메라일 때만"이라는 뜻입니다.
// (그림자를 계산하는 조명용 카메라에는 적용되지 않게 하려는 조건입니다)
THREE.ShaderChunk.project_vertex = THREE.ShaderChunk.project_vertex.replace(
  'gl_Position = projectionMatrix * mvPosition;',
  `if ( projectionMatrix[ 3 ][ 3 ] == 0.0 ) {
    float bendDepth = max( 0.0, - mvPosition.z - ${BEND_START.toFixed(1)} );
    mvPosition.y -= ${BEND_K.toFixed(4)} * bendDepth * bendDepth;
  }
  gl_Position = projectionMatrix * mvPosition;`,
)

const up = new THREE.Vector3()
const seen = new THREE.Vector3()
const real = new THREE.Vector3()
const inView = new THREE.Vector3()

/**
 * 화면에서 누른 지점이 "실제 땅"의 어디인지 계산합니다.
 * 화면에는 땅이 휘어져 보이므로, 휜 만큼을 거꾸로 되돌려야 정확한 위치가 나옵니다.
 * 하늘을 눌렀다면 null 을 돌려줍니다.
 */
export function groundPointFromRay(ray: THREE.Ray, camera: THREE.Camera): THREE.Vector3 | null {
  // 카메라 기준 "위쪽" 방향
  up.set(0, 1, 0).applyQuaternion(camera.quaternion)
  let drop = 0 // 그 지점이 화면에서 얼마나 내려가 보이는지

  // 휜 정도는 거리에 따라 달라지므로, 몇 번 반복해서 점점 정확한 값을 찾습니다.
  for (let i = 0; i < 5; i++) {
    const planeY = -up.y * drop
    const t = (planeY - ray.origin.y) / ray.direction.y
    if (!(t > 0)) return null
    seen.copy(ray.direction).multiplyScalar(t).add(ray.origin) // 화면에 보이는 위치
    real.copy(up).multiplyScalar(drop).add(seen) // 실제 위치
    inView.copy(real).applyMatrix4(camera.matrixWorldInverse)
    const depth = Math.max(0, -inView.z - BEND_START)
    drop = BEND_K * depth * depth
  }
  return real.clone().setY(0)
}
