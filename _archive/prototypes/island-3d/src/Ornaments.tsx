import { useRef } from 'react'
import * as THREE from 'three'
import { useStyle } from './styles'
import { toonGradient } from './toon'
import { usePopIn } from './Village'
import type { OrnamentKind } from './decorPlan'

// 대왕 트리에 걸리는 장식들을 그리는 파일입니다. 어느 단계에 무엇을 거는지는 decorPlan.ts 에 있습니다.
// 모든 장식은 앞면(+z)이 바깥을 보도록 만들고, 트리에 걸 때 바깥 방향으로 돌려 줍니다.
// look: 'toy' = 미니어처·빛 그림체(무광 장난감 느낌) / 'real' = 사실적·노을 그림체(반짝이는 유리·금속)

type Look = 'toy' | 'real'

type Kind = OrnamentKind

const GOLD = '#d9b04a'
const CREAM = '#f4ead6'
const WHITE = '#fbf8f2'

// ───────── 재료 ─────────

/**
 * 장식용 재료. shiny 는 유리·금속처럼 반짝이는 부분인지입니다.
 * 미니어처는 그림체의 칠 방식(만화풍/일반)을 따르고, 사실적 그림체는 반짝이는 재질을 씁니다.
 */
function OMat({ color, look, shiny = false, vertexColors = false }: { color: string; look: Look; shiny?: boolean; vertexColors?: boolean }) {
  const style = useStyle()
  // "빛" 그림체에서는 장식 자체가 빛납니다 (편지 = 빛)
  // 밤에는 장식이 은은하게 빛나서 어둠 속에서도 보입니다 (예전 '빛' 그림체는 더 강하게)
  const glow = style.night ? { emissive: color, emissiveIntensity: style.id === 'light' ? 1.2 : 0.35 } : {}
  if (look === 'real') {
    return (
      <meshStandardMaterial
        color={color}
        metalness={shiny ? 0.75 : 0.05}
        roughness={shiny ? 0.16 : 0.55}
        envMapIntensity={shiny ? 1.6 : 1}
        vertexColors={vertexColors}
      />
    )
  }
  if (style.material === 'toon') return <meshToonMaterial gradientMap={toonGradient} color={color} vertexColors={vertexColors} {...glow} />
  return <meshStandardMaterial color={color} roughness={shiny ? 0.35 : 0.8} vertexColors={vertexColors} {...glow} />
}

// ───────── 모양(한 번만 만들어 두고 재사용) ─────────

/** 다섯 꼭짓점 별 */
const starGeo = (() => {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.32 : 0.14
    const a = Math.PI / 2 + (i * Math.PI) / 5
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 })
  g.center()
  return g
})()

/** 하트 (뾰족한 끝이 아래) */
const heartGeo = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, -0.28)
  s.bezierCurveTo(-0.05, -0.18, -0.32, -0.08, -0.3, 0.08)
  s.bezierCurveTo(-0.28, 0.26, -0.06, 0.3, 0, 0.14)
  s.bezierCurveTo(0.06, 0.3, 0.28, 0.26, 0.3, 0.08)
  s.bezierCurveTo(0.32, -0.08, 0.05, -0.18, 0, -0.28)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.05, bevelSegments: 4, curveSegments: 24 })
  g.center()
  return g
})()

/**
 * 종: 옆모습 선을 빙 돌려서 만듭니다.
 * 선은 반드시 아래 → 위 순서로 적어야 면의 앞쪽이 바깥을 봅니다.
 * (위 → 아래로 적으면 면이 뒤집혀 겉면이 그려지지 않고, 뒤의 나무가 비쳐 보입니다)
 */
const bellGeo = new THREE.LatheGeometry(
  [
    [0, -0.21], [0.29, -0.23], [0.29, -0.2], [0.23, -0.15], [0.17, -0.06], [0.14, 0.08], [0.12, 0.18], [0.07, 0.23], [0, 0.24],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
  32,
)

/** 물방울 구슬: 위는 뾰족하고 아래는 통통한 유리 장식 */
const dropGeo = new THREE.LatheGeometry(
  Array.from({ length: 24 }, (_, i) => {
    const t = i / 23 // 0 = 아래 끝, 1 = 위 끝
    const r = 0.21 * Math.sin(Math.PI * t) ** 0.9 * (1 - 0.55 * t)
    return new THREE.Vector2(Math.max(r, 0.0001), -0.26 + t * 0.6)
  }),
  32,
)

/** 지팡이 사탕: 관 모양에 빨강·흰색 사선 줄무늬를 꼭짓점 색으로 칠합니다 */
const candyGeo = (() => {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.04, -0.32, 0),
    new THREE.Vector3(0.04, 0.08, 0),
    new THREE.Vector3(0.0, 0.2, 0),
    new THREE.Vector3(-0.09, 0.27, 0),
    new THREE.Vector3(-0.18, 0.21, 0),
    new THREE.Vector3(-0.2, 0.12, 0),
  ])
  const tubular = 64
  const radial = 16
  const g = new THREE.TubeGeometry(path, tubular, 0.05, radial, false)
  const red = new THREE.Color('#d23a35')
  const white = new THREE.Color(WHITE)
  const colors: number[] = []
  const count = g.attributes.position.count
  for (let i = 0; i < count; i++) {
    const along = Math.floor(i / (radial + 1)) // 관을 따라 몇 번째 고리인지
    const around = (i % (radial + 1)) / radial // 고리 둘레 위치(0~1)
    const stripe = Math.floor(along / 4 + around * 2) % 2 // 비스듬한 줄무늬
    const c = stripe === 0 ? red : white
    colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return g
})()

