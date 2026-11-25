// 마을 화면의 색깔 모음입니다. (미니어처 그림체 기준)
// 색을 바꾸고 싶으면 화면 코드가 아니라 이 파일만 고치면 됩니다.

/** 3D 마을의 색 */
export const VILLAGE_COLORS = {
  /** 하늘·배경·안개 색 */
  sky: "#eaf3fc",
  /** 눈 덮인 땅 */
  ground: "#ffffff",
  /** 가운데 광장 (베이지) */
  plaza: "#f3e7d6",
  /** 나무 기둥 */
  trunk: "#8a6b55",
  /** 집 벽 색 (집마다 돌아가며 하나씩 씁니다) */
  walls: ["#d9a9a0", "#a9b8d9", "#e3cfa0", "#b7cdbb", "#c9b3d6", "#e6bfa5"],
  /** 창문 불빛 */
  window: "#fbe6b0",
  /** 장식 방울 색 */
  ornaments: ["#e8a0a0", "#f0cf8a", "#a9b8e8", "#f5f2ec"],
  /** 우체통 빨강 / 흰색 / 보낸 표시 불빛 */
  mailboxRed: "#c8453c",
  mailboxWhite: "#ffffff",
  sentLight: "#ffd45c",
} as const;

/** 하늘 종류: 아침 / 밤 (11.25 사용자 요청: 메뉴에서 고르기) */
export type SkyMode = "day" | "night";
export const SKY_MODES: readonly SkyMode[] = ["day", "night"];

/**
 * 아침·밤 하늘. (11.25 사용자 요청: 메뉴에서 고르기)
 * - sky: 배경·안개 색 (멀리 있는 숲·땅이 이 색으로 흐려집니다)
 * - fog: 안개가 시작되는 거리, 완전히 덮는 거리
 * - lightText: true면 위쪽 글자(D-day 등)를 밝은 색으로
 * 빛·날씨는 각각 아침 = VillageScene, 밤 = NightAtmosphere.tsx 에 있습니다.
 */
export const SKY_THEMES = {
  /** 아침: 지금까지의 밝은 미니어처 */
  day: { sky: "#eaf3fc", fog: [55, 135] as [number, number], lightText: false },
  /** 밤: 예전 시안 "미니어처 밤" (짙은 남색 밤하늘) */
  night: { sky: "#1c2550", fog: [44, 120] as [number, number], lightText: true },
} as const;

/** 가로등 불빛 색 (따뜻한 노란빛) */
export const LAMP_LIGHT_COLOR = "#ffc98a";


/** 화면(DOM) 쪽 색 */
export const UI_COLORS = {
  navy: "#232b52",
  cream: "#fff6e5",
  /** 창 안의 옅은 회색 바탕 (입력칸·목록·고르기 버튼 묶음) */
  surface: "#f3f4f8",
  /** 덜 중요한 설명 글자 */
  muted: "#6d7388",
  /** 강조색: 크리스마스 빨강 (진행률 막대, 지우기) */
  accent: "#c8324a",
} as const;
