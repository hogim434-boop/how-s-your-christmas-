import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { groundPointFromRay } from './bend'
import { Toon } from './toon'
import {
  HOUSE_POS,
  ISLAND_RADIUS,
  LAMP_POS,
  MAILBOX_POS,
  PINES,
  SNOWMAN_POS,
  TREE_POS,
} from './world'

// 이 파일은 섬 위의 "배경 물건"들을 그립니다.
// 3D 모델 파일 없이 상자, 원뿔, 공 같은 기본 도형만 조합해서 만들었습니다.

/** 하늘: 위는 남색, 지평선은 노을색으로 이어지고 달이 떠 있습니다. */
export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide, // 공의 안쪽 면에 색을 칠합니다 (우리는 공 안에 있으니까요)
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color('#1b2350') },
          middle: { value: new THREE.Color('#4a4f95') },
          horizon: { value: new THREE.Color('#e08f8a') },
          moonDir: { value: new THREE.Vector3(-0.28, 0.42, -0.86).normalize() },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 middle;
          uniform vec3 horizon;
          uniform vec3 moonDir;
          varying vec3 vDir;
          void main() {
            vec3 dir = normalize(vDir);
            // 높이에 따라 색을 섞습니다
            vec3 color = mix(horizon, middle, smoothstep(-0.12, 0.05, dir.y));
            color = mix(color, top, smoothstep(0.03, 0.4, dir.y));
            // 달과 달무리
            float d = dot(dir, moonDir);
            color += vec3(1.0, 0.92, 0.7) * smoothstep(0.9, 1.0, d) * 0.25;
            color = mix(color, vec3(2.4, 2.2, 1.7), smoothstep(0.9982, 0.9987, d));
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [],
  )
  return (
    <mesh material={material} renderOrder={-10}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  )
}

/** 섬(눈 덮인 땅) + 바다 */
export function Island() {
  const foam = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    // 섬 둘레의 하얀 물거품이 천천히 커졌다 작아졌다 합니다
    const s = 1 + Math.sin(clock.elapsedTime * 1.2) * 0.025
    foam.current.scale.set(s, s, 1)
  })

  return (
    <group>
      {/* 눈 덮인 윗면 */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS - 0.3, 0.8, 48]} />
        <Toon color="#f3f6fc" />
      </mesh>
      {/* 아래쪽 흙/바위 */}
      <mesh position={[0, -2.0, 0]}>
        <cylinderGeometry args={[ISLAND_RADIUS - 0.3, ISLAND_RADIUS - 3.2, 2.4, 14]} />
        <Toon color="#8d7461" />
      </mesh>
      {/* 눈 더미 몇 개 (밋밋한 땅에 굴곡을 줍니다) */}
      {(
        [
          [-1.8, 4.6, 1.3],
          [4.6, 4.9, 1.0],
          [-6.4, 0.9, 1.1],
          [5.4, -1.2, 0.9],
          [0.6, 6.6, 1.4],
        ] as const
      ).map(([x, z, s]) => (
        <mesh key={`${x},${z}`} position={[x, -0.05, z]} scale={[s, 0.28 * s, s]} receiveShadow>
          <sphereGeometry args={[1, 20, 12]} />
          <Toon color="#f3f6fc" />
        </mesh>
      ))}
      {/* 바다: 잘게 나눈 판이라서 멀리서 둥글게 휘어 보입니다 */}
      <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[240, 240, 80, 80]} />
        <Toon color="#3f55a0" />
      </mesh>
      {/* 섬 둘레의 물거품 */}
      <mesh ref={foam} position={[0, -1.57, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.5, 8.5, 48]} />
        <meshBasicMaterial color="#c9d6ff" transparent opacity={0.55} />
      </mesh>
    </group>
  )
}

/**
 * 눈에 보이지 않는 "터치 감지용" 바닥입니다.
 * 화면을 누르면 그 지점이 실제 땅의 어디인지 계산해서 onTap 으로 알려줍니다.
 */
export function TapPlane({ onTap }: { onTap: (x: number, z: number) => void }) {
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const point = groundPointFromRay(e.ray, e.camera)
    if (point) onTap(point.x, point.z)
  }
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

// 트리의 3단(아래부터). base: 시작 높이, radius: 밑면 반지름, height: 높이
const TIERS = [
  { base: 0.5, radius: 1.7, height: 1.7, color: '#2c7153' },
  { base: 1.4, radius: 1.35, height: 1.5, color: '#35805f' },
  { base: 2.2, radius: 1.0, height: 1.4, color: '#3f8f6b' },
]

const ORNAMENT_COLORS = ['#e4572e', '#f2b544', '#f28fa8', '#6ec5c0', '#fff6e5', '#8fd3e8']

