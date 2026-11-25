import * as THREE from 'three'

// "툰 셰이딩" 재료입니다.
// 보통 3D 는 밝은 곳에서 어두운 곳까지 부드럽게 이어지는데,
// 툰 셰이딩은 명암을 3단계로 딱딱 끊어서 만화처럼 보이게 합니다.

/** 명암 3단계(어두움, 중간, 밝음)를 담은 아주 작은 그림 */
export const toonGradient = (() => {
  const steps = new Uint8Array([120, 190, 255])
  const texture = new THREE.DataTexture(steps, 3, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.needsUpdate = true
  return texture
})()

type ToonProps = {
  color: string
  /** 스스로 내는 빛의 색 (전구, 창문 등) */
  emissive?: string
  /** 스스로 내는 빛의 세기 */
  emissiveIntensity?: number
}

/** 물체에 입히는 툰 재료. <mesh> 안에 넣어서 씁니다. */
export function Toon(props: ToonProps) {
  return <meshToonMaterial gradientMap={toonGradient} {...props} />
}
