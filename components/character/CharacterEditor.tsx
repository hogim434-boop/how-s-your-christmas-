"use client";

// 캐릭터 꾸미기 창 안의 내용입니다. (F016)
// 게임의 "옷 갈아입히기" 화면처럼 구성했습니다. (11.29 사용자 요청: 더 세련되고 현대적으로)
//  1) 무대: 지금 고른 모습의 캐릭터를 크게. 끌어서 돌려 볼 수 있고, 무대 위 왼쪽에서 여자·남자를 고릅니다
//  2) 부위 탭: 그림(아이콘)으로 된 5개 — 상의·하의·장갑·목도리·신발
//  3) 옷 카드: 그 부위의 옷을 "그림"으로 보여 주는 가로 줄. 지금 고른 색으로 그려집니다 (많으면 옆으로 밀어 봅니다)
//  4) 색: 한 줄에 10가지
// "확인"을 눌러야 저장되고, 그냥 닫으면 전에 있던 모습(처음이면 기본 모습)이 그대로 남습니다.

import { useEffect, useRef, useState } from "react";
import { Ban, Check, Rotate3d } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMessages } from "@/i18n/LocaleContext";
import {
  BASE_KEYS,
  NONE,
  PART_COLORS,
  PART_KEYS,
  PART_SHAPES,
  colorField,
  type BaseKey,
  type PartKey,
} from "@/lib/character/parts";
import { UI_COLORS } from "@/lib/village/theme";
import { PRIMARY_BUTTON } from "@/components/ui/styles";
import type { CharacterParts } from "@/types/domain";
import { CharacterPreview } from "./CharacterPreview";
import { PartIcon } from "./PartIcon";

/** 옷 카드 그림 주소 (scripts/blender/make_chibi.py의 --thumbs가 모양 × 색마다 뽑아 둔 그림) */
const thumbUrl = (part: PartKey, shape: string, color: string) => `/character/thumbs/${part}_${shape}_${color}.webp`;

/** 밝은 색 (이 색 위의 체크 표시는 흰색 대신 남색으로 그립니다) */
const LIGHT_COLORS = ["pink", "yellow", "sky", "cream"];

interface CharacterEditorProps {
  /** 창을 열었을 때의 모습 (저장된 값 또는 기본 모습) */
  initial: CharacterParts;
  /** 확인을 눌렀을 때: 고른 모습을 넘겨 줍니다 */
  onConfirm: (parts: CharacterParts) => void;
}

