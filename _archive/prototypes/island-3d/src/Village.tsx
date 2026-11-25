import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Kit, preloadKit } from './Kit'
import { useStyle } from './styles'
import { toonGradient } from './toon'
import { LAMPS, REINDEER, RESIDENTS, SLED, SNOWMAN, houseRotation, mailboxPos } from './residents'
import type { Resident } from './residents'
import { ISLAND_RADIUS, TREE_POS } from './world'
import { TreeOrnament } from './Ornaments'
import { TREE_ORNAMENT_PLAN, UNLOCK, giftCount } from './decorPlan'

// 공유 마을의 물건들을 그리는 파일입니다.
// 모양은 그림체와 상관없이 같고, "어떻게 칠할지"만 그림체에 따라 달라집니다.

/** 크리스마스 장식에 쓰는 색: 빨강, 금색, 초록, 흰색 */
const FESTIVE = ['#d6453c', '#f2c14e', '#3f9a6b', '#fff6e5']

// ───────── 재료(칠하는 방법) ─────────

/** 지금 그림체에 맞는 재료를 골라 줍니다. <mesh> 안에 넣어서 씁니다. */
function Mat(props: { color: string; emissive?: string; emissiveIntensity?: number }) {
  const style = useStyle()
  if (style.material === 'toon') return <meshToonMaterial gradientMap={toonGradient} {...props} />
  return <meshStandardMaterial roughness={0.85} {...props} />
}

// ───────── 땅 ─────────

/** 땅의 크기(반지름). 화면 끝까지 이어져 보이도록 아주 크게 잡습니다 */
const GROUND_RADIUS = 160

/** 마을 땅. 화면 끝까지 이어지고, 멀리 갈수록 안개에 섞여 배경색으로 사라집니다. */
export function Ground() {
  const style = useStyle()
  const c = style.colors

  return (
    <group>
      {/* 눈 덮인 넓은 땅 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[GROUND_RADIUS, 96]} />
        <Mat color={c.ground} />
      </mesh>
      {/* 가운데 광장 */}
      <mesh position={[0, 0.01, 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 64]} />
        <Mat color={c.plaza} />
      </mesh>
      <Fence />
      <Forest />
    </group>
  )
}

/** 울타리의 반지름. 캐릭터가 갈 수 있는 끝(ISLAND_RADIUS - 0.8)보다 살짝 바깥입니다 */
const FENCE_RADIUS = ISLAND_RADIUS - 0.2
/** 기둥 수: 울타리 길이에 맞춰 기둥 간격(약 1.2)이 일정하게, 그리고 알전구용으로 3의 배수가 되게 정합니다 */
const FENCE_POSTS = Math.round((Math.PI * 2 * FENCE_RADIUS) / 1.2 / 3) * 3

/** 마을의 경계를 알려 주는 낮은 나무 울타리. 여기까지만 걸어갈 수 있습니다. */
function Fence() {
  const { colors: c, glow } = useStyle()
  return (
    <group>
      {/* 기둥 */}
      {Array.from({ length: FENCE_POSTS }, (_, i) => {
        const a = (i / FENCE_POSTS) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * FENCE_RADIUS, 0.4, Math.sin(a) * FENCE_RADIUS]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 0.8, 8]} />
            <Mat color={c.trunk} />
          </mesh>
        )
      })}
      {/* 기둥 3개마다 알전구를 하나씩 얹습니다 */}
      {Array.from({ length: FENCE_POSTS / 3 }, (_, i) => {
        const a = ((i * 3) / FENCE_POSTS) * Math.PI * 2
        const color = FESTIVE[i % FESTIVE.length]
        return (
          <mesh key={i} position={[Math.cos(a) * FENCE_RADIUS, 0.87, Math.sin(a) * FENCE_RADIUS]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <Mat color={color} emissive={color} emissiveIntensity={glow * 0.7} />
          </mesh>
        )
      })}
      {/* 기둥을 잇는 가로대 2줄 (눕힌 고리 모양) */}
      {[0.32, 0.62].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[FENCE_RADIUS, 0.035, 6, 160]} />
          <Mat color={c.trunk} />
        </mesh>
      ))}
    </group>
  )
}

/** 마을을 둘러싼 배경 나무들: [x, z, 크기]. 걸어갈 수 있는 범위 바깥에 심습니다. */
export const FOREST: [number, number, number][] = Array.from({ length: 80 }, (_, i) => {
  const angle = i * 2.399 // 황금각: 이 각도로 돌리면 한쪽에 몰리지 않고 고르게 퍼집니다
  const radius = ISLAND_RADIUS + 2 + ((i * 7) % 23)
  return [Math.cos(angle) * radius, Math.sin(angle) * radius, 1.5 + ((i * 13) % 10) / 10] as [number, number, number]
})
  // 카메라가 있는 앞쪽에는 심지 않습니다 (나무가 화면을 가리지 않게)
  .filter(([, z]) => z < 9)

