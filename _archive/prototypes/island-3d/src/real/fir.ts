import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canvasTexture, mapUV, seeded } from './textures'

// 사실적인 전나무를 "코드로" 만드는 파일입니다.
//
// 방법: 바늘잎이 빽빽하게 달린 잔가지 그림(잎 카드)을 그린 뒤,
// 그 카드를 수백 장 줄기에 빙 둘러 붙입니다. 카드는 아래로 살짝 처지게 휘어서
// 눈 무게에 늘어진 진짜 전나무 가지처럼 보이게 합니다.
// (실제 게임에서도 나무를 이렇게 "그림 카드 여러 장"으로 만듭니다)

const CARD_W = 128
const CARD_H = 512

/** 잎 카드 위의 "가지 모양"을 계산합니다. 같은 모양으로 바늘잎과 눈을 그리기 위해 한 번만 만듭니다. */
type Twig = { x0: number; y0: number; x1: number; y1: number; spread: number }

const twigs: Twig[] = (() => {
  const rand = seeded(11)
  const list: Twig[] = []
  // 가운데 큰 줄기 (아래 = 가지가 붙는 쪽, 위 = 가지 끝)
  list.push({ x0: CARD_W / 2, y0: CARD_H, x1: CARD_W / 2, y1: 6, spread: 13 })
  // 양옆으로 비스듬히 뻗은 잔가지들
  for (let i = 0; i < 16; i++) {
    const t = 0.06 + (i / 16) * 0.82 // 줄기의 어디쯤에서 나오는지 (0 = 아래, 1 = 끝)
    const side = i % 2 === 0 ? -1 : 1
    // 가지 폭: 아래쪽 1/3 지점이 가장 넓고 끝으로 갈수록 뾰족해집니다
    const envelope = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)), 0.8)
    const length = (CARD_W / 2 - 10) * envelope * (0.85 + rand() * 0.3)
    const y0 = CARD_H * (1 - t)
    list.push({
      x0: CARD_W / 2,
      y0,
      x1: CARD_W / 2 + side * length,
      y1: y0 - length * 0.9, // 끝 쪽(위)으로 비스듬히
      spread: 10,
    })
  }
  return list
})()

/** 잔가지 하나를 따라 바늘잎을 그립니다 */
function drawNeedles(ctx: CanvasRenderingContext2D, twig: Twig, rand: () => number, colors: string[]) {
  const dx = twig.x1 - twig.x0
  const dy = twig.y1 - twig.y0
  const len = Math.hypot(dx, dy)
  const dir = Math.atan2(dy, dx)
  for (let d = 0; d < len; d += 1.6) {
    const t = d / len
    const px = twig.x0 + (dx * d) / len
    const py = twig.y0 + (dy * d) / len
    // 끝으로 갈수록 바늘이 짧아집니다
    const needle = twig.spread * (1 - t * 0.55) * (0.75 + rand() * 0.5)
    for (const side of [-1, 1]) {
      const a = dir + side * (0.75 + rand() * 0.35)
      ctx.strokeStyle = colors[Math.floor(rand() * colors.length)]
      ctx.lineWidth = 1.4 + rand() * 0.8
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + Math.cos(a) * needle, py + Math.sin(a) * needle)
      ctx.stroke()
    }
  }
  // 가지 자체 (갈색 줄)
  ctx.strokeStyle = '#3b2d22'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(twig.x0, twig.y0)
  ctx.lineTo(twig.x1, twig.y1)
  ctx.stroke()
}

/** 바늘잎 그림 (배경은 투명) */
const needleTexture = canvasTexture(
  CARD_W,
  (ctx) => {
    const rand = seeded(3)
    // 안쪽은 짙은 초록, 바깥 바늘은 조금 밝은 초록
    const colors = ['#132a1b', '#183322', '#1e3d29', '#244731', '#2b5238', '#335c3f']
    for (const twig of twigs) drawNeedles(ctx, twig, rand, colors)
  },
  CARD_H,
)
needleTexture.anisotropy = 8

