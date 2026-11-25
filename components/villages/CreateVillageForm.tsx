"use client";

// 마을 만들기 화면의 내용입니다. (F011 마을 만들기, F012 초대 링크)
// 1) 모임 이름 하나를 적고, 마을 종류(친구 / 커플)를 골라 "만들기"를 누릅니다. 정원(인원 수)은 묻지 않습니다.
// 2) 만들고 나면 같은 자리에 초대 링크가 나타나고, 복사하거나 캐릭터 꾸미기로 넘어갈 수 있습니다.
// ⚠️ 지금은 가짜 데이터라서 진짜로 저장되지 않습니다. 이름만 이 브라우저에 기억해 마을 화면에 보여 줍니다.
//    진짜 마을 만들기(초대 코드 발급, 첫 주민 등록)는 로드맵 Task 008에서 합니다.

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, PartyPopper } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMessages } from "@/i18n/LocaleContext";
import { saveCreatedVillageName } from "@/lib/dummy/village";
import { copyText, inviteUrl } from "@/lib/village/invite";
import { UI_COLORS } from "@/lib/village/theme";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { availableVillageKinds, validateVillageName, VILLAGE_NAME_MAX } from "@/lib/villages/rules";
import type { VillageKind } from "@/types/domain";

/** 가짜 초대 코드 (진짜 코드는 Task 008에서 서버가 만들어 줍니다) */
const DUMMY_INVITE_CODE = "demo";

export function CreateVillageForm() {
  const t = useMessages();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<VillageKind>("friends");
  // 만들기를 누른 뒤의 초대 링크 (아직 만들기 전이면 null)
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  // 복사 결과: 아직 안 누름 / 복사됨 / 실패
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const kinds = availableVillageKinds();
  const kindNames: Record<VillageKind, string> = { friends: t.kindFriends, couple: t.kindCouple };
  const kindDescs: Record<VillageKind, string> = { friends: t.kindFriendsDesc, couple: t.kindCoupleDesc };
  const check = validateVillageName(name);
  const cardStyle = { backgroundColor: "#ffffff", color: UI_COLORS.navy };

  // ── 2) 만든 뒤: 초대 링크 보여 주기 ──
  if (createdLink) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-[28px] p-6 shadow-[0_12px_48px_rgba(20,26,54,0.14)]" style={cardStyle}>
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            className="flex size-14 items-center justify-center rounded-[20px]"
            style={{ backgroundColor: `${UI_COLORS.accent}1a`, color: UI_COLORS.accent }}
          >
            <PartyPopper className="size-7" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold">{t.villageCreated}</h1>
          <p className="break-words text-sm" style={{ color: UI_COLORS.muted }}>
            {name.trim()} · {kindNames[kind]}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t.inviteLinkLabel}</p>
          {/* select-all: 복사 버튼이 막힌 브라우저에서도 길게 눌러 전체를 고를 수 있게 */}
          <p className="select-all break-all rounded-2xl px-4 py-3.5 text-sm" style={{ backgroundColor: UI_COLORS.surface }}>
            {createdLink}
          </p>
          <button
            type="button"
            onClick={async () => setCopyState((await copyText(createdLink)) ? "copied" : "failed")}
            className={SECONDARY_BUTTON}
          >
            {copyState === "copied" ? <Check className="size-5" aria-hidden="true" /> : <Copy className="size-5" aria-hidden="true" />}
            {t.inviteCopyButton}
          </button>
          {/* 복사 결과 안내 (화면 읽기 도구도 읽어 주도록 role="status") */}
          <p role="status" className="min-h-5 text-center text-xs" style={{ color: copyState === "failed" ? UI_COLORS.accent : UI_COLORS.muted }}>
            {copyState === "copied" ? t.inviteCopied : copyState === "failed" ? t.inviteCopyFailed : ""}
          </p>
        </div>

        <Link
          // 가짜 마을에는 친구들이 이미 살고 있어서, 편지 쓰기까지 이어서 눌러 볼 수 있습니다
          href="/village/demo?customize=1"
          className={PRIMARY_BUTTON}
        >
          {t.goCustomize}
        </Link>
      </div>
    );
  }

  // ── 1) 만들기 전: 이름과 종류 입력 ──
  return (
    <form
      className="flex w-full max-w-sm flex-col gap-5 rounded-[28px] p-6 shadow-[0_12px_48px_rgba(20,26,54,0.14)]"
      style={cardStyle}
      onSubmit={(e) => {
        // 기본 동작(페이지 새로고침)을 막습니다
        e.preventDefault();
        if (check !== "ok") return;
        saveCreatedVillageName(name.trim());
        setCreatedLink(inviteUrl(window.location.origin, DUMMY_INVITE_CODE));
      }}
    >
      <h1 className="text-[22px] font-bold tracking-tight">{t.createVillageTitle}</h1>

      <div className="flex flex-col gap-2">
        <label htmlFor="village-name" className="text-sm font-semibold">
          {t.villageNameLabel}
        </label>
        <input
          id="village-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.villageNamePlaceholder}
          autoComplete="off"
          // text-base(16px): 아이폰이 입력할 때 화면을 확대하지 않는 최소 글자 크기
          className="h-13 w-full rounded-2xl border border-transparent px-4 text-base outline-none transition-colors placeholder:text-[#a9aec0] focus:border-[#232b52]/30"
          style={{ backgroundColor: UI_COLORS.surface }}
        />
        <div className="flex justify-between gap-3 text-xs">
          <p role="status" className="font-semibold" style={{ color: UI_COLORS.accent }}>
            {check === "tooLong" ? t.villageNameTooLong.replace("{max}", String(VILLAGE_NAME_MAX)) : ""}
          </p>
          <p className="shrink-0 tabular-nums" style={{ color: check === "tooLong" ? UI_COLORS.accent : UI_COLORS.muted }}>
            {[...name.trim()].length} / {VILLAGE_NAME_MAX}
          </p>
        </div>
      </div>

      {/* 마을 종류: 커플 선택지가 꺼져 있으면(친구 마을 하나뿐이면) 고르기 자체를 숨깁니다 */}
      {kinds.length > 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t.villageKindLabel}</p>
          <SegmentedControl
            ariaLabel={t.villageKindLabel}
            value={kind}
            onChange={setKind}
            options={kinds.map((k) => ({ value: k, label: kindNames[k] }))}
          />
          <p className="min-h-8 px-1 text-xs" style={{ color: UI_COLORS.muted }}>
            {kindDescs[kind]}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={check !== "ok"}
        className={PRIMARY_BUTTON}
      >
        {t.createVillageButton}
      </button>
    </form>
  );
}