/** 숲에 번갈아 심는 나무 모델 */
const FOREST_MODELS = ['tree-snow-a', 'tree-snow-b', 'tree-snow-c', 'tree']

function Forest() {
  return (
    <>
      {FOREST.map(([x, z, s], i) => (
        <Kit
          key={i}
          name={FOREST_MODELS[i % FOREST_MODELS.length]}
          position={[x, 0, z]}
          rotation={[0, i * 1.7, 0]}
          scale={s * 1.15}
        />
      ))}
    </>
  )
}

// ───────── 대왕 트리 ─────────

/** 대왕 트리 모델을 몇 배로 키울지 (원본 키 약 2, 키우면 약 8 — 집의 세 배쯤 됩니다) */
const BIG_TREE_SCALE = 4.2
/** 장식 자리를 계산할 때 쓰는 배율 */
const K = BIG_TREE_SCALE / 2.3

/** 트리 표면 위의 한 점. y: 높이, angle: 둘레 각도. 위로 갈수록 좁아지는 원뿔로 어림합니다. */
function pointOnTree(y: number, angle: number): [number, number, number] {
  const r = K * (1.3 * (1 - (y / K - 0.5) / 4.3) + 0.1)
  return [Math.cos(angle) * r, y, Math.sin(angle) * r]
}

/** 장식끼리 최소한 이만큼은 떨어지게 합니다 (장식 지름의 약 3배) — 두세 개가 뭉쳐 보이지 않도록 */
const ORNAMENT_MIN_GAP = 1.0

/**
 * 편지 장식이 걸릴 자리 24곳. 페이지를 열 때마다 트리 앞쪽 면(카메라가 보는 쪽)에서 무작위로 뽑습니다.
 * 이미 뽑은 자리와 너무 가까우면 다시 뽑아서, 장식이 고르게 흩어지게 합니다.
 * 편지가 올 때마다 앞에서부터 하나씩 채워집니다.
 */
export const ORNAMENT_SLOTS: [number, number, number][] = (() => {
  const slots: [number, number, number][] = []
  let tries = 0
  while (slots.length < 24) {
    const angle = Math.PI * (-0.05 + Math.random() * 1.1) // 앞쪽 반 바퀴보다 조금 넓게
    const y = K * (0.9 + Math.random() * 2.6) // 트리 아래쪽부터 꼭대기 근처까지
    const p = pointOnTree(y, angle)
    // 위로 갈수록 트리가 좁아져 자리가 부족하므로, 오래 못 찾으면 거리 조건을 조금씩 느슨하게 합니다
    const gap = ORNAMENT_MIN_GAP * Math.max(0.5, 1 - tries / 4000)
    const farEnough = slots.every(([x, yy, z]) => Math.hypot(x - p[0], yy - p[1], z - p[2]) >= gap)
    if (farEnough) slots.push(p)
    tries++
  }
  return slots
})()

/** 처음 나타날 때 0 에서 살짝 넘치게 커졌다가 제자리로 돌아오는 "통" 튀어나오는 움직임 */
export function usePopIn(ref: { current: THREE.Object3D }) {
  const progress = useRef(0)
  useFrame((_, delta) => {
    if (progress.current >= 1) return
    progress.current = Math.min(1, progress.current + delta * 2.2)
    const x = progress.current - 1
    ref.current.scale.setScalar(Math.max(0.001, 1 + 2.70158 * x * x * x + 1.70158 * x * x))
  })
}

/** 트리를 다섯 바퀴 감아 올라가는 전구 줄의 자리 (90%) */
const GARLAND_POINTS: [number, number, number][] = Array.from({ length: 120 }, (_, i) => {
  const t = i / 119
  const [x, y, z] = pointOnTree(K * (0.75 + t * 2.95), t * Math.PI * 2 * 5)
  return [x * 1.04, y, z * 1.04] // 가지 끝보다 살짝 바깥
})
/** 전구 줄의 전선(금색 줄) 모양 */
const garlandGeo = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3(GARLAND_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
  400,
  0.03,
  6,
  false,
)

/** 트리 꼭대기의 대왕별 모양 (100%) */
const bigStarGeo = (() => {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.8 : 0.36
    const a = Math.PI / 2 + (i * Math.PI) / 5
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 })
  g.center()
  return g
})()

/** 대왕별: 꼭대기에서 천천히 돌며 빛납니다 */
function BigStar() {
  const ref = useRef<THREE.Group>(null!)
  usePopIn(ref)
  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.6
  })
  return (
    <group ref={ref} position={[0, 8.75, 0]} scale={0.001}>
      <mesh geometry={bigStarGeo} castShadow>
        <meshStandardMaterial color="#f5c542" emissive="#ffcf4a" emissiveIntensity={0.9} roughness={0.35} metalness={0.3} />
      </mesh>
    </group>
  )
}

