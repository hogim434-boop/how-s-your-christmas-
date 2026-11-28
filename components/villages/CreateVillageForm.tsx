"use client";

// 마을 만들기 화면의 내용입니다. (F011 마을 만들기, F012 초대 링크)
// 1) 모임 이름과 "이 마을에서 쓸 내 닉네임"을 적고, 마을 종류(친구 / 커플)를 고른 뒤 "만들기"를 누릅니다.
//    친구 마을은 정원(목표 인원, 3~30명)도 정합니다. [확정 11.28]
//    정원은 진행률의 기준 인원이라 나중에 줄일 수 없습니다. 그래서 고르는 자리에 경고 글을 함께 보여 줍니다.
// 2) 만들고 나면 같은 자리에 초대 링크가 나타나고, 복사하거나 캐릭터 꾸미기로 넘어갈 수 있습니다.
// (로드맵 Task 008) "만들기"를 누르면 데이터베이스의 create_village 함수를 부릅니다.
//    그 함수가 한 번에 마을을 저장하고, 만든 사람을 첫 주민으로 넣고, 초대 코드를 만들어 돌려줍니다.
// 💡 브라우저에서 바로 불러도 안전한 이유: 그 함수는 "로그인한 본인"으로만 마을을 만들고,
//    이름 길이·종류 같은 규칙은 데이터베이스가 한 번 더 확인합니다.

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Minus, PartyPopper, Plus, TriangleAlert } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { NicknameField } from "@/components/village/NicknameField";
import { useMessages } from "@/i18n/LocaleContext";
import { loginUrl } from "@/lib/auth/next";
import { createClient } from "@/lib/supabase/client";
import { copyText, inviteUrl } from "@/lib/village/invite";
import { initialNickname, validateNickname } from "@/lib/village/nickname";
import { UI_COLORS } from "@/lib/village/theme";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { requiredCount } from "@/lib/decor/progress";
import {
  availableVillageKinds,
  clampCapacity,
  validateCapacity,
  validateVillageName,
  VILLAGE_CAPACITY_MAX,
  VILLAGE_CAPACITY_MIN,
  VILLAGE_NAME_MAX,
} from "@/lib/villages/rules";
import type { VillageKind } from "@/types/domain";

/**
 * - defaultNickname: 닉네임 입력칸에 미리 채워 둘 이름 (LINE·카카오 닉네임)
 * - backHref: 이미 들어간 마을이 있을 때, 만들지 않고 돌아갈 마을 주소 (없으면 돌아가기 링크를 숨김, Task 017)
 */
