import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { useStyle } from '../styles'
import type { StyleDef } from '../styles'
import { LAMPS, REINDEER, RESIDENTS, SLED, SNOWMAN, houseRotation, mailboxPos } from '../residents'
import type { Resident } from '../residents'
import { ISLAND_RADIUS, TREE_POS } from '../world'
import { FOREST, GIFTS, ORNAMENT_SLOTS, SNOW_PILES, STRING_LIGHTS } from '../Village'
import { Atmosphere, Smoke } from './Atmosphere'
import { TreeOrnament } from '../Ornaments'
import { TREE_ORNAMENT_PLAN } from '../decorPlan'
import { buildFir, firCoreMaterial, firMaterial } from './fir'
import { MOODS } from './mood'
import type { Mood } from './mood'
import { canvasTexture, mapUV, preloadPbr, seeded, smoothNoise, usePbr } from './textures'

// 사실적인 마을을 그리는 파일입니다.
// 미니어처·빛 그림체는 블록 모델(Kenney)을 조립하지만,
// 여기서는 모든 모양을 코드로 직접 만들고 실사 텍스처를 입힙니다.
// 위치(집, 우체통, 가로등, 장애물)는 미니어처와 똑같아서 걷기·편지 넣기는 그대로 동작합니다.

// ───────── 공통 도구 ─────────

const UP = new THREE.Vector3(0, 1, 0)

/** 위치·회전(y축)·크기로 "변환 행렬"을 만듭니다. 같은 모양을 여러 곳에 찍어 낼 때 씁니다. */
function place(x: number, y: number, z: number, rotY = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(UP, rotY),
    new THREE.Vector3(sx, sy, sz),
  )
}

/**
 * 같은 모양을 여러 개 한 번에 그립니다 (InstancedMesh).
 * 울타리 기둥 60개를 60번 따로 그리는 대신 한 번에 그려서 훨씬 빠릅니다.
 */
function Instanced({ geometry, material, matrices, shadow = true }: {
  geometry: THREE.BufferGeometry
  material: THREE.Material | THREE.Material[]
  matrices: THREE.Matrix4[]
  shadow?: boolean
}) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, matrices.length)
    matrices.forEach((matrix, i) => m.setMatrixAt(i, matrix))
    m.instanceMatrix.needsUpdate = true
    m.castShadow = shadow
    m.receiveShadow = true
    m.computeBoundingSphere()
    return m
  }, [geometry, material, matrices, shadow])
  return <primitive object={mesh} />
}

/** 표면이 살짝 울퉁불퉁한 공 (눈 더미, 눈사람). 진짜 눈처럼 완벽한 공이 아니게 만듭니다. */
function lumpySphere(seed: number, amount = 0.06) {
  const g = new THREE.SphereGeometry(1, 40, 28)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const bump = smoothNoise(v.x * 30 + seed, v.z * 30 + v.y * 20) * amount
    v.multiplyScalar(1 + bump)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return mapUV(g, 0.8)
}

/** 모서리가 둥근 상자. 쌓인 눈은 각지지 않고 둥글게 뭉쳐 있어서 이걸로 만듭니다. */
function roundedBox(w: number, h: number, d: number, radius: number, tile = 1.5) {
  return mapUV(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, h / 2 - 0.001)), tile)
}

function box(w: number, h: number, d: number, tile = 1.5) {
  return mapUV(new THREE.BoxGeometry(w, h, d), tile)
}

// ───────── 재료 ─────────

/**
 * 마을 전체에서 같이 쓰는 재료들을 한 번에 만듭니다.
 * 재료를 물체마다 새로 만들면 느려지기 때문에, 미리 만들어 두고 나눠 씁니다.
 */
function useMaterials(mood: Mood, style: StyleDef) {
  const snow = usePbr('snow_02', 0.7)
  const planks = usePbr('white_planks_clean')
  const stone = usePbr('stacked_stone_wall')
  const bark = usePbr('pine_bark')
  const weathered = usePbr('weathered_brown_planks')
  const dark = usePbr('dark_planks')

  return useMemo(() => {
    const std = (params: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(params)
    return {
      // 눈: 색 사진은 회색 얼룩이 있어서 빼고, 하얀 바탕에 요철과 거칠기만 입힙니다
      snow: std({ color: '#ffffff', normalMap: snow.normalMap, normalScale: snow.normalScale, roughnessMap: snow.roughnessMap, roughness: 1 }),
      stone: std({ ...stone, color: '#d6d0c8' }),
      bark: std({ ...bark }),
      wood: std({ ...weathered }),
      roofWood: std({ ...dark, color: '#8a7a6c' }),
      trim: std({ color: '#efeae0', roughness: 0.65 }),
      metal: std({ color: '#1c2024', roughness: 0.42, metalness: 0.65 }),
      brass: std({ color: '#c9a04a', roughness: 0.3, metalness: 1 }),
      // 집마다 다른 색으로 칠한 나무 벽
      walls: style.colors.walls.map((color) => std({ ...planks, color })),
      door: std({ ...dark, color: '#55606a' }),
      // 고드름: 거의 투명한 얼음
      ice: std({ color: '#e6f3ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75, envMapIntensity: 1.8 }),
      // 창문 유리: 낮에는 하늘이 비치는 어두운 유리, 노을에는 안쪽 불빛이 새어 나옵니다
      glass: std({
        map: windowInterior,
        emissiveMap: windowInterior,
        emissive: style.colors.window,
        emissiveIntensity: mood.windowGlow,
        roughness: 0.06,
        metalness: 0.2,
        envMapIntensity: 1.4,
      }),
      // 가로등·전구 불빛
      bulb: std({ color: '#fff1d6', emissive: '#ffc77a', emissiveIntensity: mood.lampGlow, roughness: 0.3 }),
      lampGlass: std({ color: '#f6efe0', emissive: '#ffc77a', emissiveIntensity: mood.lampGlow * 0.8, roughness: 0.1, transparent: true, opacity: 0.9 }),
    }
  }, [snow, planks, stone, bark, weathered, dark, mood, style])
}

type Materials = ReturnType<typeof useMaterials>

/** 창문 안쪽 모습: 양옆에 커튼, 가운데는 따뜻한 방 안 (불을 켜면 이 그림이 빛납니다) */
const windowInterior = canvasTexture(64, (ctx, size) => {
  const room = ctx.createLinearGradient(0, size, 0, 0)
  room.addColorStop(0, '#6b4a2c')
  room.addColorStop(0.6, '#3c2c22')
  room.addColorStop(1, '#241c18')
  ctx.fillStyle = room
  ctx.fillRect(0, 0, size, size)
  // 커튼
  ctx.fillStyle = '#d8c7a8'
  ctx.fillRect(0, 0, size * 0.2, size)
  ctx.fillRect(size * 0.8, 0, size * 0.2, size)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  for (let x = 2; x < size * 0.2; x += 4) ctx.fillRect(x, 0, 1, size)
  for (let x = size * 0.8 + 2; x < size; x += 4) ctx.fillRect(x, 0, 1, size)
})

// ───────── 땅 ─────────

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 마을 바깥은 완만한 눈 언덕이 됩니다. (x, z) 위치의 땅 높이를 알려 줍니다. */
function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z)
  const k = smoothstep(ISLAND_RADIUS + 1, ISLAND_RADIUS + 16, r)
  return k * (1.6 + smoothNoise(x, z) * 1.6 + (r - ISLAND_RADIUS) * 0.05)
}

const groundGeometry = (() => {
  const g = new THREE.PlaneGeometry(340, 340, 170, 170)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)))
  g.computeVertexNormals()
  return mapUV(g, 2.6)
})()

