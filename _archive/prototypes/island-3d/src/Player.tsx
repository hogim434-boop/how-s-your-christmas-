import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Character } from './Character'
import type { Look } from './look'
import { SPOTS, pushOutOfObstacles } from './world'
import type { SpotId } from './world'

// 캐릭터의 "움직임"을 담당하는 파일입니다. (모습은 Character.tsx 가 그립니다)

/** 걷는 속도 (1초에 몇 칸) */
const WALK_SPEED = 3.2
/** 기뻐하는 동작을 보여주는 시간 (1000 = 1초) */
const EMOTE_MS = 1700

type Props = {
  /** 걸어갈 목표 지점. 땅을 누를 때마다 값이 바뀝니다. */
  target: RefObject<THREE.Vector3>
  /** 숫자가 바뀔 때마다 기뻐하는 동작을 한 번 합니다. */
  emote: number
  /** 가까이 있는 장소가 바뀌면 알려줍니다. */
  onNear: (spot: SpotId | null) => void
  /** 캐릭터의 현재 위치를 여기에 계속 적어 둡니다 (발자국 등이 읽어 갑니다). */
  playerPos: RefObject<THREE.Vector3>
  /** 캐릭터의 겉모습 설정 */
  look: Look
  /** true 면 꾸미기 화면: 카메라가 가까이 다가가고 캐릭터가 정면을 봅니다. */
  closeUp: boolean
  /** 카메라를 얼마나 더 뒤로 뺄지 (1 = 기본). 마을 전체를 보여줄 때 키웁니다. */
  zoom?: number
  /**
   * 전체를 보여 줄 큰 물체 (대왕 트리). 값을 넘기면 카메라가 캐릭터를 따라가는 대신
   * 낮은 자리로 물러나 이 물체를 밑동부터 꼭대기까지 올려다봅니다.
   */
  landmark?: { x: number; z: number; height: number } | null
}

/** 각도 차이를 -180도 ~ +180도 사이로 정리합니다 (가장 짧은 방향으로 돌기 위해). */
function shortestAngle(from: number, to: number) {
  const full = Math.PI * 2
  return ((((to - from + Math.PI) % full) + full) % full) - Math.PI
}

export function Player({ target, emote, onNear, playerPos, look, closeUp, zoom = 1, landmark }: Props) {
  const group = useRef<THREE.Group>(null!)
  const desiredAction = useRef('Idle') // 지금 보여주고 싶은 동작
  const emoteUntil = useRef(0) // 이 시각까지 기뻐하는 동작을 보여줍니다
  const nearSpot = useRef<SpotId | null>(null)
  const lookAt = useRef(new THREE.Vector3(0, 1, 3.5)) // 카메라가 바라보는 지점
  const tmp = useRef(new THREE.Vector3())
  const camGoal = useRef(new THREE.Vector3()) // 올려다보는 시점의 카메라 자리
  const lookGoal = useRef(new THREE.Vector3()) // 올려다보는 시점에서 바라볼 지점

  // emote 숫자가 바뀌면 잠깐 기뻐하기
  useEffect(() => {
    if (emote > 0) emoteUntil.current = performance.now() + EMOTE_MS
  }, [emote])

  // useFrame: 화면이 그려질 때마다(1초에 약 60번) 실행됩니다.
  useFrame((state, delta) => {
    const pos = group.current.position
    const dx = target.current.x - pos.x
    const dz = target.current.z - pos.z
    const dist = Math.hypot(dx, dz)
    const turn = Math.min(1, delta * 10)

    if (dist > 0.08 && !closeUp) {
      // 목표까지 남았으면 한 걸음 이동
      emoteUntil.current = 0
      const step = Math.min(dist, WALK_SPEED * delta)
      const [nx, nz] = pushOutOfObstacles(
        pos.x + (dx / dist) * step,
        pos.z + (dz / dist) * step,
        0.35,
      )
      pos.x = nx
      pos.z = nz
      // 가는 방향으로 몸을 부드럽게 돌리기
      group.current.rotation.y += shortestAngle(group.current.rotation.y, Math.atan2(dx, dz)) * turn
      desiredAction.current = 'Walking_A'
    } else {
      desiredAction.current = performance.now() < emoteUntil.current ? 'Cheer' : 'Idle'
      // 꾸미기 화면에서는 카메라 쪽(정면)을 보게 돌립니다
      if (closeUp) group.current.rotation.y += shortestAngle(group.current.rotation.y, 0) * turn
    }

    // 카메라가 캐릭터를 살짝 늦게 따라오도록 (부드러운 느낌)
    const follow = 1 - Math.pow(0.002, delta)
    if (closeUp) {
      // 꾸미기: 가까이에서, 캐릭터가 화면 위쪽에 오도록 아래를 바라봅니다
      tmp.current.set(pos.x, 2.3, pos.z + 6.2)
      state.camera.position.lerp(tmp.current, follow)
      tmp.current.set(pos.x, 0.1, pos.z)
    } else {
      // 세로로 긴 화면(휴대폰)에서는 좌우가 좁게 보이므로 카메라를 더 뒤로 뺍니다.
      const zoomOut = (state.size.width < state.size.height ? 1.5 : 1) * zoom
      tmp.current.set(pos.x, 7.5 * zoomOut, pos.z + 10.5 * zoomOut)
      // 전체 보기일 때: 카메라를 땅 가까이 낮추고 나무에서 충분히 떨어진 앞쪽에 둡니다
      const near = landmark ? 1 : 0
      if (landmark) {
        camGoal.current.set(landmark.x, 2.6, landmark.z + 17)
        // 나무 가운데 높이를 바라보면 밑동부터 꼭대기까지 한 화면에 들어옵니다
        lookGoal.current.set(landmark.x, landmark.height * 0.52, landmark.z)
      }
      tmp.current.lerp(camGoal.current, near)
      state.camera.position.lerp(tmp.current, follow)
      tmp.current.set(pos.x, 1, pos.z).lerp(lookGoal.current, near)
    }
    lookAt.current.lerp(tmp.current, follow)
    state.camera.lookAt(lookAt.current)

    playerPos.current.copy(pos)

    // 가까운 장소 확인 (트리, 우체통)
    let found: SpotId | null = null
    for (const s of SPOTS) {
      if (Math.hypot(pos.x - s.x, pos.z - s.z) < s.range) found = s.id
    }
    if (found !== nearSpot.current) {
      nearSpot.current = found
      onNear(found)
    }
  })

  return (
    <group ref={group} position={[0, 0, 3.5]}>
      <Character look={look} desiredAction={desiredAction} />
    </group>
  )
}
