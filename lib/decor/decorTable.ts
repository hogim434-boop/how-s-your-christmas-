// 장식표: 진행률 단계(1~10)마다 마을에 어떤 장식이 보이는지 정해 둔 표입니다.
// 근거: docs/prd.md "장식표" [확정 11.23 추가 논의] (노션 "장식표" 데이터베이스 기준)
//
// 장식 규칙을 바꾸고 싶으면 이 파일만 고치면 됩니다. (화면 코드는 이 표를 읽어서 그립니다)
// 화면에 보이는 장식 이름(일본어·한국어)은 3D 화면을 만들 때 i18n/messages.ts에 넣습니다.

/** 가장 높은 장식 단계 (100%) */
export const MAX_DECOR_LEVEL = 10;

/** 커플 마을에서 둘이 합쳐 써야 하는 개수: 질문지 4개 × 2명 + 편지 1통 × 2명 */
export const COUPLE_TOTAL_ITEMS = 10;

/** 새 선물을 바닥이 아니라 기존 선물 "위에" 쌓는 단계 (40%, 70%, 100%) */
export const GIFT_STACK_LEVELS: readonly number[] = [4, 7, 10];

/** 장식 종류 이름(키). 3D 모델과 문구를 찾을 때 이 이름을 씁니다. */
export type DecorKey =
  | "string_lights" // 가로등 사이 알전구 줄
  | "red_bauble" // 빨간 방울
  | "yellow_bell" // 노란 종
  | "house_decor" // 집 옆 인형 또는 트리 + 집 정면 전구 줄
  | "stocking" // 산타 양말
  | "snowflake" // 눈송이
  | "cookie" // 쿠키
  | "santa_rudolph" // 산타 & 루돌프 인형
  | "tree_garland" // 트리를 감싸는 빛나는 줄
  | "star"; // 대왕별 (+ 폭죽)

export type DecorStage = {
  /** 단계 (1 = 10%, 10 = 100%) */
  level: number;
  key: DecorKey;
  /** 개수. 집마다 달리는 장식처럼 개수가 정해지지 않으면 null */
  count: number | null;
  /** 대왕 트리에 거는 장식(오너먼트)인지. false면 트리 밖 마을 장식 */
  ornament: boolean;
};

/**
 * 단계별 장식 목록. 앞 단계 장식은 그대로 남고 쌓입니다.
 * (선물은 이 표와 별개로 단계마다 1개씩 늘어납니다 → giftLayout 참고)
 */
export const DECOR_STAGES: readonly DecorStage[] = [
  { level: 1, key: "string_lights", count: null, ornament: false },
  { level: 2, key: "red_bauble", count: 3, ornament: true },
  { level: 3, key: "yellow_bell", count: 3, ornament: true },
  { level: 4, key: "house_decor", count: null, ornament: false },
  { level: 5, key: "stocking", count: 3, ornament: true },
  { level: 6, key: "snowflake", count: 3, ornament: true },
  { level: 7, key: "cookie", count: 3, ornament: true },
  { level: 8, key: "santa_rudolph", count: 1, ornament: false },
  { level: 9, key: "tree_garland", count: 1, ornament: false },
  { level: 10, key: "star", count: 1, ornament: false },
];

/** 지금 단계에서 마을에 보여야 하는 장식 목록 (1단계부터 지금 단계까지) */
export function visibleStages(level: number): DecorStage[] {
  return DECOR_STAGES.filter((stage) => stage.level <= level);
}

export type GiftPlacement = {
  /** 몇 단계에서 생긴 선물인지 */
  level: number;
  /** true면 기존 선물 위에 쌓음, false면 바닥에 놓음 */
  stacked: boolean;
};

/**
 * 트리 아래 선물 배치. 단계마다 선물이 1개씩 늘고,
 * 40%·70%·100% 단계의 선물만 기존 선물 위에 쌓습니다.
 * 예: giftLayout(4) → 바닥 3개 + 4번째는 위에 쌓음
 */
export function giftLayout(level: number): GiftPlacement[] {
  const gifts: GiftPlacement[] = [];
  for (let i = 1; i <= Math.min(level, MAX_DECOR_LEVEL); i++) {
    gifts.push({ level: i, stacked: GIFT_STACK_LEVELS.includes(i) });
  }
  return gifts;
}