/** 눈 덮인 땅과 바깥의 언덕 */
function Ground({ m }: { m: Materials }) {
  return <mesh geometry={groundGeometry} material={m.snow} receiveShadow />
}

// ───────── 광장과 길 ─────────

/** 가장자리가 들쭉날쭉하게 사라지는 무늬 (눈을 치운 자리 경계). radial: 동그라미 / 아니면 긴 띠 */
function clearedMask(radial: boolean) {
  return canvasTexture(256, (ctx, size) => {
    const rand = seeded(radial ? 1 : 2)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)
    ctx.filter = 'blur(6px)'
    ctx.fillStyle = '#fff'
    if (radial) {
      ctx.beginPath()
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2
        const r = size * (0.4 + rand() * 0.04)
        ctx.lineTo(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r)
      }
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(size * 0.22, size)
      for (let i = 0; i <= 16; i++) ctx.lineTo(size * (0.2 + rand() * 0.06), size * (1 - i / 16))
      for (let i = 16; i >= 0; i--) ctx.lineTo(size * (0.74 + rand() * 0.06), size * (1 - i / 16))
      ctx.fill()
    }
    // 눈을 치운 자리에도 군데군데 눈이 남아 있습니다
    ctx.filter = 'blur(4px)'
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    for (let i = 0; i < 40; i++) {
      ctx.beginPath()
      ctx.ellipse(rand() * size, rand() * size, 4 + rand() * 12, 3 + rand() * 8, rand() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

/**
 * 눈을 치워 돌바닥이 드러난 광장과, 광장에서 각 집 문 앞까지 이어지는 길.
 * 돌 무늬는 실제 크기(uv)로, 가장자리 투명도는 모양 전체 기준(uv1)으로 따로 붙입니다.
 */
function Plaza() {
  const cobble = usePbr('cobblestone_floor_04')
  const parts = useMemo(() => {
    const make = (radial: boolean) => {
      const alphaMap = clearedMask(radial)
      alphaMap.colorSpace = THREE.NoColorSpace
      alphaMap.channel = 1 // 두 번째 무늬 좌표(uv1)를 쓴다는 뜻
      return new THREE.MeshStandardMaterial({
        ...cobble,
        color: '#cdc6bd',
        alphaMap,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    }
    const withUv1 = (g: THREE.BufferGeometry) => {
      g.setAttribute('uv1', g.attributes.uv.clone())
      return mapUV(g, 1.6)
    }
    const plaza = withUv1(new THREE.CircleGeometry(6.2, 64).rotateX(-Math.PI / 2))
    // 길: 집 문 앞에서 광장 가장자리까지
    const paths = RESIDENTS.map((r) => {
      const rot = houseRotation(r)
      const dir = { x: Math.sin(rot), z: Math.cos(rot) }
      const start = { x: r.x + dir.x * 1.4, z: r.z + dir.z * 1.4 }
      const length = Math.max(1, Math.hypot(r.x, r.z - 1.5) - 1.4 - 4.2)
      const g = new THREE.PlaneGeometry(1.5, length).rotateX(-Math.PI / 2)
      g.translate(0, 0, -length / 2) // 문 앞에서 광장 쪽(-z)으로 뻗게
      g.rotateY(rot + Math.PI)
      g.translate(start.x, 0, start.z)
      return withUv1(g)
    })
    return { plaza, paths, plazaMat: make(true), pathMat: make(false) }
  }, [cobble])

  return (
    <group position={[0, 0.012, 0]}>
      <mesh geometry={parts.plaza} material={parts.plazaMat} position={[0, 0, 0.6]} receiveShadow />
      {parts.paths.map((g, i) => (
        <mesh key={i} geometry={g} material={parts.pathMat} receiveShadow />
      ))}
    </group>
  )
}

// ───────── 울타리 ─────────

const FENCE_RADIUS = ISLAND_RADIUS - 0.2
const FENCE_POSTS = 64
const FENCE_CHORD = 2 * FENCE_RADIUS * Math.sin(Math.PI / FENCE_POSTS)

const fenceGeo = {
  post: mapUV(new THREE.CylinderGeometry(0.06, 0.075, 1.0, 8).translate(0, 0.5, 0), 0.8),
  postSnow: lumpySphere(4, 0.1).scale(0.09, 0.05, 0.09),
  rail: box(FENCE_CHORD, 0.08, 0.06, 1.2),
  railSnow: roundedBox(FENCE_CHORD, 0.05, 0.09, 0.025),
}

/** 나무 울타리 (기둥 + 가로대 2줄, 위에 눈이 쌓여 있습니다) */
function Fence({ m }: { m: Materials }) {
  const matrices = useMemo(() => {
    const rand = seeded(8)
    const posts: THREE.Matrix4[] = []
    const caps: THREE.Matrix4[] = []
    const rails: THREE.Matrix4[] = []
    const snow: THREE.Matrix4[] = []
    for (let i = 0; i < FENCE_POSTS; i++) {
      const a = (i / FENCE_POSTS) * Math.PI * 2
      const x = Math.cos(a) * FENCE_RADIUS
      const z = Math.sin(a) * FENCE_RADIUS
      const h = 0.9 + rand() * 0.15
      posts.push(place(x, 0, z, rand() * 3, 1, h, 1))
      caps.push(place(x, h, z))
      // 가로대: 이 기둥과 다음 기둥 사이 가운데에, 원을 따라 돌려서 놓습니다
      const mid = a + Math.PI / FENCE_POSTS
      const mx = Math.cos(mid) * FENCE_RADIUS * Math.cos(Math.PI / FENCE_POSTS)
      const mz = Math.sin(mid) * FENCE_RADIUS * Math.cos(Math.PI / FENCE_POSTS)
      for (const y of [0.42, 0.78]) {
        rails.push(place(mx, y, mz, -mid - Math.PI / 2))
        snow.push(place(mx, y + 0.06, mz, -mid - Math.PI / 2))
      }
    }
    return { posts, caps, rails, snow }
  }, [])
  return (
    <>
      <Instanced geometry={fenceGeo.post} material={m.wood} matrices={matrices.posts} />
      <Instanced geometry={fenceGeo.postSnow} material={m.snow} matrices={matrices.caps} />
      <Instanced geometry={fenceGeo.rail} material={m.wood} matrices={matrices.rails} />
      <Instanced geometry={fenceGeo.railSnow} material={m.snow} matrices={matrices.snow} shadow={false} />
    </>
  )
}

// ───────── 숲 ─────────

/** 숲 나무 세 종류 (높이 1 기준으로 만들고, 심을 때 크기를 키웁니다) */
const FOREST_FIRS = [1, 2, 3].map((seed) =>
  buildFir({ height: 1, crownBase: 0.1, gap: 0.05, seed, radiusAt: (y) => 0.27 * (1 - (y - 0.1) / 0.9) + 0.025 }),
)

/** 마을을 둘러싼 숲. 미니어처 그림체와 같은 자리 + 언덕 위의 먼 나무들 */
const FOREST_SPOTS: [number, number, number][] = (() => {
  const rand = seeded(17)
  const far: [number, number, number][] = []
  for (let i = 0; i < 190; i++) {
    const a = rand() * Math.PI * 2
    const r = ISLAND_RADIUS + 10 + rand() * 50
    far.push([Math.cos(a) * r, Math.sin(a) * r, 1])
  }
  return [...FOREST, ...far].filter(([, z]) => z < 9)
})()

function Forest({ m, snow }: { m: Materials; snow: number }) {
  const material = useMemo(() => firMaterial(snow), [snow])
  const groups = useMemo(() => {
    const rand = seeded(23)
    const lists: THREE.Matrix4[][] = [[], [], []]
    FOREST_SPOTS.forEach(([x, z], i) => {
      const height = 5 + rand() * 5
      lists[i % 3].push(place(x, heightAt(x, z) - 0.15, z, rand() * Math.PI * 2, height * (0.9 + rand() * 0.2), height, height))
    })
    return lists
  }, [])
  return (
    <>
      {FOREST_FIRS.map((fir, i) => (
        <group key={i}>
          <Instanced geometry={fir.foliage} material={material} matrices={groups[i]} />
          <Instanced geometry={fir.core} material={firCoreMaterial} matrices={groups[i]} shadow={false} />
          <Instanced geometry={fir.trunk} material={m.bark} matrices={groups[i]} />
        </group>
      ))}
    </>
  )
}

// ───────── 대왕 트리 ─────────

/**
 * 대왕 트리의 가지 길이. 편지 장식이 걸리는 자리(ORNAMENT_SLOTS)가
 * 높이 y 에서 줄기로부터 (2.83 - 0.3y) 만큼 떨어져 있어서, 가지 끝이 그 근처에 오게 맞춥니다.
 */
const bigTreeReach = (y: number) => Math.max(0.08, 2.75 - 0.302 * y)
const BIG_FIR = buildFir({ height: 9.4, crownBase: 0.55, gap: 0.22, density: 1.5, seed: 99, radiusAt: bigTreeReach })

/** 대왕 트리를 빙 둘러 감은 꼬마전구 자리 */
const TREE_BULBS: THREE.Matrix4[] = (() => {
  const list: THREE.Matrix4[] = []
  for (let i = 0; i < 170; i++) {
    const t = i / 170
    const y = 0.9 + t * 7.6
    const a = t * Math.PI * 2 * 7 // 7바퀴 감기
    const r = bigTreeReach(y) - 0.25
    list.push(place(Math.cos(a) * r, y - 0.2, Math.sin(a) * r))
  }
  return list
})()

/** 다섯 꼭짓점 별 모양 */
const starGeometry = (() => {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.42 : 0.18
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 })
  g.center()
  return g
})()

const bulbGeometry = new THREE.SphereGeometry(0.045, 8, 6)

function BigTree({ letters, m, mood }: { letters: number; m: Materials; mood: Mood }) {
  // 대왕 트리는 장식이 잘 보이도록 숲보다 눈을 덜 얹습니다
  const foliage = useMemo(() => firMaterial(mood.branchSnow * 0.2), [mood.branchSnow])
  return (
    <group position={[TREE_POS.x, 0, TREE_POS.z]}>
      <mesh geometry={BIG_FIR.foliage} material={foliage} castShadow receiveShadow />
      <mesh geometry={BIG_FIR.core} material={firCoreMaterial} />
      <mesh geometry={BIG_FIR.trunk} material={m.bark} castShadow />
      <Instanced geometry={bulbGeometry} material={m.bulb} matrices={TREE_BULBS} shadow={false} />
      <mesh geometry={starGeometry} position={[0, 9.55, 0]}>
        <meshStandardMaterial color="#e8c15a" metalness={1} roughness={0.25} emissive="#ffcf6a" emissiveIntensity={mood.lampGlow * 0.5} />
      </mesh>
      {mood.lightsOn && <pointLight position={[0, 4, 3.5]} color="#ffc98a" intensity={30} distance={14} decay={2} />}
      {TREE_ORNAMENT_PLAN.slice(0, letters).map((o, i) => (
        <TreeOrnament key={i} position={ORNAMENT_SLOTS[i]} kind={o.kind} color={o.color} look="real" />
      ))}
    </group>
  )
}

// ───────── 집 ─────────

/*
 * 북유럽 시골집: 돌 기초 위에 페인트칠한 세로 판벽, 박공지붕(ㅅ자 지붕)에 두껍게 쌓인 눈,
 * 처마 끝 고드름, 하얀 창틀, 돌 굴뚝.
 * 앞면(+z)이 광장을 봅니다. 크기 단위는 미터처럼 생각하면 됩니다.
 */
const W = 2.8 // 폭
const D = 2.6 // 깊이
const BASE = 0.3 // 돌 기초 높이
const WALL = 1.8 // 벽 높이
const RISE = 1.3 // 지붕 높이 (벽 위에서 용마루까지)
const EAVE = 0.32 // 옆으로 튀어나온 처마
const GABLE = 0.28 // 앞뒤로 튀어나온 처마
const RIDGE_Y = BASE + WALL + RISE
const PITCH = Math.atan2(RISE, W / 2) // 지붕 기울기
const SLOPE = Math.hypot(W / 2, RISE) + EAVE / Math.cos(PITCH) // 지붕 한쪽 판의 길이
const EAVE_X = SLOPE * Math.cos(PITCH)
const EAVE_Y = RIDGE_Y - SLOPE * Math.sin(PITCH)

const houseGeo = (() => {
  // 벽: 오각형(집 모양)을 앞뒤로 밀어 만든 덩어리
  const shape = new THREE.Shape()
  shape.moveTo(-W / 2, 0)
  shape.lineTo(W / 2, 0)
  shape.lineTo(W / 2, WALL)
  shape.lineTo(0, WALL + RISE)
  shape.lineTo(-W / 2, WALL)
  shape.closePath()
  const walls = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false })
  walls.translate(0, BASE, -D / 2)
  walls.computeVertexNormals()

  // 고드름: 아래로 뾰족한 원뿔 (밑동이 y=0, 끝이 y=-1)
  const icicle = new THREE.ConeGeometry(0.035, 1, 6).rotateX(Math.PI).translate(0, -0.5, 0)

  return {
    walls: mapUV(walls, 2.4),
    foundation: box(W + 0.14, BASE, D + 0.14, 1.2),
    corner: box(0.12, WALL, 0.12),
    roof: box(SLOPE, 0.1, D + GABLE * 2, 1.6),
    roofSnow: roundedBox(SLOPE + 0.08, 0.26, D + GABLE * 2 + 0.1, 0.12, 2),
    fascia: box(SLOPE, 0.16, 0.06),
    ridgeSnow: mapUV(new THREE.CylinderGeometry(0.17, 0.17, D + GABLE * 2 + 0.1, 16).rotateX(Math.PI / 2), 2),
    chimney: box(0.44, 1.35, 0.44, 1.2),
    chimneySnow: roundedBox(0.52, 0.14, 0.52, 0.06),
    icicle,
  }
})()

/** 처마 끝 고드름 자리 (한쪽 처마 기준, 반대쪽은 좌우를 뒤집어 씁니다) */
const ICICLES: THREE.Matrix4[] = (() => {
  const rand = seeded(42)
  const list: THREE.Matrix4[] = []
  for (const side of [-1, 1]) {
    for (let z = -D / 2 - GABLE + 0.08; z < D / 2 + GABLE; z += 0.1) {
      if (rand() < 0.3) continue
      const len = 0.08 + Math.pow(rand(), 2) * 0.42
      list.push(place(side * (EAVE_X - 0.04), EAVE_Y + 0.02, z, 0, 1, len, 1))
    }
  }
  return list
})()

/** 창문 하나. 벽 바깥면(z=0)에 붙습니다. */
function Window({ w, h, m, position, rotation = 0 }: { w: number; h: number; m: Materials; position: [number, number, number]; rotation?: number }) {
  const t = 0.07 // 창틀 두께
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* 유리 (안쪽 방 모습) */}
      <mesh position={[0, 0, 0.012]} material={m.glass}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* 창틀 위·아래·왼쪽·오른쪽 */}
      <mesh position={[0, h / 2 + t / 2, 0.035]} material={m.trim} castShadow>
        <boxGeometry args={[w + t * 2, t, 0.07]} />
      </mesh>
      <mesh position={[0, -h / 2 - t / 2, 0.035]} material={m.trim}>
        <boxGeometry args={[w + t * 2, t, 0.07]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + t / 2), 0, 0.035]} material={m.trim} castShadow>
          <boxGeometry args={[t, h, 0.07]} />
        </mesh>
      ))}
      {/* 창살 (십자) */}
      <mesh position={[0, 0, 0.03]} material={m.trim}>
        <boxGeometry args={[0.035, h, 0.04]} />
      </mesh>
      <mesh position={[0, h * 0.08, 0.03]} material={m.trim}>
        <boxGeometry args={[w, 0.035, 0.04]} />
      </mesh>
      {/* 창턱과 그 위에 쌓인 눈 */}
      <mesh position={[0, -h / 2 - t - 0.03, 0.08]} material={m.trim} castShadow>
        <boxGeometry args={[w + 0.26, 0.05, 0.17]} />
      </mesh>
      <mesh position={[0, -h / 2 - t + 0.02, 0.09]} geometry={sillSnow(w)} material={m.snow} />
    </group>
  )
}