/**
 * 마을 가운데의 대왕 트리. level: 진행률 단계(0~10)
 * 처음에는 아무 장식도 없는 빈 나무이고, 단계가 오를수록 장식표(decorPlan.ts)대로 장식이 생깁니다.
 */
export function BigTree({ level }: { level: number }) {
  const style = useStyle()

  return (
    <group position={[TREE_POS.x, 0, TREE_POS.z]}>
      {/* 장식이 없는 빈 나무 모델 */}
      <Kit name="tree" scale={BIG_TREE_SCALE} />
      {style.night && <pointLight position={[0, 4, 3]} color="#ffd38a" intensity={22} distance={14} />}

      {/* 방울·종·양말·눈송이·쿠키 (단계마다 3개씩) */}
      {TREE_ORNAMENT_PLAN.map((o, i) =>
        o.level <= level ? <TreeOrnament key={i} position={ORNAMENT_SLOTS[i]} kind={o.kind} color={o.color} look="toy" /> : null,
      )}

      {/* 90%: 트리를 감아 올라가는 전구 줄 */}
      {level >= UNLOCK.treeGarland && (
        <group>
          <mesh geometry={garlandGeo}>
            <Mat color="#d9b04a" />
          </mesh>
          {GARLAND_POINTS.map((p, i) => {
            const color = FESTIVE[i % FESTIVE.length]
            return (
              <mesh key={i} position={p}>
                <sphereGeometry args={[0.085, 10, 10]} />
                <Mat color={color} emissive={color} emissiveIntensity={Math.max(0.9, style.glow)} />
              </mesh>
            )
          })}
        </group>
      )}

      {/* 100%: 대왕별 */}
      {level >= UNLOCK.starAndFireworks && <BigStar />}
    </group>
  )
}

// ───────── 폭죽 (100%) ─────────

const FIREWORK_COLORS = ['#ff5a5a', '#ffd34d', '#6fe39a', '#7ab8ff', '#ff8fd8', '#ffffff']
const SPARKS = 70 // 폭죽 하나의 불꽃 수
const FIREWORK_SECONDS = 2.4 // 한 번 터지고 사라질 때까지

