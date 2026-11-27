"use client";

// 화면 아래쪽에 떠 있는 것들입니다.
// 11.26 사용자 요청: 화면 위 버튼이 너무 많아 조잡 → 버튼을 둘만 남기고 나머지는 메뉴로 모았습니다.
//   - 왼쪽 아래: 트리 전체 보기 ↔ 마을로 돌아가기 (자주 눌러 보는 버튼이라 밖에 둠)
//   - 오른쪽 아래: 메뉴 (편지함·꾸미기·초대·설정이 모두 이 안에 있음)
//   - 가운데 아래: 작은 걷기 안내 글자
//   - 메뉴 버튼 위: 처음 한 번만 뜨는 "친구 초대는 메뉴에서" 말풍선 (11.27)
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
  /**
   * 메뉴 버튼 위에 띄울 한 번짜리 안내 글 (없으면 띄우지 않음).
   * 11.27 사용자 요청: 화면 위의 초대 카드를 없애고, 메뉴로 이끄는 화살표와 설명으로 대신합니다.
   */
  menuHint?: string;
  /** 트리 전체 보기 켜기·끄기 */
  onToggleTreeView: () => void;
  onOpenMenu: () => void;
}

/** 3D 그림 위에서도 또렷하게 보이는 흰 버튼의 그림자 */
/** 떠 있는 버튼의 공통 모양: 모서리가 둥근 네모(56px) */
const FLOAT_BUTTON =
  "pointer-events-auto flex size-14 shrink-0 items-center justify-center rounded-[20px] transition active:scale-95";
const FLOAT_SHADOW = "shadow-[0_6px_20px_rgba(20,26,54,0.22)]";

export function BottomBar({ treeView, showHint, labels, menuHint, onToggleTreeView, onOpenMenu }: BottomBarProps) {
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
      <div className="relative shrink-0">
        {menuHint && (
          // 메뉴 버튼을 가리키는 말풍선. 눌러도 메뉴가 열립니다. animate-bounce: 위아래로 통통 튀어 눈에 띄게 합니다
          <button
            type="button"
            onClick={onOpenMenu}
            className="pointer-events-auto absolute bottom-full right-0 mb-3 animate-bounce whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_20px_rgba(20,26,54,0.3)]"
            style={{ backgroundColor: UI_COLORS.navy }}
          >
            {menuHint}
            {/* 아래를 가리키는 화살표: 작은 네모를 45도 돌려 말풍선 꼬리로 씁니다 (메뉴 버튼 가운데 위) */}
            <span
              aria-hidden="true"
              className="absolute -bottom-1.5 right-[22px] size-3 rotate-45 rounded-[2px]"
              style={{ backgroundColor: UI_COLORS.navy }}
            />
          </button>
        )}
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
    </div>
  );
}