const sillSnowCache = new Map<number, THREE.BufferGeometry>()
function sillSnow(w: number) {
  if (!sillSnowCache.has(w)) sillSnowCache.set(w, roundedBox(w + 0.22, 0.07, 0.16, 0.034))
  return sillSnowCache.get(w)!
}

/** 집 한 채의 창문 배치: [x, y, z, 돌린 각도, 폭, 높이] */
const WINDOWS: [number, number, number, number, number, number][] = [
  // 앞면: 문 옆 창문 + 다락 창
  [0.65, BASE + 1.05, D / 2, 0, 0.62, 0.78],
  [0, BASE + WALL + 0.45, D / 2, 0, 0.4, 0.5],
  // 뒷면 (앞쪽 집들은 뒷면이 카메라를 향해서 여기도 창문이 필요합니다)
  [-0.65, BASE + 1.05, -D / 2, Math.PI, 0.62, 0.78],
  [0.65, BASE + 1.05, -D / 2, Math.PI, 0.62, 0.78],
  [0, BASE + WALL + 0.45, -D / 2, Math.PI, 0.4, 0.5],
  // 옆면
  [W / 2, BASE + 1.05, 0.55, Math.PI / 2, 0.62, 0.78],
  [W / 2, BASE + 1.05, -0.6, Math.PI / 2, 0.62, 0.78],
  [-W / 2, BASE + 1.05, 0.55, -Math.PI / 2, 0.62, 0.78],
  [-W / 2, BASE + 1.05, -0.6, -Math.PI / 2, 0.62, 0.78],
]

