// 진행률 게이지 창(F008)에 보여 줄 줄을 계산합니다. (로드맵 Task 016)
// 화면 위쪽의 진행률 알약을 누르면 뜨는 창에서, 10%~100% 단계마다 "어떤 장식이 생기는지"와 "이미 달성했는지"를 보여 줍니다.
//
// 계산만 하는 순수 함수라서 테스트(gauge.test.ts)로 확인합니다. 화면은 components/village/hud/GaugePanel.tsx가 그립니다.

import { DECOR_STAGES, MAX_DECOR_LEVEL, type DecorKey } from "./decorTable";

/** 게이지 창의 한 줄 */
export type GaugeRow = {
  /** 단계 (1 = 10%, 10 = 100%) */
  level: number;
  /** 이 단계의 진행률 (10, 20, … 100) */
  percent: number;
  /** 이 단계에 생기는 장식 종류 */
  key: DecorKey;
  /** 지금 단계가 여기까지 왔는지 (true면 달성, false면 잠김) */
  reached: boolean;
};

/** 받은 값을 0~10 사이의 정수 단계로 다듬습니다 (숫자가 아니면 0) */
function toLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(MAX_DECOR_LEVEL, Math.max(0, Math.floor(level)));
}

/** 지금 단계에서 이 단계(stage)를 달성했는지 */
export function isReached(level: number, stage: number): boolean {
  return stage >= 1 && stage <= toLevel(level);
}

/**
 * 게이지 창의 10줄을 만듭니다. 순서는 장식표(DECOR_STAGES)와 같습니다.
 * 예: gaugeRows(4) → 앞 4줄(10~40%)은 reached = true, 나머지 6줄은 false
 */
export function gaugeRows(level: number): GaugeRow[] {
  return DECOR_STAGES.map((stage) => ({
    level: stage.level,
    percent: stage.level * 10,
    key: stage.key,
    reached: isReached(level, stage.level),
  }));
}
