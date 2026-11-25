import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { paintPalette } from './look'
import type { CharacterType, Look } from './look'
import { toonGradient } from './toon'
import { useStyle } from './styles'

// 캐릭터의 "모습"만 담당하는 파일입니다. (어디로 걸어갈지는 Player.tsx 가 정합니다)
// 모델: KayKit Adventurers (Kay Lousberg 제작, CC0 라이선스 — 상업 이용 가능)

const MODEL_URL: Record<CharacterType, string> = {
  Rogue: '/models/kaykit/Rogue.glb',
  Mage: '/models/kaykit/Mage.glb',
}

/** 원본 모델 키가 약 2.2라서 0.66배로 줄여 약 1.45로 맞춥니다 */
const MODEL_SCALE = 0.66

type Props = {
  look: Look
  /** 지금 재생하고 싶은 동작 이름 (Idle, Walking_A, Cheer ...). 값이 바뀌면 부드럽게 전환됩니다. */
  desiredAction: RefObject<string>
}

export function Character({ look, desiredAction }: Props) {
  const root = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF(MODEL_URL[look.type])
  // 사실적인 마을인지 (처음 만든 섬 화면에서는 기본값인 미니어처로 취급됩니다)
  const realistic = useStyle().kit === 'real'
  const { actions } = useAnimations(animations, root)
  const playing = useRef<string | null>(null)

  // 1) 부품 보이기/숨기기
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      // 몸이 화면 가장자리에서 갑자기 사라지는 현상을 막습니다
      mesh.frustumCulled = false

      const name = obj.name
      if (!name.startsWith(`${look.type}_`)) {
        // 이름이 "Rogue_", "Mage_" 로 시작하지 않는 것은 무기·소품이라 숨깁니다
        obj.visible = false
      } else if (name.endsWith('_Cape')) {
        obj.visible = look.cape
      } else if (name.endsWith('_Hat')) {
        obj.visible = look.hat
      } else {
        obj.visible = true
      }
    })
  }, [scene, look.type, look.cape, look.hat])

  // 2) 색 입히기: 색상표 그림을 새로 칠해서 모든 부품에 적용합니다
  useEffect(() => {
    // 원본 색상표는 처음 한 번만 찾아서 보관해 둡니다 (계속 덧칠하면 원래 색을 잃으니까요)
    if (!scene.userData.originalMap) {
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh && !scene.userData.originalMap) {
          scene.userData.originalMap = (mesh.material as THREE.MeshStandardMaterial).map
        }
      })
    }
    const original = scene.userData.originalMap as THREE.Texture | null
    if (!original) return

    const texture = new THREE.CanvasTexture(paintPalette(original.image as CanvasImageSource, look))
    texture.flipY = false // glTF 모델의 그림은 위아래를 뒤집지 않습니다
    texture.colorSpace = THREE.SRGBColorSpace

    // 장난감 마을에서는 배경과 같은 만화풍(툰) 재료를,
    // 사실적인 마을에서는 빛을 부드럽게 받는 일반 재료를 씁니다 (툰 재료는 실사 배경에서 붕 떠 보입니다)
    const material = realistic
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75 })
      : new THREE.MeshToonMaterial({ map: texture, gradientMap: toonGradient })
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) mesh.material = material
    })

    // 다음 색으로 바뀔 때 이전 그림과 재료는 메모리에서 지웁니다
    return () => {
      texture.dispose()
      material.dispose()
    }
  }, [scene, look, realistic])

  // 3) 동작 전환: 원하는 동작이 바뀌면 이전 동작을 서서히 끄고 새 동작을 서서히 켭니다
  useFrame(() => {
    const wanted = desiredAction.current
    if (playing.current === wanted) return
    const next = actions[wanted]
    if (!next) return
    if (playing.current) actions[playing.current]?.fadeOut(0.2)
    next.reset().fadeIn(0.2).play()
    playing.current = wanted
  })

  // 캐릭터 종류가 바뀌면 동작을 처음부터 다시 재생합니다
  useEffect(() => {
    playing.current = null
  }, [scene])

  return (
    <group ref={root}>
      <primitive object={scene} scale={MODEL_SCALE} />
    </group>
  )
}

// 두 모델을 미리 받아 두어 캐릭터를 바꿀 때 기다리지 않게 합니다.
useGLTF.preload(MODEL_URL.Rogue)
useGLTF.preload(MODEL_URL.Mage)