/** 지붕 한쪽 (side: 1 = 오른쪽, -1 = 왼쪽) */
function RoofSide({ side, m }: { side: 1 | -1; m: Materials }) {
  return (
    <group position={[0, RIDGE_Y, 0]} rotation={[0, 0, -side * PITCH]}>
      <mesh geometry={houseGeo.roof} material={m.roofWood} position={[(side * SLOPE) / 2, 0.05, 0]} castShadow receiveShadow />
      <mesh geometry={houseGeo.roofSnow} material={m.snow} position={[(side * SLOPE) / 2, 0.2, 0]} castShadow receiveShadow />
      {/* 앞뒤 처마의 하얀 마감 판 */}
      {[-1, 1].map((f) => (
        <mesh key={f} geometry={houseGeo.fascia} material={m.trim} position={[(side * SLOPE) / 2, -0.04, f * (D / 2 + GABLE - 0.03)]} />
      ))}
    </group>
  )
}

/** 굴뚝 위치 (집 기준). 오른쪽 지붕 위 뒤편 */
const CHIMNEY = { x: 0.72, z: -0.55 }
const CHIMNEY_TOP = RIDGE_Y - CHIMNEY.x * Math.tan(PITCH) + 1.0

function House({ resident, index, lit, m, mood }: { resident: Resident; index: number; lit: boolean; m: Materials; mood: Mood }) {
  const rot = houseRotation(resident)
  // 굴뚝 연기는 바람 방향이 모든 집에서 같아야 해서, 집을 돌리기 전의 "마을 기준" 위치를 따로 계산합니다
  const smokeAt: [number, number, number] = [
    resident.x + CHIMNEY.x * Math.cos(rot) + CHIMNEY.z * Math.sin(rot),
    CHIMNEY_TOP + 0.1,
    resident.z - CHIMNEY.x * Math.sin(rot) + CHIMNEY.z * Math.cos(rot),
  ]

  return (
    <>
      <group position={[resident.x, 0, resident.z]} rotation={[0, rot, 0]}>
        <mesh geometry={houseGeo.foundation} material={m.stone} position={[0, BASE / 2, 0]} castShadow receiveShadow />
        <mesh geometry={houseGeo.walls} material={m.walls[index % m.walls.length]} castShadow receiveShadow />
        {/* 네 모서리의 하얀 마감 판 */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx},${sz}`} geometry={houseGeo.corner} material={m.trim} position={[sx * (W / 2), BASE + WALL / 2, sz * (D / 2)]} />
          )),
        )}
        <RoofSide side={1} m={m} />
        <RoofSide side={-1} m={m} />
        <mesh geometry={houseGeo.ridgeSnow} material={m.snow} position={[0, RIDGE_Y + 0.26, 0]} castShadow />
        <Instanced geometry={houseGeo.icicle} material={m.ice} matrices={ICICLES} shadow={false} />

        {/* 굴뚝 */}
        <mesh geometry={houseGeo.chimney} material={m.stone} position={[CHIMNEY.x, CHIMNEY_TOP - 0.675, CHIMNEY.z]} castShadow />
        <mesh geometry={houseGeo.chimneySnow} material={m.snow} position={[CHIMNEY.x, CHIMNEY_TOP + 0.04, CHIMNEY.z]} />

        {/* 문: 문짝, 하얀 문틀, 놋쇠 손잡이, 돌계단 */}
        <group position={[-0.55, BASE, D / 2]}>
          <mesh position={[0, 0.69, 0.03]} material={m.door} castShadow>
            <boxGeometry args={[0.74, 1.38, 0.06]} />
          </mesh>
          <mesh position={[0, 1.42, 0.05]} material={m.trim}>
            <boxGeometry args={[0.9, 0.09, 0.08]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.41, 0.69, 0.05]} material={m.trim}>
              <boxGeometry args={[0.08, 1.38, 0.08]} />
            </mesh>
          ))}
          <mesh position={[0.24, 0.68, 0.08]} material={m.brass}>
            <sphereGeometry args={[0.035, 12, 8]} />
          </mesh>
          <mesh position={[0, -BASE / 2, 0.26]} material={m.stone} receiveShadow castShadow>
            <boxGeometry args={[1.0, BASE, 0.5]} />
          </mesh>
          <mesh position={[0, 0.02, 0.28]} material={m.snow} geometry={STEP_SNOW} />
          {/* 문 옆 작은 등 */}
          <mesh position={[0.62, 1.5, 0.08]} material={m.lampGlass}>
            <boxGeometry args={[0.12, 0.18, 0.12]} />
          </mesh>
          {mood.lightsOn && <pointLight position={[0.2, 1.4, 0.7]} color="#ffb870" intensity={5} distance={5} decay={2} />}
        </group>

        {WINDOWS.map(([x, y, z, r, w, h], i) => (
          <Window key={i} position={[x, y, z]} rotation={r} w={w} h={h} m={m} />
        ))}

        <Html position={[0, RIDGE_Y + 0.9, 0]} center zIndexRange={[5, 0]}>
          <span className="tag">{resident.name}</span>
        </Html>
      </group>

      {mood.smoke > 0 && <Smoke position={smokeAt} amount={mood.smoke} color={mood.lightsOn ? '#cbb9c2' : '#e9ecf0'} />}
      <Mailbox resident={resident} sent={lit} m={m} mood={mood} />
    </>
  )
}

const STEP_SNOW = roundedBox(0.9, 0.06, 0.3, 0.03)

// ───────── 우체통 ─────────

/** 집 앞 우체통: 나무 기둥 위의 빨간 철제 우체통. 편지를 넣으면 깃발이 서고 발밑이 따뜻하게 빛납니다. */
function Mailbox({ resident, sent, m, mood }: { resident: Resident; sent: boolean; m: Materials; mood: Mood }) {
  const at = mailboxPos(resident)
  return (
    <group position={[at.x, 0, at.z]} rotation={[0, houseRotation(resident), 0]}>
      <mesh position={[0, 0.5, 0]} material={m.wood} castShadow>
        <boxGeometry args={[0.1, 1.0, 0.1]} />
      </mesh>
      {/* 통: 아래는 네모, 위는 둥근 지붕 */}
      <mesh position={[0, 1.08, 0]} castShadow>
        <boxGeometry args={[0.34, 0.2, 0.52]} />
        <meshStandardMaterial color="#8f2420" roughness={0.45} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.18, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.52, 20, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#8f2420" roughness={0.45} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.3, 0]} geometry={MAILBOX_SNOW} material={m.snow} />
      {/* 깃발: 편지를 넣으면 위로 섭니다 */}
      <group position={[0.19, 1.1, -0.1]} rotation={[sent ? 0 : -Math.PI / 2, 0, 0]}>
        <mesh position={[0, 0.16, 0]} material={m.metal}>
          <boxGeometry args={[0.02, 0.32, 0.03]} />
        </mesh>
        <mesh position={[0, 0.28, 0.06]}>
          <boxGeometry args={[0.02, 0.1, 0.12]} />
          <meshStandardMaterial color="#e0b23c" metalness={0.6} roughness={0.35} emissive="#e0b23c" emissiveIntensity={sent ? 0.4 : 0} />
        </mesh>
      </group>
      {sent && (
        <>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.9, 32]} />
            <meshBasicMaterial color="#ffcf5a" transparent opacity={0.22} depthWrite={false} />
          </mesh>
          {mood.lightsOn && <pointLight position={[0, 1, 0.4]} color="#ffd38a" intensity={3} distance={4} decay={2} />}
        </>
      )}
    </group>
  )
}

const MAILBOX_SNOW = (() => {
  const g = lumpySphere(7, 0.08)
  g.scale(0.19, 0.07, 0.3)
  return g
})()

// ───────── 가로등 ─────────

const lampGeo = {
  base: mapUV(new THREE.CylinderGeometry(0.11, 0.16, 0.32, 12), 1),
  pole: new THREE.CylinderGeometry(0.035, 0.05, 2.1, 10),
  plate: new THREE.BoxGeometry(0.3, 0.04, 0.3),
  glass: new THREE.BoxGeometry(0.22, 0.3, 0.22),
  bar: new THREE.BoxGeometry(0.025, 0.32, 0.025),
  hood: new THREE.ConeGeometry(0.24, 0.2, 4).rotateY(Math.PI / 4),
  hoodSnow: (() => {
    const g = lumpySphere(3, 0.08)
    g.scale(0.17, 0.06, 0.17)
    return g
  })(),
}

/** 광장 둘레의 쇠 가로등 */
function Lamps({ m, mood }: { m: Materials; mood: Mood }) {
  return (
    <>
      {LAMPS.map((l) => (
        <group key={`${l.x},${l.z}`} position={[l.x, 0, l.z]}>
          <mesh geometry={lampGeo.base} material={m.metal} position={[0, 0.16, 0]} castShadow />
          <mesh geometry={lampGeo.pole} material={m.metal} position={[0, 1.35, 0]} castShadow />
          <mesh geometry={lampGeo.plate} material={m.metal} position={[0, 2.42, 0]} />
          <mesh geometry={lampGeo.glass} material={m.lampGlass} position={[0, 2.59, 0]} />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx},${sz}`} geometry={lampGeo.bar} material={m.metal} position={[sx * 0.12, 2.59, sz * 0.12]} />
            )),
          )}
          <mesh geometry={lampGeo.hood} material={m.metal} position={[0, 2.84, 0]} castShadow />
          <mesh geometry={lampGeo.hoodSnow} material={m.snow} position={[0, 2.9, 0]} />
          {mood.lightsOn && <pointLight position={[0, 2.5, 0]} color="#ffc98a" intensity={9} distance={9} decay={2} />}
        </group>
      ))}
    </>
  )
}