/** 폭죽 하나: 아래에서 솟아올라 공중에서 둥글게 터지고, 불꽃이 떨어지며 사라지기를 반복합니다 */
function Firework({ delay }: { delay: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const material = useRef<THREE.MeshBasicMaterial>(null!)
  const state = useRef({ time: -delay, center: new THREE.Vector3(), dirs: [] as THREE.Vector3[] })
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // 새로 터질 위치·색·불꽃 방향을 정합니다
  const relaunch = () => {
    const st = state.current
    st.center.set((Math.random() - 0.5) * 22, 8 + Math.random() * 4, -9 - Math.random() * 6)
    st.dirs = Array.from({ length: SPARKS }, () => new THREE.Vector3().randomDirection().multiplyScalar(2.2 + Math.random() * 0.8))
    material.current.color.set(FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)])
  }

  useFrame((_, delta) => {
    const st = state.current
    if (st.dirs.length === 0) relaunch()
    st.time += delta
    if (st.time > FIREWORK_SECONDS) {
      st.time = 0
      relaunch()
    }
    const t = st.time
    for (let i = 0; i < SPARKS; i++) {
      if (t < 0) {
        dummy.scale.setScalar(0.0001) // 아직 차례가 아님
      } else if (t < 0.5) {
        // 솟아오르는 중: 불꽃 하나만 위로 올라갑니다
        const k = t / 0.5
        dummy.position.set(st.center.x, st.center.y - 6 * (1 - k), st.center.z)
        dummy.scale.setScalar(i === 0 ? 1.4 : 0.0001)
      } else {
        // 터진 뒤: 바깥으로 퍼지며 중력으로 살짝 떨어집니다
        const e = t - 0.5
        const spread = 1 - Math.exp(-e * 2.2)
        const d = st.dirs[i]
        dummy.position.set(st.center.x + d.x * spread, st.center.y + d.y * spread - 0.9 * e * e, st.center.z + d.z * spread)
        dummy.scale.setScalar(Math.max(0.0001, 1 - e / (FIREWORK_SECONDS - 0.5)))
      }
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
      <sphereGeometry args={[0.11, 8, 6]} />
      <meshBasicMaterial ref={material} toneMapped={false} />
    </instancedMesh>
  )
}

/** 마을 뒤쪽 하늘에서 번갈아 터지는 폭죽 4개 */
export function Fireworks() {
  return (
    <>
      {[0, 0.6, 1.2, 1.8].map((d) => (
        <Firework key={d} delay={d} />
      ))}
    </>
  )
}

// ───────── 주민의 집과 집 앞 우체통 ─────────

const HALF = Math.PI / 2

/**
 * 집을 이루는 부품 목록입니다. 통나무집 모델은 벽·모서리·지붕이 따로 있어서 레고처럼 조립합니다.
 * 부품 하나는 가로세로 1칸짜리이고, 벽은 그 칸의 앞쪽 가장자리에 붙어 있습니다.
 * 그래서 부품을 돌리면(rot) 왼쪽·오른쪽·뒤쪽 벽이 됩니다.
 * - x, z: 부품이 놓이는 칸의 가운데 / y: 높이 / rot: 돌리는 각도 / flip: 좌우 뒤집기 / depth: 앞뒤로 늘리는 배율
 */
type Piece = { name: string; x: number; z: number; y?: number; rot?: number; flip?: boolean; depth?: number }

const HOUSE_PIECES: Piece[] = [
  // 앞면: 문 + 창문
  { name: 'cabin-door-rotate', x: -0.5, z: 0.5 },
  { name: 'cabin-window-a', x: 0.5, z: 0.5 },
  // 뒷면
  { name: 'cabin-wall', x: -0.5, z: -0.5, rot: Math.PI },
  { name: 'cabin-window-b', x: 0.5, z: -0.5, rot: Math.PI },
  // 왼쪽 면 (앞 칸에는 리스가 달린 벽)
  { name: 'cabin-wall-wreath', x: -0.5, z: 0.5, rot: -HALF },
  { name: 'cabin-wall', x: -0.5, z: -0.5, rot: -HALF },
  // 오른쪽 면
  { name: 'cabin-window-b', x: 0.5, z: 0.5, rot: HALF },
  { name: 'cabin-wall-wreath', x: 0.5, z: -0.5, rot: HALF },
  // 네 모서리의 통나무 기둥
  { name: 'cabin-corner-logs', x: -0.5, z: 0.5 },
  { name: 'cabin-corner-logs', x: 0.5, z: 0.5, rot: HALF },
  { name: 'cabin-corner-logs', x: 0.5, z: -0.5, rot: Math.PI },
  { name: 'cabin-corner-logs', x: -0.5, z: -0.5, rot: -HALF },
  // 지붕 아래 세모난 벽 (앞, 뒤)
  { name: 'cabin-wall-roof', x: 0.5, z: 0.5, y: 1 },
  { name: 'cabin-wall-roof', x: -0.5, z: 0.5, y: 1, flip: true },
  { name: 'cabin-wall-roof', x: -0.5, z: -0.5, y: 1, rot: Math.PI },
  { name: 'cabin-wall-roof', x: 0.5, z: -0.5, y: 1, rot: Math.PI, flip: true },
  // 눈 쌓인 지붕 (오른쪽 2장, 왼쪽 2장). 서로 겹치지 않게 앞뒤 길이를 살짝 줄여 맞댑니다
  { name: 'cabin-roof-snow', x: 0.5, z: 0.6, y: 1, depth: 0.857 },
  { name: 'cabin-roof-snow-chimney', x: 0.5, z: -0.6, y: 1, depth: 0.857 },
  { name: 'cabin-roof-snow', x: -0.5, z: 0.6, y: 1, rot: Math.PI, depth: 0.857 },
  { name: 'cabin-roof-snow', x: -0.5, z: -0.6, y: 1, rot: Math.PI, depth: 0.857 },
]

/** 집 모델을 몇 배로 키울지 */
const HOUSE_SCALE = 1.25

/**
 * 집 앞 우체통. 여기에 편지를 넣습니다.
 * 크리스마스 시즌이라 빨간 통에 눈이 쌓이고, 리스·지팡이 사탕·선물로 꾸며져 있습니다.
 * sent: 내가 이 주민에게 편지를 넣었는지 (넣으면 깃발이 올라가고 바닥이 노랗게 빛납니다)
 */
function Mailbox({ sent }: { sent: boolean }) {
  return (
    <group>
      {/* 나무 기둥 */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.14, 0.8, 0.14]} />
        <Mat color="#7a5a44" />
      </mesh>
      {/* 빨간 통: 네모난 아래쪽 + 둥근 지붕 */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.56, 0.3, 0.8]} />
        <Mat color="#c8453c" />
      </mesh>
      <mesh position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.8, 20]} />
        <Mat color="#c8453c" />
      </mesh>
      {/* 지붕에 쌓인 눈 */}
      <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]}>
        <cylinderGeometry args={[0.3, 0.3, 0.86, 20]} />
        <Mat color="#ffffff" />
      </mesh>
      {/* 편지 넣는 구멍 */}
      <mesh position={[0, 1.04, 0.405]}>
        <boxGeometry args={[0.34, 0.05, 0.02]} />
        <meshBasicMaterial color="#3a2a2a" />
      </mesh>
      {/* 앞에 건 리스 */}
      <Kit name="wreath-decorated" position={[0, 0.72, 0.42]} scale={0.55} />
      {/* 깃발: 편지를 넣으면 위로 섭니다 */}
      <group position={[0.3, 1.0, 0.1]} rotation={[sent ? 0 : -Math.PI / 2, 0, 0]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.04, 0.4, 0.05]} />
          <Mat color="#f2c14e" />
        </mesh>
        <mesh position={[0, 0.34, 0.09]}>
          <boxGeometry args={[0.04, 0.14, 0.2]} />
          <Mat color="#f2c14e" emissive="#f2c14e" emissiveIntensity={sent ? 0.6 : 0} />
        </mesh>
      </group>
      {/* 옆에 꽂아 둔 지팡이 사탕과 작은 선물 */}
      <Kit name="candy-cane-red" position={[-0.55, 0, 0.15]} rotation={[0, 0.5, 0]} scale={1.1} />
      <Kit name="candy-cane-green" position={[0.6, 0, -0.1]} rotation={[0, -0.6, 0]} scale={1.1} />
      <Kit name="present-a-cube" position={[0.5, 0, 0.5]} rotation={[0, 0.4, 0]} scale={0.8} />
      {sent && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.0, 32]} />
          <meshBasicMaterial color="#ffcf5a" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

