// 캐릭터 꾸미기에서 고를 수 있는 것들의 목록입니다. (F016, 11.28 확정)
//  - 캐릭터: 여자·남자 중 하나 (머리카락·얼굴은 고른 쪽으로 고정, 체형은 하나)
//  - 부위 5가지: 상의·하의·장갑·목도리·신발. 부위마다 "모양"과 "색"을 고릅니다
// 💡 여기 적힌 모양 이름은 3D 모델 파일(public/models/handmade/chibi.glb) 안의 조각 꼬리표와 같아야 합니다.
//    모델은 scripts/blender/make_chibi.py가 만들고, 그 파일의 CATALOG·COLORS가 이 목록의 짝입니다.

import type { CharacterParts } from "@/types/domain";
import { readStorageJson, writeStorage } from "@/lib/storage";

export type PartKey = "top" | "bottom" | "gloves" | "scarf" | "shoes";
export type BaseKey = "girl" | "boy";

/** 고를 수 있는 캐릭터 */
export const BASE_KEYS: readonly BaseKey[] = ["girl", "boy"];

/** 부위 순서 (탭 순서): 상의·하의·장갑·목도리·신발 */
export const PART_KEYS: readonly PartKey[] = ["top", "bottom", "gloves", "scarf", "shoes"];

/** "안 함"을 뜻하는 모양 이름 (장갑·목도리만 가능) */
export const NONE = "none";

/** 부위별 모양 목록. 맨 앞이 기본 모양입니다 */
export const PART_SHAPES: Record<PartKey, readonly string[]> = {
  top: ["cardigan", "sweater", "puffer", "hoodie", "santa"],
  bottom: ["skirt", "shorts", "pants"],
  gloves: [NONE, "mitten", "knit"],
  scarf: [NONE, "muffler"],
  shoes: ["loafer", "boots", "sneaker"],
};

/** 고를 수 있는 색 10가지. 다섯 부위가 같은 목록을 씁니다 (색 값은 make_chibi.py의 COLORS와 같습니다) */
export const PART_COLORS = [
  { key: "red", hex: "#d4453e" },
  { key: "pink", hex: "#f4b9c1" },
  { key: "yellow", hex: "#e9b53c" },
  { key: "green", hex: "#3f7f62" },
  { key: "sky", hex: "#a9c3e6" },
  { key: "navy", hex: "#2f3f6b" },
  { key: "purple", hex: "#8f88cc" },
  { key: "brown", hex: "#8a5a3c" },
  { key: "cream", hex: "#f6ecd9" },
  { key: "black", hex: "#2b2b31" },
] as const;
export type ColorKey = (typeof PART_COLORS)[number]["key"];

/** 부위의 색이 저장되는 칸 이름. 예: "top" → "topColor" */
export const colorField = (part: PartKey) => `${part}Color` as `${PartKey}Color`;

/** 색 이름 → 색 값. 모르는 이름이면 첫 번째 색 */
export function colorHex(key: string): string {
  return (PART_COLORS.find((c) => c.key === key) ?? PART_COLORS[0]).hex;
}

/** 캐릭터별 기본 옷 (시안에서 보여 드린 모습): 여자는 분홍 가디건 + 남색 치마, 남자는 하늘색 가디건 + 남색 반바지 */
export const BASE_DEFAULTS: Record<BaseKey, CharacterParts> = {
  girl: {
    base: "girl",
    top: "cardigan",
    topColor: "pink",
    bottom: "skirt",
    bottomColor: "navy",
    gloves: NONE,
    glovesColor: "red",
    scarf: NONE,
    scarfColor: "red",
    shoes: "loafer",
    shoesColor: "black",
  },
  boy: {
    base: "boy",
    top: "cardigan",
    topColor: "sky",
    bottom: "shorts",
    bottomColor: "navy",
    gloves: NONE,
    glovesColor: "red",
    scarf: NONE,
    scarfColor: "red",
    shoes: "loafer",
    shoesColor: "black",
  },
};

/** 기본 모양: 꾸미지 않고 닫았을 때의 값 */
export const DEFAULT_PARTS: CharacterParts = BASE_DEFAULTS.girl;

/**
 * 저장해 둔 값이 올바른 꾸미기 값인지 확인합니다. 목록에 없는 값이 하나라도 있으면 기본 모양을 돌려줍니다.
 * (예전 방식으로 저장한 값은 캐릭터·색 칸이 없어서 기본 모양이 됩니다)
 */
export function parseCharacterParts(value: unknown): CharacterParts {
  if (typeof value !== "object" || value === null) return DEFAULT_PARTS;
  const record = value as Record<string, unknown>;
  if (!BASE_KEYS.some((b) => b === record.base)) return DEFAULT_PARTS;
  const parts: Record<string, unknown> = { base: record.base };
  for (const part of PART_KEYS) {
    const shape = record[part];
    const color = record[colorField(part)];
    if (!PART_SHAPES[part].some((s) => s === shape)) return DEFAULT_PARTS;
    if (!PART_COLORS.some((c) => c.key === color)) return DEFAULT_PARTS;
    parts[part] = shape;
    parts[colorField(part)] = color;
  }
  return parts as CharacterParts;
}

/**
 * 글자(id)로부터 늘 같은 "아무 옷"을 만듭니다. 개발용 가짜 주민이 서로 다른 옷을 입게 할 때 씁니다.
 * 같은 글자면 항상 같은 옷이 나옵니다.
 */
export function partsFromSeed(seed: string): CharacterParts {
  let h = 2166136261;
  const next = (n: number) => {
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h >>> 0) % n;
  };
  const parts: Record<string, string> = { base: BASE_KEYS[next(BASE_KEYS.length)] };
  for (const part of PART_KEYS) {
    parts[part] = PART_SHAPES[part][next(PART_SHAPES[part].length)];
    parts[colorField(part)] = PART_COLORS[next(PART_COLORS.length)].key;
  }
  return parts as CharacterParts;
}

// 꾸미기 값은 마을마다 따로 저장합니다 (D-05 확정). 연습용 마을은 이 브라우저에 저장합니다
const partsKey = (villageId: string) => `hyc.dummy.character.${villageId}`;

export function loadCharacterParts(villageId: string): CharacterParts {
  return parseCharacterParts(readStorageJson(partsKey(villageId)));
}

export function saveCharacterParts(villageId: string, parts: CharacterParts) {
  writeStorage(partsKey(villageId), JSON.stringify(parts));
}