/** 눈이 쌓이는 자리 (흰색일수록 눈이 많이 쌓임). 가지 윗면에만 칠해집니다. */
const snowMask = canvasTexture(
  CARD_W,
  (ctx) => {
    const rand = seeded(5)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, CARD_W, CARD_H)
    ctx.filter = 'blur(3px)'
    ctx.fillStyle = '#fff'
    for (const twig of twigs) {
      for (let t = 0.05; t < 0.95; t += 0.09) {
        if (rand() < 0.35) continue
        const x = twig.x0 + (twig.x1 - twig.x0) * t
        const y = twig.y0 + (twig.y1 - twig.y0) * t
        ctx.beginPath()
        ctx.ellipse(x, y, 5 + rand() * 8, 4 + rand() * 6, rand() * Math.PI, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  },
  CARD_H,
)
snowMask.colorSpace = THREE.NoColorSpace

/**
 * 잎 카드 한 장을 만듭니다.
 * 길이 방향은 +X(바깥쪽), 폭 방향은 Z 입니다. 앞면은 위(하늘)를 봅니다.
 * droop: 끝이 아래로 처지는 정도 / roll: 길이 축을 중심으로 기울이는 각도
 */
function card(length: number, width: number, droop: number, roll: number) {
  const g = new THREE.PlaneGeometry(width, length, 2, 6)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const across = p.getX(i)
    const along = p.getY(i) + length / 2
    const t = along / length
    // 끝으로 갈수록 아래로 휘고(droop), 양쪽 가장자리도 살짝 아래로 굽힙니다(우산처럼)
    const y = -droop * t * t - Math.abs(across) * 0.25
    // 길이 축을 중심으로 roll 만큼 기울이기
    const ry = y * Math.cos(roll) - across * Math.sin(roll)
    const rz = y * Math.sin(roll) + across * Math.cos(roll)
    p.setXYZ(i, along, ry, rz)
  }
  g.computeVertexNormals()
  return g
}

type FirOptions = {
  /** 나무 전체 높이 */
  height: number
  /** 가지가 시작되는 높이 (그 아래는 줄기만 보입니다) */
  crownBase: number
  /** 높이 y 에서 가지가 뻗어 나가는 길이 */
  radiusAt: (y: number) => number
  seed: number
  /** 가지 층 사이 간격 (작을수록 빽빽) */
  gap: number
  /** 한 층에 붙는 가지 수 배율 (1 = 보통, 클수록 빽빽) */
  density?: number
}

export type FirParts = {
  /** 바늘잎 카드를 모두 합친 모양 */
  foliage: THREE.BufferGeometry
  /** 가지 사이로 하늘이 비치지 않게 안쪽을 채우는 짙은 원뿔 */
  core: THREE.BufferGeometry
  /** 줄기 */
  trunk: THREE.BufferGeometry
}

/** 전나무 한 그루의 모양을 만듭니다 */
export function buildFir(o: FirOptions): FirParts {
  const rand = seeded(o.seed)
  const cards: THREE.BufferGeometry[] = []
  const matrix = new THREE.Matrix4()
  const rotY = new THREE.Matrix4()
  const rotZ = new THREE.Matrix4()
  const span = o.height - o.crownBase

  let whorl = 0
  for (let y = o.crownBase; y < o.height * 0.96; y += o.gap * (0.75 + rand() * 0.5)) {
    const t = (y - o.crownBase) / span // 0 = 맨 아래 가지, 1 = 꼭대기
    const reach = o.radiusAt(y)
    const count = Math.round((6 + 3 * (1 - t)) * (o.density ?? 1))
    for (let b = 0; b < count; b++) {
      const azimuth = (b / count) * Math.PI * 2 + whorl * 0.9 + rand() * 0.5
      const length = reach * (0.85 + rand() * 0.25)
      const width = Math.max(o.height * 0.03, length * 0.62)
      // 아래 가지일수록 많이 처지고, 위 가지는 하늘을 향해 살짝 들립니다
      const droop = length * (0.12 + 0.32 * (1 - t))
      const lift = 0.28 * t - 0.04 + (rand() - 0.5) * 0.12
      // 카드 3장을 부채처럼 겹쳐서 가지 하나를 만듭니다 (위·옆 어디서 봐도 잎이 꽉 차 보이게)
      for (const roll of [-0.4, 0, 0.38]) {
        const g = card(length * (roll === 0 ? 1 : 0.88), width * (roll === 0 ? 1.1 : 0.9), droop, roll + (rand() - 0.5) * 0.2)
        rotZ.makeRotationZ(lift)
        rotY.makeRotationY(azimuth)
        matrix.makeTranslation(0, y, 0).multiply(rotY).multiply(rotZ)
        g.applyMatrix4(matrix)
        cards.push(g)
      }
    }
    whorl++
  }
  // 꼭대기의 곧게 선 새순 (카드 2장을 십자로)
  for (const a of [0, Math.PI / 2]) {
    const g = card(o.height * 0.09, o.height * 0.035, 0, 0)
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(0, o.height * 0.9, 0).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)))
    cards.push(g)
  }

  const foliage = mergeGeometries(cards)!
  cards.forEach((g) => g.dispose())

  // 색 변화: 줄기 가까운 안쪽은 어둡게, 가지 끝은 밝게 → 입체감과 깊이가 생깁니다
  // 빛 방향: 카드 면 방향과 "나무 바깥 방향"을 섞어서, 나무 전체가 둥근 덩어리처럼 빛을 받게 합니다
  const pos = foliage.attributes.position
  const nor = foliage.attributes.normal
  const colors = new Float32Array(pos.count * 3)
  const out = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const reach = Math.max(0.001, o.radiusAt(y))
    const r = Math.min(1, Math.hypot(x, z) / reach)
    const shade = 0.45 + 0.6 * r
    colors[i * 3] = shade * 0.95
    colors[i * 3 + 1] = shade
    colors[i * 3 + 2] = shade * 0.95
    out.set(x, (y - o.height * 0.45) * 0.3, z).normalize()
    n.set(nor.getX(i), nor.getY(i), nor.getZ(i)).multiplyScalar(0.55).addScaledVector(out, 0.65).normalize()
    nor.setXYZ(i, n.x, n.y, n.z)
  }
  foliage.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  // 안쪽 짙은 원뿔
  const coreHeight = o.height * 0.95 - o.crownBase
  const core = new THREE.ConeGeometry(o.radiusAt(o.crownBase) * 0.36, coreHeight, 12, 1, true)
  core.translate(0, o.crownBase + coreHeight / 2, 0)

  // 줄기 (나무껍질 무늬는 0.6칸마다 반복)
  const trunk = mapUV(new THREE.CylinderGeometry(o.height * 0.012, o.height * 0.035, o.height * 0.92, 10), o.height * 0.12)
  trunk.translate(0, o.height * 0.46, 0)

  return { foliage, core, trunk }
}