/** 편지 봉투 덮개(아래를 향한 삼각형) */
const flapGeo = (() => {
  const s = new THREE.Shape()
  s.moveTo(-0.25, 0.17)
  s.lineTo(0.25, 0.17)
  s.lineTo(0, -0.04)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false })
})()

// ───────── 장식 10종 ─────────

function Hook({ y, look }: { y: number; look: Look }) {
  return (
    <mesh position={[0, y, 0]}>
      <cylinderGeometry args={[0.06, 0.07, 0.08, 16]} />
      <OMat color={GOLD} look={look} shiny />
    </mesh>
  )
}

function Shape({ kind, color, look }: { kind: Kind; color: string; look: Look }) {
  switch (kind) {
    case 'ball':
      return (
        <group>
          <mesh castShadow>
            <sphereGeometry args={[0.28, 32, 24]} />
            <OMat color={color} look={look} shiny />
          </mesh>
          <Hook y={0.29} look={look} />
        </group>
      )
    case 'envelope':
      return (
        <group rotation={[0, 0, 0.12]}>
          <mesh castShadow>
            <boxGeometry args={[0.52, 0.36, 0.05]} />
            <OMat color={CREAM} look={look} />
          </mesh>
          <mesh geometry={flapGeo} position={[0, 0.01, 0.026]}>
            <OMat color="#e6d7b8" look={look} />
          </mesh>
          {/* 봉인 스티커 */}
          <mesh position={[0, -0.02, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.02, 24]} />
            <OMat color={color} look={look} shiny />
          </mesh>
        </group>
      )
    case 'star':
      return (
        <mesh geometry={starGeo} castShadow>
          <OMat color={GOLD} look={look} shiny />
        </mesh>
      )
    case 'bell':
      return (
        <group>
          <mesh geometry={bellGeo} castShadow>
            <OMat color={color} look={look} shiny />
          </mesh>
          {/* 종 안의 추 */}
          <mesh position={[0, -0.25, 0]}>
            <sphereGeometry args={[0.06, 16, 12]} />
            <OMat color={GOLD} look={look} shiny />
          </mesh>
          <Hook y={0.26} look={look} />
        </group>
      )
    case 'heart':
      return (
        <mesh geometry={heartGeo} castShadow>
          <OMat color={color} look={look} shiny={look === 'real'} />
        </mesh>
      )
    case 'gift':
      return (
        <group rotation={[0, 0.5, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.38, 0.38, 0.38]} />
            <OMat color={color} look={look} />
          </mesh>
          {/* 상자를 가로지르는 리본 두 줄 */}
          <mesh>
            <boxGeometry args={[0.08, 0.395, 0.395]} />
            <OMat color={GOLD} look={look} shiny />
          </mesh>
          <mesh>
            <boxGeometry args={[0.395, 0.395, 0.08]} />
            <OMat color={GOLD} look={look} shiny />
          </mesh>
          {/* 나비 매듭 */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.07, 0.24, 0]} rotation={[0, 0, s * 0.6]}>
              <torusGeometry args={[0.06, 0.025, 10, 20]} />
              <OMat color={GOLD} look={look} shiny />
            </mesh>
          ))}
        </group>
      )
    case 'candy':
      return (
        <mesh geometry={candyGeo} castShadow>
          <OMat color="#ffffff" look={look} vertexColors />
        </mesh>
      )
    case 'snowflake':
      return (
        <group>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <group key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
              {/* 가지 하나 + 끝 쪽의 V자 잔가지 */}
              <mesh position={[0, 0.15, 0]}>
                <boxGeometry args={[0.045, 0.3, 0.04]} />
                <OMat color={WHITE} look={look} shiny={look === 'real'} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * 0.04, 0.2, 0]} rotation={[0, 0, -s * 0.8]}>
                  <boxGeometry args={[0.035, 0.11, 0.035]} />
                  <OMat color={WHITE} look={look} shiny={look === 'real'} />
                </mesh>
              ))}
            </group>
          ))}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.05, 6]} />
            <OMat color="#cfe6f5" look={look} shiny />
          </mesh>
        </group>
      )
    case 'drop':
      return (
        <group>
          <mesh geometry={dropGeo} castShadow>
            <OMat color={color} look={look} shiny />
          </mesh>
          <Hook y={0.33} look={look} />
        </group>
      )
    case 'sock':
      return (
        <group rotation={[0, 0, -0.12]}>
          {/* 다리 부분 */}
          <mesh position={[0, 0.02, 0]} castShadow>
            <boxGeometry args={[0.17, 0.32, 0.11]} />
            <OMat color={color} look={look} />
          </mesh>
          {/* 발 부분 (앞으로 튀어나온 발끝) */}
          <mesh position={[0.06, -0.17, 0]} castShadow>
            <boxGeometry args={[0.29, 0.14, 0.11]} />
            <OMat color={color} look={look} />
          </mesh>
          {/* 발뒤꿈치·발끝의 흰 덧댐 */}
          <mesh position={[0.19, -0.17, 0]}>
            <boxGeometry args={[0.06, 0.145, 0.115]} />
            <OMat color={WHITE} look={look} />
          </mesh>
          {/* 위쪽 흰 털 장식 */}
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.23, 0.1, 0.14]} />
            <OMat color={WHITE} look={look} />
          </mesh>
          {/* 거는 고리 */}
          <mesh position={[-0.07, 0.3, 0]}>
            <torusGeometry args={[0.035, 0.012, 8, 16]} />
            <OMat color={GOLD} look={look} shiny />
          </mesh>
        </group>
      )
    case 'cookie': {
      const dough = '#b9773f'
      return (
        <group scale={[1, 1, 0.45]}>
          <mesh position={[0, 0.19, 0]} castShadow>
            <sphereGeometry args={[0.11, 24, 16]} />
            <OMat color={dough} look={look} />
          </mesh>
          <mesh position={[0, -0.03, 0]} scale={[0.13, 0.15, 0.1]} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
            <OMat color={dough} look={look} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              {/* 팔 */}
              <mesh position={[s * 0.15, 0.04, 0]} rotation={[0, 0, s * 0.35]} scale={[0.11, 0.05, 0.08]}>
                <sphereGeometry args={[1, 16, 12]} />
                <OMat color={dough} look={look} />
              </mesh>
              {/* 다리 */}
              <mesh position={[s * 0.08, -0.19, 0]} rotation={[0, 0, s * 0.25]} scale={[0.055, 0.1, 0.08]}>
                <sphereGeometry args={[1, 16, 12]} />
                <OMat color={dough} look={look} />
              </mesh>
              {/* 아이싱 눈 */}
              <mesh position={[s * 0.04, 0.21, 0.1]}>
                <sphereGeometry args={[0.018, 10, 8]} />
                <OMat color={WHITE} look={look} />
              </mesh>
            </group>
          ))}
          {/* 아이싱 단추 */}
          {[0.03, -0.06].map((y) => (
            <mesh key={y} position={[0, y, 0.1]}>
              <sphereGeometry args={[0.022, 10, 8]} />
              <OMat color={y > 0 ? '#d23a35' : '#3f9a6b'} look={look} />
            </mesh>
          ))}
        </group>
      )
    }
  }
}

/**
 * 대왕 트리에 걸린 장식 하나. kind: 모양 / color: 주 색
 * 처음 나타날 때 "통" 하고 튀어나오고, 앞면이 트리 바깥쪽을 보도록 돌려서 겁니다.
 */
export function TreeOrnament({ position, kind, color, look }: { position: [number, number, number]; kind: Kind; color: string; look: Look }) {
  const group = useRef<THREE.Group>(null!)
  usePopIn(group)
  // 트리 바깥 방향으로 다 돌리면 옆면의 납작한 장식(봉투·별 등)이 선처럼 얇게 보이므로,
  // 바깥 방향의 35%만 돌려서 앞(카메라 쪽)도 함께 보게 합니다
  const facing = Math.atan2(position[0], position[2]) * 0.35
  return (
    <group ref={group} position={position} rotation={[0, facing, 0]} scale={0.001}>
      <group scale={look === 'toy' ? 1.15 : 1}>
        <Shape kind={kind} color={color} look={look} />
      </group>
    </group>
  )
}
