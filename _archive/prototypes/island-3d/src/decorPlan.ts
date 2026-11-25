// 장식표: 진행률(10% 단위)마다 마을에 무엇이 생기는지 정리한 파일입니다.
// level 은 0~10 이고, 진행률 = level x 10% 입니다. 각 단계는 앞 단계 장식이 모두 남은 채로 쌓입니다.
//
// | 진행률 | 장식                                         |
// | 10%   | 가로등 사이 알전구 줄 + 트리 아래 선물 (10%마다 1개씩 추가) |
// | 20%   | 빨간 방울 3개                                  |
// | 30%   | 노란 종 3개                                    |
// | 40%   | 집 옆에 인형 또는 트리, 집 정면(처마)에 전구 줄         |
// | 50%   | 산타 양말 3개                                  |
// | 60%   | 눈송이 3개                                     |
// | 70%   | 쿠키 3개                                       |
// | 80%   | 산타 & 루돌프 인형                              |
// | 90%   | 트리에 전구 줄                                  |
// | 100%  | 대왕별 + 폭죽                                   |

/** 트리에 거는 장식 모양 */
export type OrnamentKind =
  | 'ball'
  | 'envelope'
  | 'star'
  | 'bell'
  | 'heart'
  | 'gift'
  | 'candy'
  | 'snowflake'
  | 'drop'
  | 'cookie'
  | 'sock'

/** 각 단계에서 무엇이 생기는지 (화면 아래 설명 글에 씁니다) */
export const LEVEL_LABELS = [
  '아직 장식이 없는 마을',
  '가로등 알전구 줄 + 선물',
  '빨간 방울 3개',
  '노란 종 3개',
  '집 옆 인형·트리 + 집 정면 전구 줄',
  '산타 양말 3개',
  '눈송이 3개',
  '쿠키 3개',
  '산타 & 루돌프 인형',
  '트리에 전구 줄',
  '대왕별 + 폭죽',
]

/** 이 단계부터 보이는 장식들 */
export const UNLOCK = {
  stringLights: 1, // 가로등 사이 알전구 줄
  houseDecor: 4, // 집 옆 인형·트리 + 집 정면 전구 줄
  santa: 8, // 산타 & 루돌프 인형
  treeGarland: 9, // 트리에 전구 줄
  starAndFireworks: 10, // 대왕별 + 폭죽
}

/** 트리 아래 선물 개수: 10%마다 1개 */
export const giftCount = (level: number) => level

/** 트리에 거는 장식 목록 (순서대로 트리 위 자리를 하나씩 차지합니다) */
export const TREE_ORNAMENT_PLAN: { kind: OrnamentKind; color: string; level: number }[] = [
  ...Array.from({ length: 3 }, () => ({ kind: 'ball' as const, color: '#d6453c', level: 2 })), // 빨간 방울
  ...Array.from({ length: 3 }, () => ({ kind: 'bell' as const, color: '#f2c14e', level: 3 })), // 노란 종
  ...Array.from({ length: 3 }, () => ({ kind: 'sock' as const, color: '#c8453c', level: 5 })), // 산타 양말
  ...Array.from({ length: 3 }, () => ({ kind: 'snowflake' as const, color: '#ffffff', level: 6 })), // 눈송이
  ...Array.from({ length: 3 }, () => ({ kind: 'cookie' as const, color: '#b9773f', level: 7 })), // 쿠키
]
