// 크리스마스(12월 25일 0시, 한국 시간 KST)까지 며칠 남았는지 계산하는 순수 함수입니다.
// 기준 시각을 인자로 받아서(now), 테스트에서 원하는 날짜를 넣어 볼 수 있습니다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Dday = {
  /** 남은 날 수 (12.25 당일·이후는 0) */
  days: number;
  /** 12.25 당일이거나 지났으면 true → "D-Day" 표시 */
  isDDay: boolean;
};

/** now 시각이 한국 시간으로 며칠인지 기준으로, 그해 12월 25일까지 남은 날을 구합니다. */
export function daysUntilChristmas(now: Date): Dday {
  // 한국 시간의 "날짜"를 얻기 위해 9시간을 더한 뒤 UTC 날짜 값으로 읽습니다
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const today = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  const christmas = Date.UTC(kst.getUTCFullYear(), 11, 25);
  const days = Math.round((christmas - today) / DAY_MS);
  return days > 0 ? { days, isDDay: false } : { days: 0, isDDay: true };
}
