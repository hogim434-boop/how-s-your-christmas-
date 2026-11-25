"use client";

// 화면 위에 떠 있는 동그란 버튼들입니다. (아래쪽 긴 막대 대신 3D 마을을 덜 가리는 배치)
//   - 오른쪽 가장자리: 트리 전체 보기(위쪽), 초대 링크 복사(아래쪽)
//   - 왼쪽 아래: 편지함 / 오른쪽 아래: 꾸미기 / 가운데 아래: 메뉴
//   - 가운데 아래 위쪽에 작은 걷기 안내 알약
// 바깥 틀은 pointer-events-none(빈 곳을 눌러도 걷기가 됨), 버튼만 pointer-events-auto.

import { ArrowLeft, Link2, Mail, Menu, Shirt, TreePine, type LucideIcon } from "lucide-react";
import { UI_COLORS } from "@/lib/village/theme";

interface BottomBarProps {
  treeView: boolean;
  /** 안내 알약을 보일지 (오버레이가 열렸거나 트리 보기 중이면 숨김) */
  showHint: boolean;
  labels: {
    hint: string;
    treeView: string;
    backToVillage: string;
    treeShort: string;
    backShort: string;
    letterbox: string;
    customize: string;
    invite: string;
    menu: string;
  };
  onToggleTreeView: () => void;
  onOpenLetterbox: () => void;
  onOpenCustomize: () => void;
  onCopyInvite: () => void;
  onOpenMenu: () => void;
}

/** 둥근 아이콘 버튼 + 아래 작은 글자 (지름 56px, 터치하기 충분한 크기) */
function RoundButton({
  icon: Icon,
  label,
  ariaLabel,
  pressed,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  /** 화면 읽기 도구용 긴 이름 (없으면 label 사용) */
  ariaLabel?: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        aria-pressed={pressed}
        className="pointer-events-auto flex size-14 items-center justify-center rounded-full border border-[#232b52]/15 shadow-lg active:scale-95"
        style={{ backgroundColor: UI_COLORS.cream, color: UI_COLORS.navy }}
      >
        <Icon className="size-6" aria-hidden="true" />
      </button>
      {/* 3D 그림 위에서도 읽히도록 반투명 알약 위에 글자를 얹습니다 */}
      <span
        aria-hidden="true"
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none text-white"
        style={{ backgroundColor: `${UI_COLORS.navy}99` }}
      >
        {label}
      </span>
    </div>
  );
}

export function BottomBar({
  treeView,
  showHint,
  labels,
  onToggleTreeView,
  onOpenLetterbox,
  onOpenCustomize,
  onCopyInvite,
  onOpenMenu,
}: BottomBarProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 오른쪽 가장자리 위쪽: 트리 전체 보기 ↔ 마을로 */}
      <div className="absolute right-3 top-[30%]">
        <RoundButton
          icon={treeView ? ArrowLeft : TreePine}
          label={treeView ? labels.backShort : labels.treeShort}
          ariaLabel={treeView ? labels.backToVillage : labels.treeView}
          pressed={treeView}
          onClick={onToggleTreeView}
        />
      </div>

      {/* 오른쪽 가장자리 아래쪽: 초대 링크 복사 */}
      <div className="absolute right-3 top-[52%]">
        <RoundButton icon={Link2} label={labels.invite} onClick={onCopyInvite} />
      </div>

      {/* 맨 아래 줄: 편지함(왼쪽) · 메뉴(가운데) · 꾸미기(오른쪽) */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)]">
        {/* 걷기 안내: 항상 자리를 차지하고 보이지 않을 땐 투명하게 */}
        <p
          className="rounded-full px-3 py-1 text-[11px] font-medium text-white transition-opacity"
          style={{ backgroundColor: `${UI_COLORS.navy}b3`, opacity: showHint ? 1 : 0 }}
          aria-hidden={!showHint}
        >
          {labels.hint}
        </p>
        <div className="grid w-full grid-cols-3 items-end">
          <div className="flex justify-start">
            <RoundButton icon={Mail} label={labels.letterbox} onClick={onOpenLetterbox} />
          </div>
          <div className="flex justify-center">
            <RoundButton icon={Menu} label={labels.menu} onClick={onOpenMenu} />
          </div>
          <div className="flex justify-end">
            <RoundButton icon={Shirt} label={labels.customize} onClick={onOpenCustomize} />
          </div>
        </div>
      </div>
    </div>
  );
}
