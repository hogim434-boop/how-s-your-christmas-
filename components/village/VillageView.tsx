"use client";

// 마을 화면 한 장입니다. 3D 장면(VillageScene)과, 그 위에 겹치는 화면(HUD·겹침 창)을 모두 가집니다.
// 지금은 가짜 데이터로 그리고, 진짜 데이터로 바뀌어도 이 파일의 모양은 같게 유지합니다.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useProgress } from "@react-three/drei";
import VillageScene from "./VillageScene";
import type { WalkTarget } from "./Player";
import { NameTagLayer, type NameTagData } from "./NameTag";
import { MailboxPromptLayer } from "./MailboxPrompt";
import { approachPoint, type Spot } from "@/lib/village/proximity";
import { TopBar } from "./hud/TopBar";
import { BottomBar } from "./hud/BottomBar";
import { InviteCard } from "./hud/InviteCard";
import { DevLevelBar } from "./hud/DevLevelBar";
import { MenuSheet } from "./hud/MenuSheet";
import { Toast, type ToastMessage } from "./hud/Toast";
import Overlay from "@/components/overlay/Overlay";
import { houseSlots, ringRadius } from "@/lib/village/layout";
import { daysUntilChristmas } from "@/lib/village/dday";
import { getDummyVillage, type DummyOptions } from "@/lib/dummy/village";
import { MAX_DECOR_LEVEL } from "@/lib/decor/decorTable";
import { getMessages, type Locale } from "@/i18n/messages";
import { LocaleContext } from "@/i18n/LocaleContext";
import { loadLocale, loadSky, saveLocale, saveSky } from "@/lib/village/preferences";
import { SKY_THEMES, UI_COLORS, type SkyMode } from "@/lib/village/theme";

interface VillageViewProps {
  /** 주소의 마을 번호 */
  id: string;
  /** 주소 뒤 ?n=&level=&dev=&tree= 에서 읽은 값 */
  options: DummyOptions;
  /** 장식 단계(0~10). 주면 화면 안의 슬라이더 값 대신 이 값을 씁니다 */
  level?: number;
  /** true면 카메라가 트리 전체를 보여 줍니다. 주면 화면 안의 버튼 값 대신 이 값을 씁니다 */
  treeView?: boolean;
}

/** 지금 열려 있는 겹침 창. 편지 쓰기는 누구에게 쓰는지(residentId)도 함께 기억 */
type OverlayState =
  | null
  | { kind: "write"; residentId: string }
  | { kind: "letterbox" }
  | { kind: "customize" }
  | { kind: "menu" };