/** 가로등 사이에 늘어뜨린 전구 줄 (전선 + 따뜻한 흰색 전구) */
function StringLights({ m }: { m: Materials }) {
  const { wire, bulbs } = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(STRING_LIGHTS.map(([x, y, z]) => new THREE.Vector3(x, y + 0.05, z)))
    const wire = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#1a1a1a' }))
    const bulbs = STRING_LIGHTS.map(([x, y, z]) => place(x, y, z))
    return { wire, bulbs }
  }, [])
  return (
    <>
      <primitive object={wire} />
      <Instanced geometry={bulbGeometry} material={m.bulb} matrices={bulbs} shadow={false} />
    </>
  )
}

// ───────── 광장 소품 ─────────

const SNOW_BALLS = [lumpySphere(1, 0.05), lumpySphere(2, 0.05), lumpySphere(3, 0.04)]

/** 눈사람: 울퉁불퉁한 눈덩이 셋, 숯 눈·단추, 당근 코, 나뭇가지 팔, 털목도리와 털모자 */
function Snowman({ m }: { m: Materials }) {
  const coal = <meshStandardMaterial color="#141414" roughness={0.9} />
  const knit = <meshStandardMaterial color="#9b2328" roughness={1} />
  return (
    <group position={[SNOWMAN.x, 0, SNOWMAN.z]} rotation={[0, 0.7, 0]}>
      <mesh geometry={SNOW_BALLS[0]} material={m.snow} position={[0, 0.4, 0]} scale={[0.52, 0.48, 0.52]} castShadow receiveShadow />
      <mesh geometry={SNOW_BALLS[1]} material={m.snow} position={[0, 1.05, 0]} scale={0.37} castShadow receiveShadow />
      <mesh geometry={SNOW_BALLS[2]} material={m.snow} position={[0, 1.55, 0]} scale={0.26} castShadow receiveShadow />
      {/* 눈 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.09, 1.62, 0.22]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          {coal}
        </mesh>
      ))}
      {/* 단추 */}
      {[0.92, 1.07, 1.22].map((y) => (
        <mesh key={y} position={[0, y, 0.36 - Math.abs(y - 1.05) * 0.25]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          {coal}
        </mesh>
      ))}
      {/* 당근 코 */}
      <mesh position={[0, 1.55, 0.36]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.04, 0.26, 10]} />
        <meshStandardMaterial color="#d9702a" roughness={0.7} />
      </mesh>
      {/* 나뭇가지 팔 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.5, 1.2, 0]} rotation={[0, 0, s * -1.05]} material={m.bark} castShadow>
          <cylinderGeometry args={[0.015, 0.025, 0.6, 6]} />
        </mesh>
      ))}
      {/* 목도리 */}
      <mesh position={[0, 1.33, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.23, 0.055, 10, 24]} />
        {knit}
      </mesh>
      <mesh position={[0.12, 1.18, 0.2]} rotation={[0.2, 0, -0.15]} castShadow>
        <boxGeometry args={[0.1, 0.28, 0.04]} />
        {knit}
      </mesh>
      {/* 털모자와 방울 */}
      <mesh position={[0, 1.7, 0]} castShadow>
        <sphereGeometry args={[0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {knit}
      </mesh>
      <mesh position={[0, 1.92, 0]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshStandardMaterial color="#f1ece2" roughness={1} />
      </mesh>
    </group>
  )
}

/** 통나무 장작 더미 (미니어처의 순록 자리) */
const LOG = (() => {
  const g = new THREE.CylinderGeometry(0.11, 0.11, 0.95, 14).rotateZ(Math.PI / 2)
  return mapUV(g, 0.7)
})()

function Woodpile({ m }: { m: Materials }) {
  const { logs, endMat } = useMemo(() => {
    const rand = seeded(12)
    const logs: THREE.Matrix4[] = []
    // 아래에서부터 4, 3, 2, 1 개씩 피라미드처럼 쌓기
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 4 - row; i++) {
        const z = (i - (3 - row) / 2) * 0.22
        logs.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3((rand() - 0.5) * 0.08, 0.11 + row * 0.19, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, 0, 0)),
            new THREE.Vector3(1, 1, 1),
          ),
        )
      }
    }
    // 잘린 단면: 밝은 나무색
    const endMat = new THREE.MeshStandardMaterial({ color: '#c9a37a', roughness: 0.9 })
    return { logs, endMat }
  }, [])
  return (
    <group position={[REINDEER.x, 0, REINDEER.z]} rotation={[0, -0.7, 0]}>
      {/* 원기둥은 [옆면, 윗면, 아랫면] 세 부분이라 재료를 세 개 줍니다 */}
      <Instanced geometry={LOG} material={[m.bark, endMat, endMat]} matrices={logs} />
      <mesh geometry={WOODPILE_SNOW} material={m.snow} position={[0, 0.78, 0]} />
    </group>
  )
}

