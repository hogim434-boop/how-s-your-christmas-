// 캐릭터 꾸미기의 "부위 6가지"와 부위마다 고를 수 있는 모양 목록입니다. (F016)
// ⚠️ 모양·개수는 아직 정해지지 않았습니다(로드맵 D-06). 지금은 화면을 눌러 보기 위한 임시 목록이고,
//    디자인이 정해지면 이 파일의 PART_OPTIONS만 바꾸면 됩니다.

import type { CharacterParts } from "@/types/domain";
import { readStorageJson, writeStorage } from "@/lib/storage";

export type PartKey = keyof CharacterParts;

/** 부위 순서 (탭 순서): 머리카락·상의·하의·모자·목도리·장갑 */
export const PART_KEYS: readonly PartKey[] = ["hair", "top", "bottom", "hat", "scarf", "gloves"];

export type PartOption = {
  /** 저장되는 이름(키). 예: "hair_1" */
  key: string;
  /** 목록에 보여 줄 색 견본. null이면 "없음"(착용 안 함) */
  color: string | null;
};

/** 임시 색 견본 */
const SWATCHES = ["#5b3a29", "#e8504a", "#4fb477", "#6c9be8"];

/** 모양 목록을 만듭니다. allowNone이면 맨 앞에 "없음"을 넣습니다 (모자·목도리·장갑은 안 할 수도 있음) */
function options(part: PartKey, allowNone: boolean): PartOption[] {
  const list: PartOption[] = SWATCHES.map((color, i) => ({ key: `${part}_${i + 1}`, color }));
  return allowNone ? [{ key: "none", color: null }, ...list] : list;
}

/** 부위별 모양 목록 (임시) */
export const PART_OPTIONS: Record<PartKey, PartOption[]> = {
  hair: options("hair", false),
  top: options("top", false),
  bottom: options("bottom", false),
  hat: options("hat", true),
  scarf: options("scarf", true),
  gloves: options("gloves", true),
};

/** 기본 모양: 꾸미지 않고 닫았을 때의 값 (부위마다 목록의 첫 번째) */
export const DEFAULT_PARTS: CharacterParts = {
  hair: PART_OPTIONS.hair[0].key,
  top: PART_OPTIONS.top[0].key,
  bottom: PART_OPTIONS.bottom[0].key,
  hat: PART_OPTIONS.hat[0].key,
  scarf: PART_OPTIONS.scarf[0].key,
  gloves: PART_OPTIONS.gloves[0].key,
};

/** 저장해 둔 값이 올바른 꾸미기 값인지 확인합니다. 목록에 없는 모양이 하나라도 있으면 기본 모양을 돌려줍니다 */
export function parseCharacterParts(value: unknown): CharacterParts {
  if (typeof value !== "object" || value === null) return DEFAULT_PARTS;
  const record = value as Record<string, unknown>;
  const ok = PART_KEYS.every((part) => PART_OPTIONS[part].some((o) => o.key === record[part]));
  if (!ok) return DEFAULT_PARTS;
  return Object.fromEntries(PART_KEYS.map((part) => [part, record[part]])) as CharacterParts;
}

// 꾸미기 값은 마을마다 따로 저장합니다 (D-05 확정)
const partsKey = (villageId: string) => `hyc.dummy.character.${villageId}`;

export function loadCharacterParts(villageId: string): CharacterParts {
  return parseCharacterParts(readStorageJson(partsKey(villageId)));
}

export function saveCharacterParts(villageId: string, parts: CharacterParts) {
  writeStorage(partsKey(villageId), JSON.stringify(parts));
}
