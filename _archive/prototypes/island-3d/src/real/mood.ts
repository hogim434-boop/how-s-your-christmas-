import type { StyleId } from '../styles'

// 사실적인 마을의 "분위기" 설정입니다.
// 마을 모양은 같고, 시간대(해의 높이·빛 색)와 날씨, 불빛, 연기 같은 것이 달라집니다.

export type Mood = {
  /** 하늘 사진(HDRI). 주변 풍경이 물체에 비치고, 은은한 주변광을 만듭니다 */
  hdri: string
  /** 하늘 사진 빛의 세기 */
  envIntensity: number
  /** 하늘 색: 꼭대기 → 지평선 */
  sky: { top: string; middle: string; horizon: string }
  /** 해 (그림자를 만드는 주된 빛) */
  sun: { position: [number, number, number]; color: string; intensity: number }
  /** 하늘에서 오는 빛 색, 땅에서 반사되는 빛 색, 세기 */
  hemi: [string, string, number]
  /** 창문 안쪽 불빛 세기 (0 이면 꺼짐) */
  windowGlow: number
  /** 가로등·전구 불빛 세기 */
  lampGlow: number
  /** true 면 실제로 주변을 비추는 조명(점광원)을 켭니다 */
  lightsOn: boolean
  /** 굴뚝 연기 진하기 (0 ~ 1) */
  smoke: number
  /** 땅 위에 깔리는 안개 진하기 (0 ~ 1) */
  mist: number
  /** 공중에 떠다니는 빛 알갱이 */
  motes: boolean
  /** 눈 결정이 햇빛에 반짝이는 효과 */
  sparkle: boolean
  /** 내리는 눈송이 수 */
  snowfall: number
  /** 나뭇가지에 쌓인 눈의 양 (0 ~ 1) */
  branchSnow: number
}

export const MOODS: Record<Extract<StyleId, 'real' | 'dusk'>, Mood> = {
  // 한낮: 맑게 갠 겨울 오전. 높은 해, 또렷한 그림자, 햇빛에 반짝이는 눈
  real: {
    hdri: 'snowy_field',
    envIntensity: 0.85,
    sky: { top: '#6f98c9', middle: '#a9c3de', horizon: '#dde6ef' },
    sun: { position: [-16, 24, 14], color: '#fff3e2', intensity: 2.5 },
    hemi: ['#dce8ff', '#f4f6fa', 0.35],
    windowGlow: 0.12,
    lampGlow: 0.15,
    lightsOn: false,
    smoke: 0.35,
    mist: 0,
    motes: false,
    sparkle: true,
    snowfall: 250,
    branchSnow: 0.9,
  },
  // 노을: 해가 숲 너머로 지는 순간. 낮게 깔린 주황빛, 길게 늘어진 푸른 그림자,
  // 하나둘 켜지는 창문 불빛과 굴뚝 연기, 땅에 낮게 깔린 분홍 안개
  dusk: {
    hdri: 'rural_winter_roadside',
    envIntensity: 0.22,
    sky: { top: '#2e3468', middle: '#9a6f9e', horizon: '#f2a27e' },
    // 숲 너머 왼쪽 뒤편, 지평선 바로 위의 해 → 길고 푸른 그림자
    sun: { position: [-30, 8, -22], color: '#ff8f52', intensity: 4.2 },
    // 그늘은 차가운 푸른빛, 하늘 쪽은 분홍빛
    hemi: ['#d98fa0', '#33416f', 0.45],
    windowGlow: 3.2,
    lampGlow: 5,
    lightsOn: true,
    smoke: 1,
    mist: 1,
    motes: true,
    sparkle: false,
    snowfall: 380,
    branchSnow: 0.75,
  },
}