const WOODPILE_SNOW = (() => {
  const g = lumpySphere(9, 0.1)
  g.scale(0.5, 0.08, 0.2)
  return g
})()

/** 나무 썰매 (미니어처의 썰매 자리) */
function Sled({ m }: { m: Materials }) {
  const runner = useMemo(() => {
    // 앞쪽이 위로 둥글게 말려 올라간 썰매 날
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.6, 0.03, 0),
      new THREE.Vector3(0.45, 0.03, 0),
      new THREE.Vector3(0.65, 0.12, 0),
      new THREE.Vector3(0.6, 0.3, 0),
      new THREE.Vector3(0.45, 0.32, 0),
    ])
    return new THREE.TubeGeometry(curve, 24, 0.02, 6)
  }, [])
  return (
    <group position={[SLED.x, 0, SLED.z]} rotation={[0, -1.2, 0]}>
      {[-0.22, 0.22].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh geometry={runner} material={m.metal} castShadow />
          {[-0.35, 0.05, 0.4].map((x) => (
            <mesh key={x} position={[x, 0.15, 0]} material={m.wood}>
              <boxGeometry args={[0.04, 0.22, 0.04]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 앉는 판 */}
      {[-0.45, -0.25, -0.05, 0.15, 0.35].map((x) => (
        <mesh key={x} position={[x, 0.27, 0]} material={m.wood} castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.035, 0.56]} />
        </mesh>
      ))}
      <Gift position={[-0.1, 0.29, 0]} size={[0.38, 0.28, 0.32]} paper="#1f4d3a" ribbon="#d4a537" rotation={0.3} />
    </group>
  )
}

/** 포장지로 싼 선물 상자: 상자 + 십자 리본 + 나비 매듭 */
function Gift({ position, size, paper, ribbon, rotation = 0 }: {
  position: [number, number, number]
  size: [number, number, number]
  paper: string
  ribbon: string
  rotation?: number
}) {
  const [w, h, d] = size
  const ribbonMat = <meshStandardMaterial color={ribbon} roughness={0.35} metalness={0.3} />
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={paper} roughness={0.55} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w + 0.01, h + 0.01, 0.06]} />
        {ribbonMat}
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[0.06, h + 0.01, d + 0.01]} />
        {ribbonMat}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.06, h + 0.04, 0]} rotation={[Math.PI / 2, s * 0.5, 0]} castShadow>
          <torusGeometry args={[0.06, 0.018, 8, 16]} />
          {ribbonMat}
        </mesh>
      ))}
    </group>
  )
}