/** 트리 표면 위의 한 점을 계산합니다. tier: 몇 번째 단, f: 높이 비율(0~1), angle: 둘레 각도 */
function pointOnTree(tier: number, f: number, angle: number): [number, number, number] {
  const t = TIERS[tier]
  const r = t.radius * (1 - f) + 0.06
  return [Math.cos(angle) * r, t.base + f * t.height, Math.sin(angle) * r]
}

/** 편지 장식이 걸릴 자리 12곳 (카메라가 보는 앞쪽 면에만 배치) */
const ORNAMENT_SLOTS = Array.from({ length: 12 }, (_, i) => {
  const angle = Math.PI * (0.1 + 0.8 * ((i * 0.618) % 1))
  const f = 0.18 + ((i * 37) % 45) / 100
  return pointOnTree(i % 3, f, angle)
})

/** 트리를 감싸는 반짝이 전구 자리 */
const BULBS = Array.from({ length: 30 }, (_, i) => {
  const tier = i % 3
  const angle = i * 1.3
  const f = 0.12 + ((i * 29) % 60) / 100
  return pointOnTree(tier, f, angle)
})

/** 편지 장식 하나. 처음 나타날 때 "통" 하고 튀어나오는 움직임이 있습니다. */
function Ornament({ position, color }: { position: [number, number, number]; color: string }) {
  const mesh = useRef<THREE.Mesh>(null!)
  const progress = useRef(0) // 0(안 보임) → 1(다 나타남)

  useFrame((_, delta) => {
    if (progress.current >= 1) return
    progress.current = Math.min(1, progress.current + delta * 2.2)
    // easeOutBack: 목표 크기를 살짝 넘었다가 돌아오는 곡선 (통통 튀는 느낌)
    const x = progress.current - 1
    const scale = 1 + 2.70158 * x * x * x + 1.70158 * x * x
    mesh.current.scale.setScalar(Math.max(0.001, scale))
  })

  return (
    <mesh ref={mesh} position={position} scale={0.001} castShadow>
      <sphereGeometry args={[0.16, 20, 20]} />
      <Toon color={color} />
    </mesh>
  )
}

/** 크리스마스 트리. letters: 걸려 있는 편지(장식) 개수 */
export function ChristmasTree({ letters }: { letters: number }) {
  const bulbs = useRef<THREE.Group>(null!)
  const star = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // 전구가 번갈아 반짝이게
    bulbs.current.children.forEach((child, i) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshToonMaterial
      mat.emissiveIntensity = 3.2 + Math.sin(t * 3 + i * 1.7) * 2.2
    })
    // 별이 천천히 회전
    star.current.rotation.y = t * 0.8
  })

  return (
    <group position={[TREE_POS.x, 0, TREE_POS.z]}>
      {/* 나무 기둥 */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.7, 12]} />
        <Toon color="#7a5236" />
      </mesh>
      {/* 3단 잎 */}
      {TIERS.map((t) => (
        <mesh key={t.base} position={[0, t.base + t.height / 2, 0]} castShadow receiveShadow>
          <coneGeometry args={[t.radius, t.height, 24]} />
          <Toon color={t.color} />
        </mesh>
      ))}
      {/* 각 단 끝자락에 쌓인 눈 */}
      {TIERS.map((t) => (
        <mesh key={t.base} position={[0, t.base + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[t.radius * 0.96, 0.07, 8, 32]} />
          <Toon color="#f3f6fc" />
        </mesh>
      ))}
      {/* 꼭대기 별 + 따뜻한 불빛 */}
      <mesh ref={star} position={[0, 3.8, 0]}>
        <octahedronGeometry args={[0.28, 0]} />
        <Toon color="#f7c948" emissive="#ffc94a" emissiveIntensity={5} />
      </mesh>
      <pointLight position={[0, 3.6, 0.6]} color="#ffd38a" intensity={10} distance={9} />

      {/* 반짝이 전구 */}
      <group ref={bulbs}>
        {BULBS.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <Toon color="#fff1c9" emissive={i % 3 === 0 ? '#ff9db8' : '#ffd97a'} emissiveIntensity={3} />
          </mesh>
        ))}
      </group>

      {/* 편지 장식: 편지 개수만큼만 보입니다 */}
      {ORNAMENT_SLOTS.slice(0, letters).map((p, i) => (
        <Ornament key={i} position={p} color={ORNAMENT_COLORS[i % ORNAMENT_COLORS.length]} />
      ))}

      {/* 트리 아래 선물 상자 */}
      <Gift position={[-1.35, 0, 1.25]} size={0.62} color="#e4572e" ribbon="#ffe9a8" />
      <Gift position={[1.25, 0, 1.3]} size={0.5} color="#6ec5c0" ribbon="#fff6e5" />
      <Gift position={[1.75, 0, 0.7]} size={0.36} color="#f28fa8" ribbon="#fff6e5" />
    </group>
  )
}

