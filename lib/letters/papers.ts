// 편지지 종류입니다. (11.26 사용자 요청: 편지 쓰기 창에서 편지지를 고를 수 있게)
// 편지마다 "어떤 편지지에 썼는지"를 이 이름(키)으로 저장하고, 받는 사람도 같은 편지지로 봅니다.
// 실제 무늬·색은 화면 쪽 파일(components/letters/paperLook.ts)에 있습니다. 그림 파일 없이 코드로 그립니다.

/** 편지지 이름 목록: 기본(크림) / 눈 / 트리 / 지팡이 사탕 */
export const PAPER_KEYS = ["plain", "snow", "tree", "candy"] as const;

export type PaperKey = (typeof PAPER_KEYS)[number];

/** 고르지 않았을 때의 편지지 */
export const DEFAULT_PAPER: PaperKey = "plain";

/** 저장된 값이 올바른 편지지 이름인지 확인합니다. 모르는 값이면 기본 편지지로 바꿉니다 */
export function toPaperKey(value: unknown): PaperKey {
  return PAPER_KEYS.includes(value as PaperKey) ? (value as PaperKey) : DEFAULT_PAPER;
}