const GIFT_PAPERS = ['#7a1a1f', '#1f4d3a', '#e9e1cf', '#22304f', '#b88a2e', '#5b1e3d']
const GIFT_RIBBONS = ['#d4a537', '#efe8d8', '#9e1b25', '#d4a537', '#efe8d8', '#d4a537']

/** 대왕 트리 아래 선물들 (미니어처와 같은 자리) */
function Gifts() {
  return (
    <group position={[TREE_POS.x, 0, TREE_POS.z]}>
      {GIFTS.map(([name, x, z, rot], i) => {
        const wide = name.includes('rectangle')
        const size: [number, number, number] = wide ? [0.95, 0.42, 0.6] : name.includes('round') ? [0.55, 0.62, 0.55] : [0.62, 0.55, 0.62]
        return <Gift key={i} position={[x * 0.85, 0, z * 0.85]} size={size} paper={GIFT_PAPERS[i]} ribbon={GIFT_RIBBONS[i]} rotation={rot} />
      })}
    </group>
  )
}

/** 눈밭 여기저기에 바람이 쌓아 올린 눈 더미 */
function SnowMounds({ m }: { m: Materials }) {
  return (
    <>
      {/* 카메라 바로 앞(z > 6)의 눈 더미는 화면을 가려서 뺍니다 */}
      {SNOW_PILES.filter(([, z]) => z < 6).map(([x, z, size], i) => (
        <mesh
          key={i}
          geometry={SNOW_BALLS[i % 3]}
          material={m.snow}
          position={[x, -size * 0.08, z]}
          rotation={[0, x, 0]}
          scale={[size * 0.7, size * 0.2, size * 0.55]}
          castShadow
          receiveShadow
        />
      ))}
    </>
  )
}