function Gift(props: {
  position: [number, number, number]
  size: number
  color: string
  ribbon: string
}) {
  const s = props.size
  return (
    <group position={props.position} rotation={[0, 0.4, 0]}>
      <mesh position={[0, s / 2, 0]} castShadow>
        <boxGeometry args={[s, s, s]} />
        <Toon color={props.color} />
      </mesh>
      {/* 리본 (가로, 세로) */}
      <mesh position={[0, s / 2, 0]}>
        <boxGeometry args={[s * 1.02, s * 1.02, s * 0.18]} />
        <Toon color={props.ribbon} />
      </mesh>
      <mesh position={[0, s / 2, 0]}>
        <boxGeometry args={[s * 0.18, s * 1.02, s * 1.02]} />
        <Toon color={props.ribbon} />
      </mesh>
      {/* 리본 매듭 */}
      <mesh position={[0, s * 1.08, 0]}>
        <sphereGeometry args={[s * 0.16, 12, 12]} />
        <Toon color={props.ribbon} />
      </mesh>
    </group>
  )
}

/** 집 */
export function House() {
  return (
    <group position={[HOUSE_POS.x, 0, HOUSE_POS.z]} rotation={[0, 0.35, 0]}>
      {/* 벽 */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.6, 2.0]} />
        <Toon color="#fff3dc" />
      </mesh>
      {/* 지붕 (4각뿔을 45도 돌려서 벽과 맞춤) */}
      <mesh position={[0, 2.15, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.05, 1.15, 4]} />
        <Toon color="#ef8a6f" />
      </mesh>
      {/* 지붕 꼭대기에 쌓인 눈 */}
      <mesh position={[0, 2.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.85, 0.5, 4]} />
        <Toon color="#f3f6fc" />
      </mesh>
      {/* 굴뚝 */}
      <mesh position={[0.7, 2.25, -0.3]} castShadow>
        <boxGeometry args={[0.32, 0.8, 0.32]} />
        <Toon color="#d9745b" />
      </mesh>
      {/* 문 */}
      <mesh position={[0, 0.5, 1.01]}>
        <boxGeometry args={[0.55, 1.0, 0.06]} />
        <Toon color="#7fa8d9" />
      </mesh>
      {/* 불 켜진 창문 2개 */}
      {[-0.78, 0.78].map((x) => (
        <mesh key={x} position={[x, 0.95, 1.01]}>
          <boxGeometry args={[0.42, 0.46, 0.06]} />
          <Toon color="#ffe9a8" emissive="#ffb347" emissiveIntensity={3.5} />
        </mesh>
      ))}
      <pointLight position={[0, 1, 1.8]} color="#ffc98a" intensity={3} distance={5} />
    </group>
  )
}

/** 우체통 */
export function Mailbox() {
  return (
    <group position={[MAILBOX_POS.x, 0, MAILBOX_POS.z]} rotation={[0, 0.3, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.9, 8]} />
        <Toon color="#9a6b4a" />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[0.42, 0.34, 0.6]} />
        <Toon color="#e4572e" />
      </mesh>
      {/* 깃발 */}
      <mesh position={[0.24, 1.18, 0.1]}>
        <boxGeometry args={[0.04, 0.3, 0.14]} />
        <Toon color="#ffe9a8" />
      </mesh>
    </group>
  )
}

/** 눈사람 */
export function Snowman() {
  return (
    <group position={[SNOWMAN_POS.x, 0, SNOWMAN_POS.z]} rotation={[0, -0.5, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <sphereGeometry args={[0.55, 24, 24]} />
        <Toon color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.38, 24, 24]} />
        <Toon color="#ffffff" />
      </mesh>
      {/* 목도리 */}
      <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.08, 8, 20]} />
        <Toon color="#e4572e" />
      </mesh>
      {/* 당근 코 */}
      <mesh position={[0, 1.15, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.28, 8]} />
        <Toon color="#f28c3a" />
      </mesh>
      {/* 눈 */}
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 1.26, 0.33]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <Toon color="#232b52" />
        </mesh>
      ))}
      {/* 털모자 */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toon color="#6ec5c0" />
      </mesh>
      <mesh position={[0, 1.82, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <Toon color="#fff6e5" />
      </mesh>
    </group>
  )
}

/** 가로등 */
export function Lamp() {
  return (
    <group position={[LAMP_POS.x, 0, LAMP_POS.z]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 2.2, 8]} />
        <Toon color="#3a4170" />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <Toon color="#fff1c9" emissive="#ffc45a" emissiveIntensity={4.5} />
      </mesh>
      <pointLight position={[0, 2.3, 0]} color="#ffd9a0" intensity={12} distance={8} />
    </group>
  )
}

