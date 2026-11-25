// 캐릭터의 "겉모습 설정"을 다루는 파일입니다.
// 사용자가 고른 조합(머리색, 옷 색 등)을 짧은 기록(Look)으로 저장합니다.

/** 캐릭터 종류. 지금은 무료 에셋(KayKit)의 두 가지를 씁니다. */
export type CharacterType = 'Rogue' | 'Mage'

/** 겉모습 설정 한 벌. 색이 null 이면 "원래 색 그대로"라는 뜻입니다. */
export type Look = {
  type: CharacterType
  hair: string | null
  outfit: string | null
  skin: string | null
  cape: boolean // 망토를 두를지
  hat: boolean // 모자를 쓸지 (모자가 있는 캐릭터만)
}

export const DEFAULT_LOOK: Look = {
  type: 'Rogue',
  hair: null,
  outfit: null,
  skin: null,
  cape: false,
  hat: true,
}

/** 고를 수 있는 선택지들 */
export const CHARACTER_TYPES: { id: CharacterType; label: string; hasHat: boolean }[] = [
  { id: 'Rogue', label: '단발', hasHat: false },
  { id: 'Mage', label: '묶음머리', hasHat: true },
]

export const HAIR_COLORS = ['#2b2320', '#6b4226', '#d9a441', '#c0492f', '#f28fa8', '#6ec5c0', '#8a7fd1', '#e8e8ee']
export const OUTFIT_COLORS = ['#e4572e', '#f2b544', '#3f8f6b', '#4a78c9', '#8a5fc0', '#f28fa8', '#f3f0e6', '#3a3f55']
export const SKIN_COLORS = ['#fbd3b0', '#e8b48a', '#c68c5f', '#8d5a3b']

// ── 색 바꾸기의 원리 ─────────────────────────────────────────────
// 이 캐릭터는 "색상표 그림" 한 장(가로 8칸 × 세로 4칸)으로 색을 칠합니다.
// 머리카락은 항상 (1, 0)번 칸의 색을 쓰는 식으로 부위마다 쓰는 칸이 정해져 있습니다.
// 그래서 그 칸의 색만 다시 칠하면 해당 부위의 색이 바뀝니다.

/** [가로 칸 번호, 세로 칸 번호, 밝기 배율] */
type Cell = [number, number, number]

const PALETTE_CELLS: Record<CharacterType, { hair: Cell[]; skin: Cell[]; outfit: Cell[] }> = {
  Rogue: {
    hair: [[1, 0, 1]],
    skin: [[0, 0, 1]],
    // 겉옷, 안쪽 옷(조금 어둡게)
    outfit: [
      [1, 1, 1],
      [0, 1, 0.68],
    ],
  },
  Mage: {
    hair: [[1, 0, 1]],
    skin: [[0, 0, 1]],
    // 옷, 모자, 망토(조금 어둡게)
    outfit: [
      [0, 1, 1],
      [1, 1, 0.9],
      [2, 1, 0.75],
    ],
  },
}

const COLUMNS = 8
const ROWS = 4

/** '#rrggbb' 글자를 [빨강, 초록, 파랑] 숫자로 바꿉니다. */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 색상표의 한 칸을 새 색으로 다시 칠합니다. 원래 있던 명암(밝고 어두운 무늬)은 유지합니다. */
function repaintCell(ctx: CanvasRenderingContext2D, cell: Cell, hex: string) {
  const [col, row, shade] = cell
  const w = ctx.canvas.width / COLUMNS
  const h = ctx.canvas.height / ROWS
  const image = ctx.getImageData(col * w, row * h, w, h)
  const data = image.data
  const [r, g, b] = hexToRgb(hex)

  // 1) 이 칸의 평균 밝기를 구합니다.
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const average = total / (data.length / 4) || 1

  // 2) 각 점이 평균보다 얼마나 밝은지/어두운지 비율을 새 색에 곱합니다.
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const factor = (luma / average) * shade
    data[i] = Math.min(255, r * factor)
    data[i + 1] = Math.min(255, g * factor)
    data[i + 2] = Math.min(255, b * factor)
  }
  ctx.putImageData(image, col * w, row * h)
}

/**
 * 원본 색상표 그림에 사용자가 고른 색을 덧칠한 새 색상표를 만듭니다.
 * original: 모델에 들어 있던 원래 그림
 */
export function paintPalette(original: CanvasImageSource, look: Look): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(original, 0, 0, canvas.width, canvas.height)

  const cells = PALETTE_CELLS[look.type]
  if (look.hair) for (const cell of cells.hair) repaintCell(ctx, cell, look.hair)
  if (look.skin) for (const cell of cells.skin) repaintCell(ctx, cell, look.skin)
  if (look.outfit) for (const cell of cells.outfit) repaintCell(ctx, cell, look.outfit)
  return canvas
}

// ── 저장과 불러오기 ──────────────────────────────────────────────
// 지금은 맛보기라서 이 브라우저 안(localStorage)에만 저장합니다.
// 실제 앱에서는 서버 DB에 저장해서 친구들도 내 캐릭터를 볼 수 있게 합니다.

const STORAGE_KEY = 'your-day-look'

export function loadLook(): Look {
  try {
    // 주소에 ?look=... 이 있으면 그것을 먼저 씁니다 (테스트용)
    const fromUrl = new URLSearchParams(location.search).get('look')
    const raw = fromUrl ?? localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_LOOK, ...JSON.parse(raw) }
  } catch {
    // 저장된 값이 깨졌거나 저장소를 쓸 수 없으면 기본값을 씁니다
  }
  return DEFAULT_LOOK
}

export function saveLook(look: Look) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(look))
  } catch {
    // 저장소를 쓸 수 없는 환경이면 저장만 건너뜁니다
  }
}