// ───────── 전체 ─────────

/** 사실적인 마을 전체. letters: 대왕 트리에 걸린 장식 수 / sent: 누구에게 편지를 넣었는지 */
export function RealVillage({ letters, sent }: { letters: number; sent: Record<string, boolean> }) {
  const style = useStyle()
  const mood = MOODS[style.id as keyof typeof MOODS]
  const m = useMaterials(mood, style)

  return (
    <>
      <Atmosphere mood={mood} fogColor={style.background} />
      <Ground m={m} />
      <Plaza />
      <Fence m={m} />
      <Forest m={m} snow={mood.branchSnow} />
      <BigTree letters={letters} m={m} mood={mood} />
      {RESIDENTS.map((r, i) => (
        <House key={r.id} resident={r} index={i} lit={!!sent[r.id]} m={m} mood={mood} />
      ))}
      <Lamps m={m} mood={mood} />
      <StringLights m={m} />
      <Snowman m={m} />
      <Woodpile m={m} />
      <Sled m={m} />
      <Gifts />
      <SnowMounds m={m} />
    </>
  )
}

// 이 화면에서 쓰는 텍스처를 미리 받아 둡니다
preloadPbr(['snow_02', 'white_planks_clean', 'stacked_stone_wall', 'pine_bark', 'weathered_brown_planks', 'dark_planks', 'cobblestone_floor_04'])