/** 섬 가장자리의 눈 덮인 소나무들. 바람에 살짝 흔들립니다. */
export function Pines() {
  const group = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    group.current.children.forEach((tree, i) => {
      tree.rotation.z = Math.sin(clock.elapsedTime * 1.1 + i * 1.9) * 0.025
    })
  })

  return (
    <group ref={group}>
      {PINES.map(([x, z, s]) => (
        <group key={`${x},${z}`} position={[x, 0, z]} scale={s}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.18, 0.5, 8]} />
            <Toon color="#7a5236" />
          </mesh>
          <mesh position={[0, 1.0, 0]} castShadow>
            <coneGeometry args={[0.85, 1.3, 16]} />
            <Toon color="#3c7f66" />
          </mesh>
          <mesh position={[0, 1.75, 0]} castShadow>
            <coneGeometry args={[0.62, 1.1, 16]} />
            <Toon color="#4a9478" />
          </mesh>
          {/* 꼭대기에 쌓인 눈 */}
          <mesh position={[0, 2.2, 0]}>
            <coneGeometry args={[0.3, 0.5, 16]} />
            <Toon color="#f3f6fc" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 내리는 눈 */
export function Snow({ count = 350 }: { count?: number }) {
  const points = useRef<THREE.Points>(null!)

  // 눈송이들의 처음 위치를 무작위로 정합니다 (한 번만 계산).
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = Math.random() * 12
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [count])

  useFrame((_, delta) => {
    const attr = points.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= delta * (0.6 + (i % 5) * 0.12) // 아래로 떨어짐
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 12 // 바닥에 닿으면 다시 위에서 시작
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial color="#ffffff" size={0.09} transparent opacity={0.9} />
    </points>
  )
}

/** 발자국 개수 (오래된 것부터 재사용합니다) */
const FOOTPRINT_COUNT = 30

/** 캐릭터가 걸어간 자리에 남았다가 서서히 사라지는 눈 발자국 */
export function Footprints({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null!)
  const last = useRef(new THREE.Vector3(0, 0, 3.5)) // 마지막으로 발자국을 찍은 위치
  const next = useRef(0) // 다음에 쓸 발자국 번호
  const life = useRef(new Float32Array(FOOTPRINT_COUNT)) // 각 발자국의 남은 수명 (1 → 0)

  useFrame((_, delta) => {
    const pos = playerPos.current
    const dx = pos.x - last.current.x
    const dz = pos.z - last.current.z
    const moved = Math.hypot(dx, dz)

    // 0.42칸 걸을 때마다 발자국 하나 (왼발, 오른발 번갈아)
    if (moved > 0.42) {
      const side = next.current % 2 === 0 ? 1 : -1
      const mesh = group.current.children[next.current] as THREE.Mesh
      // 진행 방향의 옆쪽으로 살짝 비켜서 찍습니다
      mesh.position.set(pos.x + (dz / moved) * 0.13 * side, 0.012, pos.z - (dx / moved) * 0.13 * side)
      mesh.rotation.z = Math.atan2(dx, dz)
      life.current[next.current] = 1
      next.current = (next.current + 1) % FOOTPRINT_COUNT
      last.current.copy(pos)
    }

    // 모든 발자국이 8초에 걸쳐 서서히 사라짐
    group.current.children.forEach((child, i) => {
      life.current[i] = Math.max(0, life.current[i] - delta / 8)
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      mat.opacity = life.current[i] * 0.28
    })
  })

  return (
    <group ref={group}>
      {Array.from({ length: FOOTPRINT_COUNT }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} scale={[0.75, 1.2, 1]}>
          <circleGeometry args={[0.1, 12]} />
          <meshBasicMaterial color="#7f8dc4" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** 땅을 눌렀을 때 목표 지점에 나타나는 동그란 표시 */
export function TargetMarker({ position }: { position: THREE.Vector3 | null }) {
  const mesh = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    if (!mesh.current) return
    const pulse = 1 + Math.sin(clock.elapsedTime * 6) * 0.12
    mesh.current.scale.set(pulse, pulse, pulse)
  })
  if (!position) return null
  return (
    <mesh ref={mesh} position={[position.x, 0.03, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.22, 0.32, 24]} />
      <meshBasicMaterial color="#f2b544" transparent opacity={0.9} />
    </mesh>
  )
}
