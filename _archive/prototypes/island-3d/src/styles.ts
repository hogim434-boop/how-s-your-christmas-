import { createContext, useContext } from 'react'

// 그림체(스타일) 4가지를 정의한 파일입니다.
// - 미니어처, 빛(밤): 블록 모델(Kenney)을 조립한 장난감 같은 마을 (kit: 'toy')
// - 사실적, 노을: 실사 텍스처와 직접 만든 모델로 그린 진짜 같은 마을 (kit: 'real')

export type StyleId = 'diorama' | 'night' | 'light' | 'real' | 'dusk'

export type StyleDef = {
  id: StyleId
  /** 화면에 보이는 이름 */
  label: string
  /**
   * 어떤 모델 세트로 마을을 그릴지
   * - toy: 블록을 조립한 장난감 모델 (레고 느낌)
   * - real: 실사 텍스처를 입힌 사실적인 모델
   */
  kit: 'toy' | 'real'
  /** 배경색 (안개도 이 색으로 칠해서 멀리 있는 것이 배경에 녹아들게 합니다) */
  background: string
  /** 안개가 시작되는 거리와 완전히 덮는 거리 */
  fog: [number, number]
  /** true 면 배경이 밝아서 글자를 어두운 색으로 써야 합니다 */
  lightBackground: boolean
  /**
   * 물체 표면을 칠하는 방법 (toy 세트에서만 씁니다)
   * - standard: 부드러운 명암 (모형 느낌)
   * - toon: 명암을 3단계로 끊음 (만화 느낌)
   */
  material: 'standard' | 'toon'
  /** 창문·전구가 스스로 내는 빛의 세기 */
  glow: number
  /** true 면 밤 장면: 별이 뜨고, 가로등·집·트리 주변에 불빛이 켜집니다 */
  night: boolean
  colors: {
    ground: string
    plaza: string
    trunk: string
    /** 집 벽 색 (집마다 하나씩, 6채) */
    walls: string[]
    window: string
    ornaments: string[]
  }
}

export const STYLES: Record<StyleId, StyleDef> = {
  diorama: {
    id: 'diorama',
    label: '미니어처',
    kit: 'toy',
    // 맑은 겨울 하늘처럼 아주 옅은 하늘색 (예전 회보라색은 화면을 칙칙하게 만들었습니다)
    background: '#eaf3fc',
    fog: [48, 125],
    lightBackground: true,
    material: 'standard',
    glow: 0.5,
    night: false,
    colors: {
      ground: '#ffffff',
      plaza: '#f3e7d6',
      trunk: '#8a6b55',
      walls: ['#d9a9a0', '#a9b8d9', '#e3cfa0', '#b7cdbb', '#c9b3d6', '#e6bfa5'],
      window: '#fbe6b0',
      ornaments: ['#e8a0a0', '#f0cf8a', '#a9b8e8', '#f5f2ec'],
    },
  },
  // 미니어처 밤: 모양과 색은 미니어처 그대로, 조명만 밤으로 바꿉니다
  night: {
    id: 'night',
    label: '미니어처 밤',
    kit: 'toy',
    background: '#1c2550', // 짙은 남색 밤하늘
    fog: [44, 120],
    lightBackground: false,
    material: 'standard',
    glow: 2.6, // 전구가 밝게 빛나도록
    night: true,
    colors: {
      ground: '#ffffff',
      plaza: '#f3e7d6',
      trunk: '#8a6b55',
      walls: ['#d9a9a0', '#a9b8d9', '#e3cfa0', '#b7cdbb', '#c9b3d6', '#e6bfa5'],
      window: '#fbe6b0',
      ornaments: ['#e8a0a0', '#f0cf8a', '#a9b8e8', '#f5f2ec'],
    },
  },
  light: {
    id: 'light',
    label: '빛 (밤)',
    kit: 'toy',
    background: '#141a3c',
    fog: [48, 125],
    lightBackground: false,
    material: 'toon',
    glow: 4,
    night: true,
    colors: {
      ground: '#aab4e6',
      plaza: '#8f9ad6',
      trunk: '#4a3540',
      walls: ['#414684', '#3b4a7c', '#4a4280', '#3d4477', '#463f7c', '#3a477f'],
      window: '#ffe9a8',
      ornaments: ['#ffb38a', '#ffd97a', '#ff9db8', '#a8e0ff'],
    },
  },
  real: {
    id: 'real',
    label: '사실적',
    kit: 'real',
    // 한낮의 옅은 겨울 안개 색
    background: '#dde6ef',
    fog: [30, 115],
    lightBackground: true,
    material: 'standard',
    glow: 0.15,
    night: false,
    colors: {
      ground: '#ffffff',
      plaza: '#bdb6ad',
      trunk: '#6b5442',
      // 북유럽 시골집처럼 페인트칠한 나무 벽: 팔룬 레드, 황토, 슬레이트 블루, 크림, 세이지, 짙은 숲색
      walls: ['#8e2f24', '#c4933a', '#56708a', '#e4dac3', '#7d9171', '#3d4d44'],
      window: '#ffcf8a',
      // 유리 장식 공: 와인 레드, 금색, 은색, 짙은 초록
      ornaments: ['#9e1b25', '#d4a537', '#c9ccd2', '#1f5a3c'],
    },
  },
  dusk: {
    id: 'dusk',
    label: '노을',
    kit: 'real',
    // 해 질 녘 분홍빛이 섞인 보랏빛 안개
    background: '#b79bb5',
    fog: [22, 95],
    lightBackground: false,
    material: 'standard',
    glow: 3,
    night: false,
    colors: {
      ground: '#ffffff',
      plaza: '#bdb6ad',
      trunk: '#6b5442',
      walls: ['#8e2f24', '#c4933a', '#56708a', '#e4dac3', '#7d9171', '#3d4d44'],
      window: '#ffb45c',
      ornaments: ['#c4202d', '#f0b93a', '#e8e1d0', '#2a7a52'],
    },
  },
}

/** 주소의 ?style=... 값을 읽습니다. 없거나 모르는 값이면 null 입니다. */
export function currentStyle(): StyleDef | null {
  const id = new URLSearchParams(location.search).get('style')
  return id && id in STYLES ? STYLES[id as StyleId] : null
}

// Context: 화면 깊숙한 곳의 부품들도 "지금 그림체"를 꺼내 쓸 수 있게 해 주는 React 기능입니다.
export const StyleContext = createContext<StyleDef>(STYLES.diorama)

/** 지금 그림체를 꺼내 씁니다 */
export function useStyle() {
  return useContext(StyleContext)
}
