// 서버·DB가 아직 없을 때 마을 화면을 확인하기 위한 "가짜 마을 데이터"입니다.
// (로드맵 Task 004. 나중에 진짜 데이터(Supabase)로 바뀌어도 모양은 같게 유지합니다)
// 이름은 화면 문구가 아니라 "데이터"라서 여기에 그대로 둡니다.

import { MAX_DECOR_LEVEL } from "@/lib/decor/decorTable";
import type { VillageData, VillageResident } from "@/lib/village/data";

export const MIN_RESIDENTS = 1;
export const MAX_RESIDENTS = 20;
export const DEFAULT_RESIDENTS = 6;

/** 가짜 주민 이름 20개 (첫 번째가 "나") */
const DUMMY_NAMES = [
  "ゆうき", "하은", "さくら", "민준", "はると",
  "서연", "ひなた", "지우", "りん", "도윤",
  "あおい", "수아", "そうた", "예린", "みお",
  "현우", "ゆな", "지안", "れん", "소라",
];

/** 가짜 마을의 초대 코드 (진짜 코드가 아니라서 초대 화면에서는 "없는 초대"로 나옵니다) */
export const DEMO_INVITE_CODE = "demo";

/** 가짜 마을 이름 (초대 링크 입구·로그인 화면에서도 씁니다) */
export const DUMMY_VILLAGE_NAME = "Dummy Village";

/** 가짜 주민 (진짜 주민과 같은 모양 — lib/village/data.ts) */
export type DummyResident = VillageResident;

/** 가짜 마을: 진짜 마을과 같은 모양에, 가짜 편지용 값만 하나 더 있습니다 */
export type DummyVillage = VillageData & {
  /** 내가 편지를 보낸 주민의 id 목록 (가짜 편지의 처음 상태) */
  sentTo: string[];
};

/** min~max 범위 밖의 값을 범위 안으로 끌어 옵니다. 정수가 아니면 내림합니다. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/** 가짜 마을을 만듭니다. n = 주민 수(1~20), level = 장식 단계(0~10) */
export function getDummyVillage(options: { id: string; n: number; level: number }): DummyVillage {
  const n = clamp(options.n, MIN_RESIDENTS, MAX_RESIDENTS);
  const level = clamp(options.level, 0, MAX_DECOR_LEVEL);

  const residents: DummyResident[] = DUMMY_NAMES.slice(0, n).map((name, i) => ({
    id: `r${i + 1}`,
    name,
    isMe: i === 0,
    // 가짜 마을의 꾸미기 값은 이 브라우저에 따로 저장합니다 (lib/character/parts.ts)
    characterParts: null,
  }));

  return {
    id: options.id,
    name: DUMMY_VILLAGE_NAME,
    kind: "friends",
    inviteCode: DEMO_INVITE_CODE,
    isDemo: true,
    // 아래 네 값은 진짜 마을용 칸입니다. 연습용 마을의 편지는 lib/dummy/letters.ts가 따로 만듭니다
    doneCount: 0,
    lettersClosed: false,
    sentLetters: [],
    receivedLetters: [],
    residents,
    // 나(r1) 말고, 홀수 번째 주민 몇 명에게 보낸 것으로 가정
    sentTo: residents.filter((r, i) => !r.isMe && i % 2 === 1).map((r) => r.id),
    level,
  };
}

export type DummyOptions = {
  n: number;
  level: number;
  dev: boolean;
  tree: boolean;
  /** true면 마을 화면이 열릴 때 캐릭터 꾸미기 창을 바로 엽니다 (입주 직후 흐름 확인용) */
  customize: boolean;
  /** true면 12.25가 지난 것처럼 편지 잠금을 풉니다 (잠금 해제 뒤 화면 확인용) */
  unlock: boolean;
};

type SearchParams = Record<string, string | string[] | undefined>;

/** 주소 뒤의 ?n=6&level=3&dev=1&tree=1 같은 값을 읽습니다. 없으면 기본값(n=6, level=0, 나머지는 false). tree=1은 "트리 전체 보기" 카메라, customize=1은 꾸미기 창 바로 열기, unlock=1은 편지 잠금 풀기 확인용입니다. */
export function parseDummyOptions(params: SearchParams): DummyOptions {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const num = (v: string | string[] | undefined, fallback: number) => {
    const raw = first(v);
    if (raw === undefined || raw.trim() === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const dev = first(params.dev);
  return {
    n: clamp(num(params.n, DEFAULT_RESIDENTS), MIN_RESIDENTS, MAX_RESIDENTS),
    level: clamp(num(params.level, 0), 0, MAX_DECOR_LEVEL),
    // ?dev 처럼 값 없이 써도 켜지게 합니다 (0·false일 때만 꺼짐)
    dev: dev !== undefined && dev !== "0" && dev !== "false",
    tree: first(params.tree) === "1",
    customize: first(params.customize) === "1",
    unlock: first(params.unlock) === "1",
  };
}