/**
 * 바늘잎 재료. snow: 가지 위에 쌓인 눈의 양 (0 ~ 1)
 * 그림의 투명한 부분은 잘라내서(alphaTest) 바늘 하나하나의 실루엣이 보입니다.
 */
export function firMaterial(snow: number) {
  const material = new THREE.MeshStandardMaterial({
    map: needleTexture,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    vertexColors: true,
    roughness: 0.9,
  })
  // 기본 재료의 색칠 코드에 "윗면에 눈 섞기"를 한 줄 끼워 넣습니다
  material.onBeforeCompile = (shader) => {
    shader.uniforms.snowMap = { value: snowMask }
    shader.uniforms.snowAmount = { value: snow }
    shader.fragmentShader =
      'uniform sampler2D snowMap;\nuniform float snowAmount;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // gl_FrontFacing: 카드의 윗면(하늘 쪽)일 때만 눈을 칠합니다
        float snowCover = texture2D(snowMap, vMapUv).r * snowAmount * (gl_FrontFacing ? 1.0 : 0.08);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), clamp(snowCover, 0.0, 1.0));`,
      )
  }
  material.customProgramCacheKey = () => 'fir-snow'
  return material
}

/** 안쪽 원뿔 재료: 거의 검은 초록 (빛이 닿지 않는 나무 속) */
export const firCoreMaterial = new THREE.MeshStandardMaterial({ color: '#0b1a10', roughness: 1, side: THREE.DoubleSide })