export function CreateVillageForm({ defaultNickname = "", backHref = null }: { defaultNickname?: string; backHref?: string | null }) {
  const t = useMessages();
  const [name, setName] = useState("");
  // 이 마을에서 쓸 내 닉네임 (11.27 사용자 요청: 마을을 만드는 사람은 만들 때 정합니다)
  const [nickname, setNickname] = useState(() => initialNickname(defaultNickname));
  const [kind, setKind] = useState<VillageKind>("friends");
  // 정원 입력칸의 글자. 처음에는 비어 있습니다 (기본값을 두지 않아, 만드는 사람이 직접 고르게 합니다)
  const [capacityText, setCapacityText] = useState("");
  // 숫자로만 된 글자일 때만 숫자로 바꿉니다 (비어 있거나 다른 글자가 섞이면 "아직 고르지 않음" = null)
  const capacity = /^\d+$/.test(capacityText) ? Number(capacityText) : null;
  const needsCapacity = kind === "friends";
  const capacityOk = validateCapacity(capacity);
  // −/＋ 버튼: 아직 고르지 않았으면 가장 작은 값부터 시작합니다
  const stepCapacity = (delta: number) =>
    setCapacityText(String(capacity === null ? VILLAGE_CAPACITY_MIN : clampCapacity(capacity + delta)));
  // 만든 마을 (아직 만들기 전이면 null): 초대 링크와 마을 번호
  const [created, setCreated] = useState<{ link: string; villageId: string } | null>(null);
  const createdLink = created?.link ?? null;
  // 저장 요청을 보내는 중인지 (보내는 동안 버튼을 잠가, 두 번 눌러 마을이 두 개 생기지 않게 합니다)
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setFailed(false);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_village", {
      p_name: name.trim(),
      p_kind: kind,
      // 커플 마을은 데이터베이스가 2명으로 고정하므로 보내지 않습니다
      ...(needsCapacity && capacity !== null ? { p_capacity: capacity } : {}),
    });
    if (error || !data) {
      // 로그인이 풀린 채로 눌렀다면 로그인 화면으로 보냅니다 (로그인 뒤 이 화면으로 돌아옴)
      if (error?.message.includes("not_signed_in")) {
        window.location.assign(loginUrl({ next: "/villages/new" }));
        return;
      }
      setFailed(true);
      setSubmitting(false);
      return;
    }
    // 방금 생긴 "내 주민 줄"에 닉네임을 저장합니다. 보안 규칙이 본인 줄만 고치게 하므로 마을 번호만으로 내 줄이 골라집니다.
    // 실패해도 마을은 이미 만들어졌으므로 그대로 진행합니다 (로그인 닉네임이 보이고, 메뉴에서 다시 정할 수 있음)
    const { error: nicknameError } = await supabase.from("residents").update({ nickname: nickname.trim() }).eq("village_id", data.id);
    if (nicknameError) console.error("닉네임 저장 실패", nicknameError);
    setCreated({ link: inviteUrl(window.location.origin, data.invite_code), villageId: data.id });
  };
  // 복사 결과: 아직 안 누름 / 복사됨 / 실패
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const kinds = availableVillageKinds();
  const kindNames: Record<VillageKind, string> = { friends: t.kindFriends, couple: t.kindCouple };
  const kindDescs: Record<VillageKind, string> = { friends: t.kindFriendsDesc, couple: t.kindCoupleDesc };
  const check = validateVillageName(name);
  // 모임 이름과 닉네임이 모두 규칙에 맞고, 친구 마을이면 정원도 골라야 만들 수 있습니다
  const canSubmit = check === "ok" && validateNickname(nickname) === "ok" && (!needsCapacity || capacityOk);
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
          // 방금 만든 마을로 가서 캐릭터 꾸미기 창을 바로 엽니다
          href={`/village/${created?.villageId}?customize=1`}
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
        void handleSubmit();
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

      <NicknameField id="creator-nickname" value={nickname} onChange={setNickname} />

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

      {/* 정원(목표 인원): 친구 마을만. 커플 마을은 언제나 2명입니다 */}
      {needsCapacity && (
        <div className="flex flex-col gap-2">
          <label htmlFor="village-capacity" className="text-sm font-semibold">
            {t.villageCapacityLabel}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepCapacity(-1)}
              disabled={capacity !== null && capacity <= VILLAGE_CAPACITY_MIN}
              aria-label={t.villageCapacityMinus}
              className="flex size-13 shrink-0 items-center justify-center rounded-2xl transition-opacity disabled:opacity-35"
              style={{ backgroundColor: UI_COLORS.surface }}
            >
              <Minus className="size-5" aria-hidden="true" />
            </button>
            <div className="flex h-13 min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-4" style={{ backgroundColor: UI_COLORS.surface }}>
              <input
                id="village-capacity"
                type="text"
                // 💡 inputMode="numeric": 휴대폰에서 숫자 자판이 뜨게 합니다
                inputMode="numeric"
                value={capacityText}
                // 숫자가 아닌 글자는 받지 않고, 두 자리까지만 받습니다
                onChange={(e) => setCapacityText(e.target.value.replace(/\D/g, "").slice(0, 2))}
                // 입력칸을 벗어날 때 범위 밖의 숫자(예: 2, 99)를 범위 안으로 맞춥니다
                onBlur={() => capacity !== null && setCapacityText(String(clampCapacity(capacity)))}
                placeholder={`${VILLAGE_CAPACITY_MIN}~${VILLAGE_CAPACITY_MAX}`}
                autoComplete="off"
                aria-describedby="village-capacity-hint village-capacity-warning"
                className="w-14 bg-transparent text-center text-base font-bold tabular-nums outline-none placeholder:font-normal placeholder:text-[#a9aec0]"
              />
              <span className="text-sm" style={{ color: UI_COLORS.muted }}>
                {t.villageCapacityUnit}
              </span>
            </div>
            <button
              type="button"
              onClick={() => stepCapacity(1)}
              disabled={capacity !== null && capacity >= VILLAGE_CAPACITY_MAX}
              aria-label={t.villageCapacityPlus}
              className="flex size-13 shrink-0 items-center justify-center rounded-2xl transition-opacity disabled:opacity-35"
              style={{ backgroundColor: UI_COLORS.surface }}
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
          </div>
          {/* 고른 정원이면 편지가 몇 통 모여야 하는지 바로 알려 줍니다 (계산식은 진행률과 같은 것) */}
          <p id="village-capacity-hint" role="status" className="min-h-8 px-1 text-xs" style={{ color: UI_COLORS.muted }}>
            {capacityOk && capacity !== null
              ? t.villageCapacityHint.replace("{n}", String(capacity)).replace("{total}", String(requiredCount("friends", 0, capacity)))
              : t.villageCapacityEmptyHint.replace("{min}", String(VILLAGE_CAPACITY_MIN)).replace("{max}", String(VILLAGE_CAPACITY_MAX))}
          </p>
          {/* 경고: 정원은 나중에 줄일 수 없습니다 */}
          <p
            id="village-capacity-warning"
            className="flex gap-2 rounded-2xl px-3.5 py-3 text-xs leading-relaxed"
            style={{ backgroundColor: `${UI_COLORS.accent}14`, color: UI_COLORS.navy }}
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: UI_COLORS.accent }} aria-hidden="true" />
            <span>{t.villageCapacityWarning}</span>
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className={PRIMARY_BUTTON}
      >
        {submitting ? t.creatingVillage : t.createVillageButton}
      </button>
      {/* 저장 실패 안내 (화면 읽기 도구가 바로 읽어 주도록 role="alert") */}
      {failed && (
        <p role="alert" className="text-center text-xs font-semibold" style={{ color: UI_COLORS.accent }}>
          {t.createVillageFailed}
        </p>
      )}
      {/* 이미 마을이 있는 사람: 만들지 않고 원래 마을로 돌아가기 (마을 목록에서 들어온 경우, Task 017) */}
      {backHref && (
        <Link href={backHref} className="flex min-h-11 items-center justify-center text-sm font-semibold" style={{ color: UI_COLORS.muted }}>
          {t.villageBack}
        </Link>
      )}
    </form>
  );
}