/**
 * 지붕 처마(ㅅ자 선)를 따라 다는 알전구 자리. 집 안쪽 좌표(키우기 전)입니다.
 * 지붕 윗면은 가운데(x=0)에서 높이 약 2.34, 양 끝(x=±1.31)에서 약 0.86으로 내려옵니다.
 * 전구는 그 선보다 살짝 아래, 지붕 앞 끝(z≈1.2)보다 살짝 앞에 겁니다.
 */
const ROOF_BULBS: [number, number, number][] = (() => {
  const list: [number, number, number][] = []
  const count = 9 // 한쪽 경사면의 전구 수
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count // 0 = 꼭대기 쪽, 1 = 처마 끝
      const x = side * t * 1.25
      list.push([x, 2.34 - 1.13 * Math.abs(x) - 0.2, 1.24])
    }
  }
  return list
})()

/**
 * 40%에 생기는 집 장식 (집 안쪽 좌표, 앞면 = +z)
 * 집 정면 처마의 전구 줄 + 집 옆에 호두까기 인형 또는 꾸며진 작은 트리(집마다 번갈아)
 */
function HouseDecor({ variant }: { variant: 'doll' | 'tree' }) {
  const style = useStyle()
  return (
    <>
      {ROOF_BULBS.map((p, i) => {
        const color = FESTIVE[i % FESTIVE.length]
        return (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <Mat color={color} emissive={color} emissiveIntensity={Math.max(0.8, style.glow)} />
          </mesh>
        )
      })}
      {variant === 'doll' ? (
        <Kit name="nutcracker" position={[-1.3, 0, 1.3]} rotation={[0, 0.35, 0]} scale={0.7} />
      ) : (
        <Kit name="tree-decorated-snow" position={[1.55, 0, 0.55]} rotation={[0, 0.8, 0]} scale={0.5} />
      )}
    </>
  )
}

/** 주민 한 명의 집 + 집 앞 우체통. lit: 이 주민에게 편지를 넣었는지 */
function Home({ resident, lit, decorated, variant }: { resident: Resident; lit: boolean; decorated: boolean; variant: 'doll' | 'tree' }) {
  const style = useStyle()
  const tree = mailboxPos(resident)

  return (
    <>
      <group position={[resident.x, 0, resident.z]} rotation={[0, houseRotation(resident), 0]} scale={HOUSE_SCALE}>
        {HOUSE_PIECES.map((p, i) => (
          <Kit
            key={i}
            name={p.name}
            position={[p.x, p.y ?? 0, p.z]}
            rotation={[0, p.rot ?? 0, 0]}
            scale={[p.flip ? -1 : 1, 1, p.depth ?? 1]}
          />
        ))}
        {style.night && <pointLight position={[0, 1, 1.9]} color="#ffc98a" intensity={5} distance={5} />}
        {/* 이름표: 3D 위에 띄우는 일반 글자입니다 */}
        <Html position={[0, 2.85, 0]} center zIndexRange={[5, 0]}>
          <span className="tag">{resident.name}</span>
        </Html>
      </group>

      {/* 40%: 집 장식. 이름표와 다른 묶음에 두고 따로 기다려서, 장식을 불러오는 동안 이름표가 흔들리지 않게 합니다 */}
      {decorated && (
        <Suspense fallback={null}>
          <group position={[resident.x, 0, resident.z]} rotation={[0, houseRotation(resident), 0]} scale={HOUSE_SCALE}>
            <HouseDecor variant={variant} />
          </group>
        </Suspense>
      )}

      {/* 집 앞 우체통 (광장 쪽을 바라봅니다) */}
      <group position={[tree.x, 0, tree.z]} rotation={[0, houseRotation(resident), 0]}>
        <Mailbox sent={lit} />
        {lit && style.night && <pointLight position={[0, 1, 0.4]} color="#ffd38a" intensity={4} distance={4} />}
      </group>
    </>
  )
}

