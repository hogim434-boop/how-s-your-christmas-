import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

// 사실적인 그림체에서 쓰는 "텍스처(표면 사진)" 도구 모음입니다.
//
// PBR 텍스처란? 실제 표면을 찍은 사진 세 장으로 재질을 표현하는 방법입니다.
//  - diffuse(색): 표면의 실제 색
//  - normal(울퉁불퉁함): 빛이 비칠 때 생기는 아주 작은 요철 (나뭇결, 돌 틈)
//  - rough(거칠기): 어디가 반짝이고 어디가 무광인지
// 세 장을 함께 쓰면 평평한 판도 진짜 나무판·돌벽처럼 보입니다.

const BASE = '/textures/'

/**
 * PBR 텍스처 세 장을 불러와 재질에 바로 넣을 수 있는 형태로 돌려줍니다.
 * 사용법: <meshStandardMaterial {...usePbr('snow_02')} />
 *
 * 무늬 크기는 텍스처가 아니라 모델의 UV(무늬 좌표)로 정합니다 → mapUV 참고
 */
export function usePbr(id: string, normalStrength = 1) {
  const [map, normalMap, roughnessMap] = useTexture([
    `${BASE}${id}/diffuse.jpg`,
    `${BASE}${id}/nor_gl.jpg`,
    `${BASE}${id}/rough.jpg`,
  ])
  return useMemo(() => {
    for (const texture of [map, normalMap, roughnessMap]) {
      // 무늬를 끝없이 반복해서 이어 붙이고, 비스듬히 볼 때도 흐려지지 않게 합니다
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = 8
    }
    // 색 사진만 "사람 눈에 맞춘 색 공간"이고, 나머지 두 장은 숫자 데이터입니다
    map.colorSpace = THREE.SRGBColorSpace
    return { map, normalMap, roughnessMap, normalScale: new THREE.Vector2(normalStrength, normalStrength) }
  }, [map, normalMap, roughnessMap, normalStrength])
}

/** 이 화면에서 쓰는 텍스처를 미리 받아 둡니다 */
export function preloadPbr(ids: string[]) {
  for (const id of ids) {
    for (const kind of ['diffuse', 'nor_gl', 'rough']) useTexture.preload(`${BASE}${id}/${kind}.jpg`)
  }
}

/**
 * 모델의 무늬 좌표(UV)를 "실제 크기" 기준으로 다시 계산합니다.
 * 이렇게 하면 큰 벽이든 작은 기둥이든 나뭇결 하나의 크기가 똑같이 보입니다.
 * (그렇지 않으면 큰 면에는 무늬가 크게 늘어나고, 작은 면에는 빽빽하게 줄어듭니다)
 *
 * tile: 무늬 한 장이 실제로 몇 칸 크기인지
 */
export function mapUV<T extends THREE.BufferGeometry>(geometry: T, tile: number): T {
  const pos = geometry.attributes.position
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const normal = geometry.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))
    // 면이 바라보는 방향에 맞춰, 그 면에 "평평하게 펼친" 좌표를 씁니다
    if (ny >= nx && ny >= nz) {
      uv[i * 2] = x / tile
      uv[i * 2 + 1] = z / tile
    } else if (nx >= nz) {
      uv[i * 2] = z / tile
      uv[i * 2 + 1] = y / tile
    } else {
      uv[i * 2] = x / tile
      uv[i * 2 + 1] = y / tile
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}

/** 작은 그림판(canvas)에 그림을 그려 텍스처로 만듭니다 */
export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, height = size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = height
  draw(canvas.getContext('2d')!, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** 가운데가 밝고 가장자리로 갈수록 투명해지는 동그라미 (눈송이·빛 알갱이·연기에 씁니다) */
export const softDot = canvasTexture(64, (ctx, size) => {
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
})

/**
 * 정해진 씨앗(seed)으로 매번 같은 순서의 "무작위" 숫자를 만듭니다.
 * 새로고침할 때마다 나무 모양이 바뀌지 않게 하려고 씁니다.
 */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** 부드럽게 이어지는 무작위 높낮이 (언덕, 울퉁불퉁한 눈 더미에 씁니다) */
export function smoothNoise(x: number, z: number) {
  return (
    Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * 0.5 +
    Math.sin(z * 0.13 + Math.cos(x * 0.05) * 3) * 0.35 +
    Math.sin((x + z) * 0.31) * 0.15
  )
}