export function CharacterEditor({ initial, onConfirm }: CharacterEditorProps) {
  const t = useMessages();
  // 고르는 중인 모습 (확인을 누르기 전까지는 이 창 안에서만 바뀝니다)
  const [parts, setParts] = useState<CharacterParts>(initial);
  // 지금 보고 있는 부위 탭
  const [tab, setTab] = useState<PartKey>("top");

  const partNames: Record<PartKey, string> = {
    top: t.partTop,
    bottom: t.partBottom,
    gloves: t.partGloves,
    scarf: t.partScarf,
    shoes: t.partShoes,
  };
  const baseNames: Record<BaseKey, string> = { girl: t.baseGirl, boy: t.baseBoy };

  // 부위 탭을 바꾸면, 그 부위에서 지금 입고 있는 옷 카드가 보이도록 카드 줄을 옆으로 밀어 줍니다
  const cards = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = cards.current;
    const card = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !card) return;
    row.scrollTo({ left: card.offsetLeft - (row.clientWidth - card.offsetWidth) / 2 });
  }, [tab]);

  const shape = parts[tab];
  const color = parts[colorField(tab)];
  const set = (field: keyof CharacterParts, value: string) => setParts((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="flex flex-col gap-4">
      {/* 1) 무대 */}
      <CharacterPreview parts={parts} label={t.customize}>
        {/* 캐릭터 고르기: 옷은 그대로 두고 머리카락·얼굴만 바뀝니다 */}
        <div className="absolute left-3 top-3">
          <SegmentedControl
            compact
            ariaLabel={t.characterBase}
            value={parts.base as BaseKey}
            onChange={(base) => set("base", base)}
            options={BASE_KEYS.map((base) => ({ value: base, label: baseNames[base] }))}
          />
        </div>
        {/* "끌어서 돌려 볼 수 있어요" 표시 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/70"
          style={{ color: UI_COLORS.muted }}
        >
          <Rotate3d className="size-4" />
        </span>
      </CharacterPreview>

      {/* 2) 부위 탭: 그림 + 이름. 고른 탭은 남색 동그라미로 채워집니다 */}
      <div role="radiogroup" aria-label={t.customize} className="grid grid-cols-5">
        {PART_KEYS.map((part) => {
          const selected = tab === part;
          return (
            <button
              key={part}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTab(part)}
              className="flex flex-col items-center gap-1 transition active:scale-95"
            >
              <span
                className="flex size-12 items-center justify-center rounded-full transition-colors"
                style={{
                  backgroundColor: selected ? UI_COLORS.navy : UI_COLORS.surface,
                  color: selected ? "#ffffff" : UI_COLORS.muted,
                }}
              >
                <PartIcon part={part} className="size-6" />
              </span>
              <span
                className="w-full truncate text-center text-[11px] font-semibold"
                style={{ color: selected ? UI_COLORS.navy : UI_COLORS.muted }}
              >
                {partNames[part]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3) 옷 카드: 가로로 밀어 보는 줄. 양옆은 창 여백(-mx-5)까지 써서, 넘치는 카드가 잘려 보이며 "더 있다"는 것을 알려 줍니다 */}
      <div
        ref={cards}
        role="radiogroup"
        aria-label={`${partNames[tab]} ${t.partShape}`}
        className="-mx-5 flex snap-x scroll-px-5 gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {PART_SHAPES[tab].map((option) => {
          const selected = shape === option;
          const name = option === NONE ? t.partNone : t.shapeNames[option];
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              onClick={() => set(tab, option)}
              // 고른 카드는 흰 바탕 + 남색 테두리 + 옅은 그림자, 나머지는 옅은 회색 바탕
              className={
                "relative flex w-[88px] shrink-0 snap-start flex-col items-center gap-1 rounded-[20px] border-2 px-1.5 pb-2 pt-1.5 transition active:scale-95 " +
                (selected
                  ? "border-[#232b52] bg-white shadow-[0_4px_14px_rgba(20,26,54,0.14)]"
                  : "border-transparent bg-[#f3f4f8]")
              }
            >
              <span className="flex size-[68px] items-center justify-center">
                {option === NONE ? (
                  <Ban className="size-7" style={{ color: "#b4b8c8" }} aria-hidden="true" />
                ) : (
                  // 작은 그림이라 Next의 이미지 최적화를 거치지 않고 그대로 씁니다
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl(tab, option, color)} alt="" width={68} height={68} draggable={false} className="size-[68px]" />
                )}
              </span>
              <span
                className="line-clamp-1 w-full text-center text-[11px] font-semibold leading-tight"
                style={{ color: selected ? UI_COLORS.navy : UI_COLORS.muted }}
              >
                {name}
              </span>
              {selected && (
                <span
                  className="absolute right-1.5 top-1.5 flex size-[18px] items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: UI_COLORS.navy }}
                >
                  <Check className="size-3" strokeWidth={3.5} aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4) 색 10가지 한 줄. "없음"을 고른 부위는 색을 고를 것이 없어 흐리게 막아 둡니다 */}
      <div
        role="radiogroup"
        aria-label={`${partNames[tab]} ${t.partColor}`}
        aria-disabled={shape === NONE}
        className={
          "flex items-center justify-between rounded-full px-2 py-1 transition-opacity " +
          (shape === NONE ? "pointer-events-none opacity-30" : "")
        }
        style={{ backgroundColor: UI_COLORS.surface }}
      >
        {PART_COLORS.map((option) => {
          const selected = color === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t.colorNames[option.key]}
              disabled={shape === NONE}
              onClick={() => set(colorField(tab), option.key)}
              // 누르는 영역은 세로 44px, 보이는 색 동그라미는 26px (고르면 조금 커지고 흰 테두리가 생깁니다)
              className="flex h-11 min-w-0 flex-1 items-center justify-center transition active:scale-90"
            >
              <span
                className={
                  "flex items-center justify-center rounded-full transition-all " +
                  (selected ? "size-8 ring-[3px] ring-white shadow-[0_2px_8px_rgba(20,26,54,0.28)]" : "size-[26px] ring-1 ring-black/10")
                }
                style={{ backgroundColor: option.hex }}
              >
                {selected && (
                  <Check
                    className="size-4"
                    strokeWidth={3}
                    style={{ color: LIGHT_COLORS.includes(option.key) ? UI_COLORS.navy : "#ffffff" }}
                    aria-hidden="true"
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" onClick={() => onConfirm(parts)} className={PRIMARY_BUTTON}>
        {t.customizeConfirm}
      </button>
    </div>
  );
}
