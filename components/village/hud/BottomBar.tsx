"use client";

// 화면 아래쪽에 떠 있는 것들입니다.
// 11.26 사용자 요청: 화면 위 버튼이 너무 많아 조잡 → 버튼을 둘만 남기고 나머지는 메뉴로 모았습니다.
//   - 왼쪽 아래: 트리 전체 보기 ↔ 마을로 돌아가기 (자주 눌러 보는 버튼이라 밖에 둠)
//   - 오른쪽 아래: 메뉴 (편지함·꾸미기·초대·설정이 모두 이 안에 있음)
//   - 가운데 아래: 작은 걷기 안내 글자
// 바깥 틀은 pointer-events-none(빈 곳을 눌러도 걷기가 됨), 버튼만 pointer-events-auto.

import { ArrowLeft, LayoutGrid, TreePine } from "lucide-react";
import { UI_COLORS } from "@/lib/village/theme";

interface BottomBarProps {
  treeView: boolean;
  /** 안내 글자를 보일지 (창이 열렸거나 트리 보기 중이면 숨김) */
  showHint: boolean;
  labels: {
    hint: string;
    treeView: string;
    backToVillage: string;
    menu: string;
  };
  /** 트리 전체 보기 켜기·끄기 */
  onToggleTreeView: () => void;
  onOpenMenu: () => void;
}

/** 3D 그림 위에서도 또렷하게 보이는 흰 버튼의 그림자 */
/** 떠 있는 버튼의 공통 모양: 모서리가 둥근 네모(56px) */
const FLOAT_BUTTON =
  "pointer-events-auto flex size-14 shrink-0 items-center justify-center rounded-[20px] transition active:scale-95";
const FLOAT_SHADOW = "shadow-[0_6px_20px_rgba(20,26,54,0.22)]";

export function BottomBar({ treeView, showHint, labels, onToggleTreeView, onOpenMenu }: BottomBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      {/* 트리 전체 보기 ↔ 마을로: 켜져 있으면 남색 바탕으로 바뀌어 "지금 트리 보는 중"임을 알려 줍니다 */}
      <button
        type="button"
        onClick={onToggleTreeView}
        aria-label={treeView ? labels.backToVillage : labels.treeView}
        aria-pressed={treeView}
        className={`${FLOAT_BUTTON} ${FLOAT_SHADOW}`}
        style={treeView ? { backgroundColor: UI_COLORS.navy, color: "#ffffff" } : { backgroundColor: "#ffffff", color: UI_COLORS.navy }}
      >
        {treeView ? (
          <ArrowLeft className="size-6" strokeWidth={2.2} aria-hidden="true" />
        ) : (
          <TreePine className="size-6" strokeWidth={2.2} aria-hidden="true" />
        )}
      </button>

      {/* 걷기 안내: 항상 자리를 차지하고, 보이지 않을 땐 투명하게 */}
      <div className="flex min-h-14 min-w-0 flex-1 items-center justify-center">
        <p
          className="rounded-full px-3 py-1.5 text-[11px] font-medium text-white/95 transition-opacity"
          style={{ backgroundColor: `${UI_COLORS.navy}80`, opacity: showHint ? 1 : 0 }}
          aria-hidden={!showHint}
        >
          {labels.hint}
        </p>
      </div>

      {/* 메뉴 버튼: 엄지가 닿기 쉬운 오른쪽 아래. 모서리가 둥근 네모(56px) */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={labels.menu}
        className={`${FLOAT_BUTTON} ${FLOAT_SHADOW}`}
        style={{ backgroundColor: "#ffffff", color: UI_COLORS.navy }}
      >
        <LayoutGrid className="size-6" strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
}
