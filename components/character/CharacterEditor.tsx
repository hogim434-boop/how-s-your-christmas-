"use client";

// 캐릭터 꾸미기 창 안의 내용입니다. (F016, 지금은 "토대"만)
// 부위 6가지(머리카락·상의·하의·모자·목도리·장갑) 탭을 고르고, 그 부위의 모양을 하나 고릅니다.
// "확인"을 눌러야 저장되고, 그냥 닫으면 전에 있던 모양(처음이면 기본 모양)이 그대로 남습니다.
// ⚠️ 모양 목록은 임시(색 견본)입니다. 마을의 3D 캐릭터 모습에는 아직 반영되지 않습니다 (로드맵 D-06).

import { useState } from "react";
import { Ban, Check } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMessages } from "@/i18n/LocaleContext";
import { PART_KEYS, PART_OPTIONS, type PartKey } from "@/lib/character/parts";
import { UI_COLORS } from "@/lib/village/theme";
import { PRIMARY_BUTTON } from "@/components/ui/styles";
import type { CharacterParts } from "@/types/domain";

interface CharacterEditorProps {
  /** 창을 열었을 때의 모양 (저장된 값 또는 기본 모양) */
  initial: CharacterParts;
  /** 확인을 눌렀을 때: 고른 모양을 넘겨 줍니다 */
  onConfirm: (parts: CharacterParts) => void;
}

export function CharacterEditor({ initial, onConfirm }: CharacterEditorProps) {
  const t = useMessages();
  // 고르는 중인 모양 (확인을 누르기 전까지는 이 창 안에서만 바뀝니다)
  const [parts, setParts] = useState<CharacterParts>(initial);
  // 지금 보고 있는 부위 탭
  const [tab, setTab] = useState<PartKey>("hair");

  const partNames: Record<PartKey, string> = {
    hair: t.partHair,
    top: t.partTop,
    bottom: t.partBottom,
    hat: t.partHat,
    scarf: t.partScarf,
    gloves: t.partGloves,
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 부위 탭 6개: 휴대폰 폭에서도 누르기 편하게 3칸씩 두 줄 */}
      <SegmentedControl
        ariaLabel={t.customize}
        value={tab}
        onChange={setTab}
        columns={3}
        options={PART_KEYS.map((part) => ({ value: part, label: partNames[part] }))}
      />

      {/* 지금 부위의 모양 목록 */}
      <div role="radiogroup" aria-label={partNames[tab]} className="grid grid-cols-5 gap-2 py-1">
        {PART_OPTIONS[tab].map((option, i) => {
          const selected = parts[tab] === option.key;
          // "없음"이 맨 앞에 있는 부위는 번호가 1부터 시작하도록 맞춥니다
          const hasNone = PART_OPTIONS[tab][0].color === null;
          const label = option.color === null ? t.partNone : `${partNames[tab]} ${hasNone ? i : i + 1}`;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              onClick={() => setParts((prev) => ({ ...prev, [tab]: option.key }))}
              // 고른 칸은 남색 테두리 + 흰 바탕, 나머지는 옅은 회색 바탕
              className={
                "relative flex aspect-square min-h-11 items-center justify-center rounded-2xl border-2 transition active:scale-95 " +
                (selected ? "border-[#232b52] bg-white" : "border-transparent bg-[#f3f4f8]")
              }
            >
              {option.color === null ? (
                <Ban className="size-6" style={{ color: "#b4b8c8" }} aria-hidden="true" />
              ) : (
                <span className="size-8 rounded-full ring-1 ring-black/5" style={{ backgroundColor: option.color }} />
              )}
              {selected && (
                <span
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-white ring-2 ring-white"
                  style={{ backgroundColor: UI_COLORS.navy }}
                >
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 지금까지 고른 6부위 한눈에 보기 */}
      <ul className="grid grid-cols-6 gap-1 rounded-2xl px-2 py-2.5" style={{ backgroundColor: UI_COLORS.surface }}>
        {PART_KEYS.map((part) => {
          const color = PART_OPTIONS[part].find((o) => o.key === parts[part])?.color ?? null;
          return (
            <li key={part} className="flex flex-col items-center gap-1.5">
              <span
                className="size-5 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: color ?? "#ffffff" }}
              />
              <span className="w-full truncate text-center text-[10px] leading-tight" style={{ color: UI_COLORS.muted }}>
                {partNames[part]}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="px-1 text-xs" style={{ color: UI_COLORS.muted }}>
        {t.customizeComingSoon}
      </p>

      <button type="button" onClick={() => onConfirm(parts)} className={PRIMARY_BUTTON}>
        {t.customizeConfirm}
      </button>
    </div>
  );
}