/** 주민 전체. sent: 누구에게 편지를 걸었는지 / level: 진행률 단계(0~10) */
export function Homes({ sent, level }: { sent: Record<string, boolean>; level: number }) {
  return (
    <>
      {RESIDENTS.map((r, i) => (
        <Home key={r.id} resident={r} lit={!!sent[r.id]} decorated={level >= UNLOCK.houseDecor} variant={i % 2 === 0 ? 'doll' : 'tree'} />
      ))}
    </>
  )
}

// ───────── 가로등 ─────────

/** 광장 둘레의 가로등 */
export function Lamps() {
  const style = useStyle()
  return (
    <>
      {LAMPS.map((l) => (
        <group key={`${l.x},${l.z}`} position={[l.x, 0, l.z]}>
          <Kit name="lantern" scale={1.25} />
          {style.night && <pointLight position={[0, 2.0, 0]} color="#ffd9a0" intensity={9} distance={7} />}
        </group>
      ))}
    </>
  )
}

// ───────── 크리스마스 장식 ─────────

/** 대왕 트리 아래 선물 상자들: [모델 이름, x, z, 돌린 각도] (트리 기준 위치) */
export const GIFTS: [string, number, number, number][] = [
  // 10%마다 위에서부터 1개씩 놓입니다 (카메라에 잘 보이는 앞쪽부터)
  ['present-b-round', 0.4, 3.4, 0.7],
  ['present-a-rectangle', -1.3, 3.3, -0.3],
  ['present-b-rectangle', 2.5, 2.5, -0.5],
  ['present-a-cube', -2.7, 2.3, 0.4],
  ['present-a-round', 1.6, 3.1, 0.9],
  ['present-a-round', 3.3, 1.2, 0.2],
  ['present-b-cube', -3.4, 1.0, 1.1],
  ['present-b-cube', 3.6, -0.6, -0.8],
  ['present-a-cube', -3.6, -0.7, 0.3],
  ['present-b-rectangle', -1.9, 1.9, 0.6],
]

/** 눈밭 여기저기의 눈 더미: [x, z, 크기] */
export const SNOW_PILES: [number, number, number][] = [
  [-7.6, 2.6, 2.2],
  [7.8, 2.4, 2.0],
  [-1.6, 8.4, 2.6],
  [3.4, 9.6, 2.0],
  [-9.5, -5.2, 2.4],
  [9.8, -5.6, 2.2],
  [0.4, -8.6, 2.6],
]

/** 가로등과 가로등 사이에 늘어뜨린 알전구 줄의 전구 위치들 */
export const STRING_LIGHTS: [number, number, number][] = (() => {
  // 가로등 6개를 한 바퀴 돌며 잇습니다: 왼쪽 → 앞 왼쪽 → 앞 오른쪽 → 오른쪽 → 뒤 오른쪽 → 뒤 왼쪽 → 다시 왼쪽
  const order = [LAMPS[0], LAMPS[2], LAMPS[3], LAMPS[1], LAMPS[5], LAMPS[4], LAMPS[0]]
  const bulbs: [number, number, number][] = []
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i]
    const b = order[i + 1]
    const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.38)
    for (let k = 1; k < count; k++) {
      const t = k / count
      // 4t(1-t): 가운데에서 가장 크게 처지는 곡선 (줄이 늘어진 모양)
      bulbs.push([a.x + (b.x - a.x) * t, 2.0 - 0.55 * 4 * t * (1 - t), a.z + (b.z - a.z) * t])
    }
  }
  return bulbs
})()

