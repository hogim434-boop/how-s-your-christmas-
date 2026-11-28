"use client";

// 마을 목록 창 안의 내용입니다. (F017 마을 목록·전환, 로드맵 Task 017)
//
// 마을마다 한 칸(카드)씩 보여 줍니다. (11.28 사용자 요청)
//   - 위: 마을 그림 (VillageThumb — 장식 단계·주민 수·마을 종류에 따라 달라지는 삽화)
//   - 아래: 마을 이름, 종류, 주민 수, 이 마을에서 쓰는 내 이름, 진행률
// 칸을 누르면 그 마을로 이동합니다. 맨 아래 칸은 "새 마을 만들기"입니다.
//
// 이 부품은 "보여 주기"만 합니다. 목록을 불러오고 이동하는 일은 부르는 쪽(VillageView)이 합니다.

import { Plus, Users } from "lucide-react";
import { useMessages } from "@/i18n/LocaleContext";
import { UI_COLORS } from "@/lib/village/theme";
import type { VillageListItem } from "@/lib/villages/list";
import { VillageThumb } from "./VillageThumb";

interface VillageListPanelProps {
  /** 보여 줄 마을들. 아직 불러오는 중이거나 실패했으면 null */
  items: VillageListItem[] | null;
  /** 불러오는 중 / 다 불러옴 / 실패 */
  status: "loading" | "ready" | "error";
  /** 마을 칸을 눌렀을 때 */
  onSelect: (id: string) => void;
  /** "다시 시도"를 눌렀을 때 */
  onRetry: () => void;
}

/** 칸 공통 모양: 둥근 모서리의 흰 카드 */
const CARD = "overflow-hidden rounded-[20px] border bg-white text-left";

export function VillageListPanel({ items, status, onSelect, onRetry }: VillageListPanelProps) {
  const t = useMessages();

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm" style={{ color: UI_COLORS.muted }}>
          {t.villageListError}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-full px-5 text-sm font-semibold transition active:scale-95"
          style={{ backgroundColor: UI_COLORS.navy, color: UI_COLORS.cream }}
        >
          {t.villageRetry}
        </button>
      </div>
    );
  }

  if (status === "loading" || !items) {
    return (
      // 불러오는 동안: 칸 모양의 옅은 자리 표시 (갑자기 내용이 튀어나오지 않게 자리를 잡아 둡니다)
      <div className="flex flex-col gap-3" role="status" aria-label={t.villages}>
        {[0, 1].map((i) => (
          <div key={i} className={`${CARD} animate-pulse border-black/5`}>
            <div className="aspect-[2/1] w-full" style={{ backgroundColor: UI_COLORS.surface }} />
            <div className="flex flex-col gap-2 p-4">
              <div className="h-4 w-1/2 rounded-full" style={{ backgroundColor: UI_COLORS.surface }} />
              <div className="h-3 w-2/3 rounded-full" style={{ backgroundColor: UI_COLORS.surface }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((village) => {
        const kindName = village.kind === "couple" ? t.kindCouple : t.kindFriends;
        const residents = t.villageResidentCount.replace("{n}", String(village.residentCount));
        return (
          <li key={village.id}>
            <button
              type="button"
              onClick={() => onSelect(village.id)}
              // 화면 읽기 도구에는 "마을 이름, 종류, 진행률"을 한 문장으로 읽어 줍니다
              aria-label={`${village.name}, ${kindName}, ${village.percent}%${village.isCurrent ? `, ${t.villageCurrent}` : ""}`}
              aria-current={village.isCurrent ? "true" : undefined}
              className={`${CARD} block w-full transition active:scale-[0.98]`}
              style={{
                borderColor: village.isCurrent ? UI_COLORS.navy : "rgba(0,0,0,0.06)",
                // 지금 마을은 테두리를 두껍게 보이도록 바깥에 선을 한 줄 더 둡니다
                boxShadow: village.isCurrent ? `0 0 0 1.5px ${UI_COLORS.navy}` : "0 2px 10px rgba(20,26,54,0.06)",
              }}
            >
              {/* 위: 마을 그림 */}
              <span className="relative block aspect-[2/1] w-full">
                <VillageThumb
                  id={village.id}
                  kind={village.kind}
                  residentCount={village.residentCount}
                  level={village.level}
                  className="absolute inset-0 size-full"
                />
                {village.isCurrent && (
                  <span
                    className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ backgroundColor: UI_COLORS.cream, color: UI_COLORS.navy }}
                  >
                    {t.villageCurrent}
                  </span>
                )}
              </span>

              {/* 아래: 설명 */}
              <span className="flex flex-col gap-2 p-4" style={{ color: UI_COLORS.navy }}>
                <span className="flex items-center gap-2">
                  {/* min-w-0 + truncate: 이름이 길면 칸을 넘지 않고 …으로 줄입니다 */}
                  <span className="min-w-0 flex-1 truncate text-base font-bold">{village.name}</span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: UI_COLORS.surface, color: UI_COLORS.muted }}
                  >
                    {kindName}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: UI_COLORS.muted }}>
                  <Users className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="shrink-0">{residents}</span>
                  {village.myNickname && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="min-w-0 truncate">{t.villageMyName.replace("{name}", village.myNickname)}</span>
                    </>
                  )}
                </span>
                {/* 진행률: 막대 + 숫자 */}
                <span className="flex items-center gap-2.5">
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: UI_COLORS.surface }}>
                    <span className="block h-full rounded-full" style={{ width: `${village.percent}%`, backgroundColor: UI_COLORS.accent }} />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums">{village.percent}%</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}

      {/* 맨 아래: 새 마을 만들기 (점선 테두리의 빈 칸 모양) */}
      <li>
        {/* 일반 <a> 태그: 마을 화면(3D)을 완전히 떠나 새 화면을 여는 이동입니다 */}
        <a
          href="/villages/new"
          className="flex min-h-16 items-center justify-center gap-2 rounded-[20px] border-2 border-dashed text-sm font-semibold transition active:scale-[0.98]"
          style={{ borderColor: "#cfd3e0", color: UI_COLORS.muted }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t.villageNew}
        </a>
      </li>
    </ul>
  );
}