export default function VillageView({ id, options, level, treeView }: VillageViewProps) {
  // 화면 언어와 하늘(아침·노을·밤): 메뉴에서 바꾸고, 이 브라우저에 기억해 둡니다 (11.25 사용자 요청)
  // (이 화면은 브라우저에서만 그려져서, 처음 값을 바로 저장 공간에서 읽어도 서버와 어긋나지 않습니다)
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const [sky, setSky] = useState<SkyMode>(loadSky);
  const t = getMessages(locale);
  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
    saveLocale(next);
  }, []);
  const changeSky = useCallback((next: SkyMode) => {
    setSky(next);
    saveSky(next);
  }, []);
  // 페이지 전체의 언어 표시(<html lang>)도 맞춰 둡니다 (화면 읽기 도구·글꼴 선택에 쓰임)
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const village = useMemo(
    () => getDummyVillage({ id, n: options.n, level: options.level }),
    [id, options.n, options.level],
  );

  // 장식 단계와 트리 보기: 화면 안에서 바뀌는 값(state)이고, props로 주면 그 값이 우선합니다
  const [devLevel, setDevLevel] = useState(village.level);
  const [treeViewState, setTreeViewState] = useState(options.tree);
  const decorLevel = level ?? devLevel;
  const isTreeView = treeView ?? treeViewState;

  // 겹침 창과 안내 메시지(토스트)
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text })), []);

  // 걸어갈 목표: 땅을 누를 때마다 새 id를 붙여서, 같은 자리를 다시 눌러도 새 목표로 받아들입니다
  const [walkTarget, setWalkTarget] = useState<WalkTarget | null>(null);
  const handleGroundPointerDown = useCallback((point: { x: number; z: number }) => {
    setWalkTarget((prev) => ({ x: point.x, z: point.z, id: (prev?.id ?? 0) + 1 }));
  }, []);

  const slots = useMemo(() => houseSlots(village.residents.length), [village.residents.length]);
  const villageRadius = ringRadius(village.residents.length);

  // 우체통 자리 목록 (id = 주민 id). 가까이 가면 뜨는 버튼과 "우체통 눌러서 걸어가기"에 씁니다
  const mailboxSpots: Spot[] = useMemo(
    () => village.residents.map((r, i) => ({ id: r.id, x: slots[i].mailbox.x, z: slots[i].mailbox.z })),
    [village.residents, slots],
  );
  // 지금 캐릭터 가까이에 있는 우체통의 주인 (없으면 null)
  const [nearMailbox, setNearMailbox] = useState<string | null>(null);

  // 우체통을 누르면: 바로 창을 열지 않고 캐릭터가 우체통 앞으로 걸어갑니다.
  // 도착하면 우체통 위에 "편지 쓰기" 말풍선 버튼이 뜹니다 (11.25 사용자 요청: A안)
  const handleMailboxSelect = useCallback(
    (residentId: string) => {
      const spot = mailboxSpots.find((s) => s.id === residentId);
      if (!spot) return;
      const p = approachPoint(spot);
      setWalkTarget((prev) => ({ x: p.x, z: p.z, id: (prev?.id ?? 0) + 1 }));
    },
    [mailboxSpots],
  );

  // 말풍선 버튼을 눌렀을 때: 내 우체통이면 편지함, 친구 우체통이면 그 친구에게 편지 쓰기
  const openMailbox = useCallback(
    (residentId: string) => {
      const resident = village.residents.find((r) => r.id === residentId);
      if (!resident) return;
      setOverlay(resident.isMe ? { kind: "letterbox" } : { kind: "write", residentId });
    },
    [village.residents],
  );

  // 초대 링크 복사. 지금은 가짜 주소(/invite/demo)이고, 실패하면 안내 메시지로 알려 줍니다
  const copyInvite = useCallback(async () => {
    const url = `${window.location.origin}/invite/demo`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t.inviteCopied);
    } catch {
      // 브라우저가 복사를 막은 경우(권한·http 주소 등)
      showToast(t.inviteCopyFailed);
    }
  }, [showToast, t.inviteCopied, t.inviteCopyFailed]);

  // 이름표: 내 집은 "내 집"이라고, 나머지는 주민 이름을 집 위(높이 6)에 띄웁니다
  const nameTags: NameTagData[] = village.residents.map((r, i) => ({
    id: r.id,
    label: r.isMe ? t.myHouse : r.name,
    isMe: r.isMe,
    position: [slots[i].x, 6, slots[i].z],
  }));

  // 3D 모델 파일을 받는 중인지 (drei가 다운로드 진행 상황을 알려 줍니다)
  const { active } = useProgress();

  // D-day: 처음 한 번만 현재 시각으로 계산 (이 화면은 브라우저에서만 그려져서 서버와 어긋나지 않음)
  const [now] = useState(() => new Date());
  const dday = daysUntilChristmas(now);

  const writeTarget = overlay?.kind === "write" ? village.residents.find((r) => r.id === overlay.residentId) : undefined;
  const overlayOpen = overlay !== null;

  // 말풍선 버튼 글자. 창이 열려 있거나 트리 전체 보기 중이면 숨깁니다
  const nearResident = nearMailbox ? village.residents.find((r) => r.id === nearMailbox) : undefined;
  const promptLabel =
    nearResident && !overlayOpen && !isTreeView
      ? nearResident.isMe
        ? t.openLetterboxPrompt
        : t.writeLetterTitle.replace("{name}", nearResident.name)
      : null;
  const promptSent = nearResident && !nearResident.isMe && village.sentTo.includes(nearResident.id);

  return (
    // h-dvh: 휴대폰 주소창을 뺀 실제 화면 높이
    <LocaleContext.Provider value={locale}>
    <main
      className="relative h-dvh w-full overflow-hidden"
      style={{ backgroundColor: SKY_THEMES[sky].sky }}
    >
      <div className="absolute inset-0">
        <VillageScene
          residents={village.residents}
          slots={slots}
          villageRadius={villageRadius}
          nameTags={nameTags}
          sentTo={village.sentTo}
          mailboxLabel={(name) => t.mailboxLabel.replace("{name}", name)}
          onMailboxSelect={handleMailboxSelect}
          mailboxSpots={mailboxSpots}
          onNearMailboxChange={setNearMailbox}
          level={decorLevel}
          walkTarget={walkTarget}
          treeView={isTreeView}
          sky={sky}
          onGroundPointerDown={handleGroundPointerDown}
        />
      </div>

      {/* 이름표 글자 상자들 (3D 위에 겹침) */}
      <NameTagLayer tags={nameTags} />

      {/* 우체통 가까이 가면 뜨는 "편지 쓰기" 말풍선 버튼 */}
      <MailboxPromptLayer
        label={promptLabel}
        sentLabel={promptSent ? t.mailboxSent : undefined}
        onPress={() => nearMailbox && openMailbox(nearMailbox)}
      />

      {/* 모델을 받는 동안 보이는 안내 문구 */}
      {active && (
        <p
          role="status"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-sm"
          style={{ color: UI_COLORS.navy }}
        >
          {t.villageLoading}
        </p>
      )}

      {/* HUD: 화면 전체를 덮지만 pointer-events-none이라 빈 곳을 눌러도 3D(걷기)로 전달됩니다 */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between">
        <div className="flex flex-col gap-2">
          <TopBar
            villageName={village.name}
            ddayText={dday.isDDay ? t.ddayDone : t.ddayLabel.replace("{n}", String(dday.days))}
            ddayCaption={dday.isDDay ? undefined : t.untilChristmas}
            // 더미 단계에서는 장식 단계 × 10 (진짜 데이터가 생기면 progressPercent로 교체)
            percent={decorLevel * 10}
            progressAria={t.progressAria}
            night={SKY_THEMES[sky].lightText}
          />
          {/* 주민이 나 혼자면 초대 카드, ?dev면 단계 슬라이더 */}
          <div className="flex flex-col gap-2 px-4">
            {village.residents.length === 1 && (
              <InviteCard title={t.inviteCardTitle} copyLabel={t.inviteCopyButton} onCopy={copyInvite} />
            )}
            {options.dev && (
              <DevLevelBar level={decorLevel} max={MAX_DECOR_LEVEL} label={t.devLevel} onChange={setDevLevel} />
            )}
          </div>
        </div>

        <BottomBar
          treeView={isTreeView}
          showHint={!overlayOpen && !isTreeView}
          labels={{
            hint: t.tapHint,
            treeView: t.treeView,
            treeShort: t.treeShort,
            backShort: t.backShort,
            backToVillage: t.backToVillage,
            letterbox: t.letterbox,
            customize: t.customize,
            invite: t.invite,
            menu: t.menu,
          }}
          onToggleTreeView={() => setTreeViewState((prev) => !prev)}
          onOpenLetterbox={() => setOverlay({ kind: "letterbox" })}
          onOpenCustomize={() => setOverlay({ kind: "customize" })}
          onCopyInvite={copyInvite}
          onOpenMenu={() => setOverlay({ kind: "menu" })}
        />
      </div>

      <Toast message={toast} onDone={clearToast} />

      {/* 겹침 창들 (Overlay 뼈대 재사용). 안의 내용은 Task 005에서 채웁니다 */}
      <Overlay
        open={overlay?.kind === "write"}
        onClose={closeOverlay}
        title={t.writeLetterTitle.replace("{name}", writeTarget?.name ?? "")}
      >
        {/* TODO: 편지 쓰기 양식(Task 005) */}
        <p className="text-sm text-slate-500">{t.writeLetterPlaceholder}</p>
      </Overlay>
      <Overlay open={overlay?.kind === "letterbox"} onClose={closeOverlay} title={t.letterbox}>
        {/* TODO: 받은·보낸 편지 목록(Task 005) */}
        <p className="text-sm text-slate-500">{t.letterboxPlaceholder}</p>
      </Overlay>
      <Overlay open={overlay?.kind === "customize"} onClose={closeOverlay} title={t.customize}>
        {/* TODO: 캐릭터 꾸미기(Task 005) */}
        <p className="text-sm text-slate-500">{t.customizePlaceholder}</p>
      </Overlay>
      <MenuSheet
        open={overlay?.kind === "menu"}
        labels={{
          title: t.menu,
          skyMode: t.skyMode,
          skyNames: { day: t.skyDay, dusk: t.skyDusk, night: t.skyNight },
          language: t.language,
          logout: t.logout,
          comingSoon: t.appComingSoon,
        }}
        sky={sky}
        onSkyChange={changeSky}
        locale={locale}
        onLocaleChange={changeLocale}
        onClose={closeOverlay}
        // TODO: 진짜 로그아웃(Task 007). 지금은 안내 메시지만
        onLogout={() => {
          closeOverlay();
          showToast(t.logoutPlaceholder);
        }}
      />
    </main>
    </LocaleContext.Provider>
  );
}