/** 산타 인형: 빨간 옷, 흰 수염, 뾰족 모자. 도형을 쌓아 장난감처럼 만듭니다 */
function Santa({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const ref = useRef<THREE.Group>(null!)
  usePopIn(ref)
  const red = '#c8453c'
  return (
    <group ref={ref} position={position} rotation={[0, rotation, 0]} scale={0.001}>
      <group scale={1.25}>
        {/* 장화 */}
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.13, 0.08, 0.04]} castShadow>
            <boxGeometry args={[0.18, 0.16, 0.28]} />
            <Mat color="#2b2b33" />
          </mesh>
        ))}
        {/* 몸통 + 아래 흰 털 */}
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.27, 0.34, 0.6, 20]} />
          <Mat color={red} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.08, 20]} />
          <Mat color="#fbf8f2" />
        </mesh>
        {/* 허리띠 + 금색 버클 */}
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.315, 0.315, 0.08, 20]} />
          <Mat color="#2b2b33" />
        </mesh>
        <mesh position={[0, 0.42, 0.31]}>
          <boxGeometry args={[0.12, 0.1, 0.03]} />
          <Mat color="#f2c14e" />
        </mesh>
        {/* 팔 + 장갑 */}
        {[-1, 1].map((sd) => (
          <group key={sd}>
            <mesh position={[sd * 0.33, 0.55, 0.02]} rotation={[0, 0, sd * 0.5]} castShadow>
              <capsuleGeometry args={[0.08, 0.22, 4, 10]} />
              <Mat color={red} />
            </mesh>
            <mesh position={[sd * 0.42, 0.4, 0.03]}>
              <sphereGeometry args={[0.08, 12, 10]} />
              <Mat color="#2b2b33" />
            </mesh>
          </group>
        ))}
        {/* 얼굴 */}
        <mesh position={[0, 0.92, 0]} castShadow>
          <sphereGeometry args={[0.22, 20, 16]} />
          <Mat color="#f2c8ac" />
        </mesh>
        {/* 수염 */}
        <mesh position={[0, 0.8, 0.1]} scale={[1, 1.1, 0.7]}>
          <sphereGeometry args={[0.2, 18, 14]} />
          <Mat color="#fbf8f2" />
        </mesh>
        {/* 코 + 눈 */}
        <mesh position={[0, 0.93, 0.21]}>
          <sphereGeometry args={[0.04, 10, 8]} />
          <Mat color="#e69a8a" />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.08, 1.0, 0.19]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <Mat color="#2b211d" />
          </mesh>
        ))}
        {/* 모자: 흰 테두리 + 빨간 고깔 + 흰 방울 */}
        <mesh position={[0, 1.08, 0]}>
          <torusGeometry args={[0.2, 0.06, 10, 24]} />
          <Mat color="#fbf8f2" />
        </mesh>
        <mesh position={[0.04, 1.3, -0.02]} rotation={[0, 0, -0.3]} castShadow>
          <coneGeometry args={[0.2, 0.45, 20]} />
          <Mat color={red} />
        </mesh>
        <mesh position={[0.13, 1.5, -0.03]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <Mat color="#fbf8f2" />
        </mesh>
      </group>
    </group>
  )
}

/** 마을 곳곳의 크리스마스 장식. level: 진행률 단계(0~10) */
export function ChristmasDecor({ level }: { level: number }) {
  const style = useStyle()
  return (
    <>
      {/* 대왕 트리 아래 선물 상자 */}
      <group position={[TREE_POS.x, 0, TREE_POS.z]}>
        {GIFTS.slice(0, giftCount(level)).map(([name, x, z, rot]) => (
          <Kit key={`${x},${z}`} name={name} position={[x, 0, z]} rotation={[0, rot, 0]} scale={1.7} />
        ))}
      </group>

      {/* 광장의 눈사람, 순록, 썰매 */}
      <Kit name="snowman-hat" position={[SNOWMAN.x, 0, SNOWMAN.z]} rotation={[0, 0.7, 0]} scale={1.35} />
      {/* 80%: 산타 & 루돌프 인형 */}
      {level >= UNLOCK.santa && (
        <>
          <Kit name="reindeer" position={[REINDEER.x, 0, REINDEER.z]} rotation={[0, -0.7, 0]} scale={1.3} />
          <Santa position={[REINDEER.x - 1.0, 0, REINDEER.z + 0.9]} rotation={-0.4} />
        </>
      )}
      <Kit name="sled" position={[SLED.x, 0, SLED.z]} rotation={[0, -1.2, 0]} scale={1.3} />

      {/* 눈밭 여기저기의 눈 더미 */}
      {SNOW_PILES.map(([x, z, size]) => (
        <Kit key={`${x},${z}`} name="snow-pile" position={[x, 0, z]} rotation={[0, x, 0]} scale={size * 0.7} />
      ))}

      {/* 가로등 사이에 늘어뜨린 알전구 줄 */}
      {level >= UNLOCK.stringLights && STRING_LIGHTS.map((p, i) => {
        const color = FESTIVE[i % FESTIVE.length]
        return (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <Mat color={color} emissive={color} emissiveIntensity={style.glow * 0.7} />
          </mesh>
        )
      })}
    </>
  )
}

// ───────── 편지가 날아가는 연출 ─────────

/** 대왕 트리의 몇 번째 장식 자리가 실제로 어디인지 알려 줍니다 */
export function ornamentPosition(index: number): [number, number, number] {
  const [x, y, z] = ORNAMENT_SLOTS[index % ORNAMENT_SLOTS.length]
  return [TREE_POS.x + x, y, TREE_POS.z + z]
}

/** 편지가 날아가는 데 걸리는 시간(초)과, 도착한 뒤 반짝임이 퍼지는 시간(초) */
const FLIGHT_SECONDS = 1.4
const BURST_SECONDS = 0.6

