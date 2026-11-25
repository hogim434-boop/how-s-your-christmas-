import { useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// 3D 모델 파일을 불러와 화면에 놓는 부품입니다.
// 모델: Kenney Holiday Kit (kenney.nl 제작, CC0 라이선스 — 상업 이용 가능)

const BASE = '/models/kenney-holiday/'

type KitProps = {
  /** 모델 파일 이름 (확장자 .glb 제외). 예: 'tree-snow-a' */
  name: string
} & Omit<ThreeElements['group'], 'name'>

/**
 * 모델 하나를 놓습니다. position, rotation, scale 로 위치·방향·크기를 정합니다.
 * 같은 모델을 여러 곳에 놓을 수 있도록, 불러온 원본을 복사해서 씁니다.
 */
export function Kit({ name, ...props }: KitProps) {
  const { scene } = useGLTF(`${BASE}${name}.glb`)

  const object = useMemo(() => {
    const copy = scene.clone(true)
    copy.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      // 그림자를 만들기도 하고 받기도 하게 합니다
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    return copy
  }, [scene])

  return (
    <group {...props}>
      <primitive object={object} />
    </group>
  )
}

/**
 * 모델 파일들을 미리 한꺼번에 받아 둡니다.
 * 이렇게 하지 않으면 화면에 필요해지는 순서대로 하나씩 받아서 처음 화면이 늦게 뜹니다.
 */
export function preloadKit(names: string[]) {
  for (const name of new Set(names)) useGLTF.preload(`${BASE}${name}.glb`)
}