type FlyingLetterProps = {
  /** 출발 위치 (친구 집 앞 우체통) */
  from: [number, number, number]
  /** 도착 위치 (대왕 트리의 장식 자리) */
  to: [number, number, number]
  /** 도착한 순간 한 번 불립니다 (이때 장식이 생깁니다) */
  onArrive: () => void
  /** 반짝임까지 다 끝나면 불립니다 (이때 화면에서 치웁니다) */
  onDone: () => void
}

/** 편지 봉투가 포물선을 그리며 대왕 트리로 날아가고, 닿는 순간 빛이 퍼집니다. */
export function FlyingLetter({ from, to, onArrive, onDone }: FlyingLetterProps) {
  const envelope = useRef<THREE.Group>(null!)
  const burst = useRef<THREE.Mesh>(null!)
  const time = useRef(0)
  const arrived = useRef(false)
  const finished = useRef(false)

  useFrame(({ camera }, delta) => {
    time.current += delta
    const t = Math.min(1, time.current / FLIGHT_SECONDS)

    if (t < 1) {
      // 처음엔 천천히, 중간에 빠르게, 끝에 다시 천천히 움직이게 하는 곡선
      const e = t * t * (3 - 2 * t)
      envelope.current.position.set(
        from[0] + (to[0] - from[0]) * e,
        // 직선으로 가는 높이에 포물선(가운데가 가장 높음)을 더합니다
        from[1] + (to[1] - from[1]) * e + Math.sin(Math.PI * e) * 3.2,
        from[2] + (to[2] - from[2]) * e,
      )
      // 항상 카메라를 바라보게 하고, 날아가는 동안 살짝 까딱거립니다
      envelope.current.quaternion.copy(camera.quaternion)
      envelope.current.rotateZ(Math.sin(time.current * 9) * 0.25)
      // 출발할 때 커지고, 도착 직전에 작아지면서 장식 속으로 빨려 들어갑니다
      envelope.current.scale.setScalar(Math.min(1, t * 6) * (t > 0.85 ? (1 - t) / 0.15 : 1) + 0.001)
      return
    }

    if (!arrived.current) {
      arrived.current = true
      envelope.current.visible = false
      onArrive()
    }

    // 도착: 고리 모양의 빛이 퍼지면서 사라집니다
    const b = Math.min(1, (time.current - FLIGHT_SECONDS) / BURST_SECONDS)
    burst.current.visible = true
    burst.current.quaternion.copy(camera.quaternion)
    burst.current.scale.setScalar(0.3 + b * 2.2)
    ;(burst.current.material as THREE.MeshBasicMaterial).opacity = (1 - b) * 0.9
    if (b >= 1 && !finished.current) {
      finished.current = true
      onDone()
    }
  })

  return (
    <>
      <group ref={envelope} position={from} scale={0.001}>
        {/* 봉투 몸통 */}
        <mesh>
          <planeGeometry args={[0.78, 0.54]} />
          <meshBasicMaterial color="#fff8ea" />
        </mesh>
        {/* 봉투 덮개 (세모) */}
        <mesh position={[0, 0.27, 0.01]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.39, 0.3, 3]} />
          <meshBasicMaterial color="#efdcbb" />
        </mesh>
        {/* 빨간 봉인 */}
        <mesh position={[0, -0.02, 0.02]}>
          <circleGeometry args={[0.09, 20]} />
          <meshBasicMaterial color="#d6453c" />
        </mesh>
      </group>
      <mesh ref={burst} position={to} visible={false}>
        <ringGeometry args={[0.32, 0.42, 40]} />
        <meshBasicMaterial color="#ffd66b" transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  )
}

// ───────── 눈 ─────────

/** 마을 안에만 내리는 눈 */
export function VillageSnow({ count = 700 }: { count?: number }) {
  const points = useRef<THREE.Points>(null!)
  const style = useStyle()

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // 원 안의 무작위 위치
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * (ISLAND_RADIUS + 4)
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.random() * 6
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [count])

  useFrame((_, delta) => {
    const attr = points.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= delta * (0.5 + (i % 5) * 0.1)
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 6
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color={style.lightBackground ? '#ffffff' : '#e8eeff'}
        size={0.08}
        transparent
        opacity={style.lightBackground ? 0.75 : 0.9}
      />
    </points>
  )
}

// 이 화면에서 쓰는 모델을 미리 받아 둡니다
preloadKit([
  ...FOREST_MODELS,
  ...HOUSE_PIECES.map((p) => p.name),
  ...GIFTS.map(([name]) => name),
  'wreath-decorated',
  'nutcracker',
  'tree-decorated-snow',
  'candy-cane-red',
  'candy-cane-green',
  'lantern',
  'snowman-hat',
  'reindeer',
  'sled',
  'snow-pile',
])
