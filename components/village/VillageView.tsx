"use client";

// 마을 화면 한 장입니다. 3D 장면(VillageScene)과, 그 위에 겹치는 화면(HUD·겹침 창)을 모두 가집니다.
// 지금은 가짜 데이터로 그리고, 진짜 데이터로 바뀌어도 이 파일의 모양은 같게 유지합니다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useRouter } from "next/navigation";
import VillageScene from "./VillageScene";
import { createWalkStore } from "@/lib/village/walkStore";
import { createRemoteStore } from "@/lib/village/remoteStore";
import { createOnlineStore } from "@/lib/village/onlineStore";
import { buildObstacles } from "@/lib/village/collision";
import { PROGRESS_POLL_LIVE_MS, PROGRESS_POLL_MS, spawnPoint } from "@/lib/village/liveProtocol";
import { useLiveWalk } from "@/lib/village/useLiveWalk";
import { ghostId, ghostNames, startGhosts } from "@/lib/dummy/ghosts";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Notice } from "@/lib/auth/next";
import { NameTagLayer, RemoteNameTagLayer, type NameTagData } from "./NameTag";
import { MailboxPromptLayer } from "./MailboxPrompt";
import { approachPoint, type Spot } from "@/lib/village/proximity";
import { TopBar } from "./hud/TopBar";
import { BottomBar } from "./hud/BottomBar";
import { DevLevelBar } from "./hud/DevLevelBar";
import { LevelUpCard } from "./hud/LevelUpCard";
import { GaugePanel } from "./hud/GaugePanel";
import { blinkStage } from "./reveal";
import { isReached } from "@/lib/decor/gauge";
import { FpsMeter } from "./hud/FpsMeter";
import { MenuSheet } from "./hud/MenuSheet";
import { VillageListPanel } from "@/components/villages/VillageListPanel";
import { dummyVillageRows } from "@/lib/dummy/villages";
import { toVillageList, type MyVillageRow } from "@/lib/villages/list";
import { fetchMyVillages } from "@/lib/villages/store";
import { HowToPlay } from "./HowToPlay";
import NicknameForm from "./NicknameForm";
import { Toast, type ToastMessage } from "./hud/Toast";
import Overlay from "@/components/overlay/Overlay";
import { LetterForm } from "@/components/letters/LetterForm";
import { LetterboxPanel, type SentLetterRow } from "@/components/letters/LetterboxPanel";
import { LetterReader } from "@/components/letters/LetterReader";
import { CharacterEditor } from "@/components/character/CharacterEditor";
import { houseSlots, ringRadius, walkRadius } from "@/lib/village/layout";
import { daysUntilChristmas } from "@/lib/village/dday";
import { copyText, inviteUrl } from "@/lib/village/invite";
import { getDummyVillage, type DummyOptions } from "@/lib/dummy/village";
import type { VillageData } from "@/lib/village/data";
import { saveResidentNickname, saveResidentParts } from "@/lib/village/saveParts";
import {
  initialSentLetters,
  loadSentLetters,
  receivedLetters,
  removeLetter,
  saveSentLetters,
  upsertLetter,
} from "@/lib/dummy/letters";
import { isLetterLocked } from "@/lib/letters/rules";
import { isUnread, markOpenedInList } from "@/lib/letters/reading";
import { deleteLetter, editLetter, fetchProgress, fetchSentLetters, markLetterOpened, sendLetter } from "@/lib/letters/store";
import { readSession, writeSession } from "@/lib/storage";
import { putSentLetter, type SentLetter } from "@/lib/letters/types";
import type { LetterError } from "@/lib/letters/errors";
import { computeDecorLevel, progressPercent, requiredCount } from "@/lib/decor/progress";
import { loadDraft, saveDraft, type LetterDraft } from "@/lib/letters/drafts";
import { DEFAULT_PAPER } from "@/lib/letters/papers";
import { DEFAULT_PARTS, loadCharacterParts, partsFromSeed, saveCharacterParts } from "@/lib/character/parts";
import type { CharacterParts } from "@/types/domain";
import { MAX_DECOR_LEVEL } from "@/lib/decor/decorTable";
import { getMessages, type Locale } from "@/i18n/messages";
import { LocaleContext } from "@/i18n/LocaleContext";
import { loadIntroSeen, loadLocale, loadMenuHintSeen, loadSky, saveIntroSeen, saveLocale, saveMenuHintSeen, saveSky } from "@/lib/village/preferences";
import { SKY_THEMES, UI_COLORS, type SkyMode } from "@/lib/village/theme";

interface VillageViewProps {
  /** 주소의 마을 번호 */
  id: string;
  /** 주소 뒤 ?n=&level=&dev=&tree=&customize=&unlock= 에서 읽은 값 */
  options: DummyOptions;
  /** 데이터베이스에서 읽은 진짜 마을. 없으면(연습용 마을 /village/demo) 가짜 마을을 만들어 씁니다 */
  village?: VillageData;
  /** 장식 단계(0~10). 주면 화면 안의 슬라이더 값 대신 이 값을 씁니다 */
  level?: number;
  /** true면 카메라가 트리 전체를 보여 줍니다. 주면 화면 안의 버튼 값 대신 이 값을 씁니다 */
  treeView?: boolean;
  /** 들어오자마자 띄울 안내 (주민이 아닌 마을에서 튕겨 왔을 때) */
  notice?: Notice;
  /** 함께 걷기를 켤지 (서버 환경 변수 LIVE_WALK=1). 연습용 마을에서는 켜지지 않습니다 */
  liveWalk?: boolean;
}

/** 마을에 처음 들어온 사람에게 이용 방법 안내를 띄우기까지 기다리는 시간(밀리초). 마을을 한번 둘러볼 틈을 줍니다 */
const INTRO_DELAY_MS = 1200;

/** "12.25가 지나서 화면을 새로 불러왔음" 표시를 적어 두는 이름 (이 탭에서 한 번만 새로 부르기 위해) */
const UNLOCK_RELOAD_KEY = "hyc.unlockReloaded";

/** 지금 열려 있는 겹침 창. 편지 쓰기는 누구에게 쓰는지(residentId)도 함께 기억 */
type OverlayState =
  | null
  | { kind: "write"; residentId: string }
  | { kind: "letterbox" }
  // 받은 편지 읽기. firstOpen = 처음 여는 편지인지(봉투 개봉 연출을 보여 줄지). 창을 여는 순간 한 번만 정합니다
  | { kind: "read"; letterId: string; firstOpen: boolean }
  | { kind: "customize" }
  | { kind: "nickname" }
  | { kind: "menu" }
  // 진행률 게이지 (F008): 단계별 장식 목록. 달성한 줄을 누르면 마을에서 그 장식이 깜빡임
  | { kind: "gauge" }
  // 마을 목록 (F017): 내가 들어간 마을들을 보고 다른 마을로 이동
  | { kind: "villages" }
  | { kind: "howto" };

export default function VillageView({ id, options, village: realVillage, level, treeView, notice, liveWalk }: VillageViewProps) {
  // 화면 언어와 하늘(아침·밤): 메뉴에서 바꾸고, 이 브라우저에 기억해 둡니다 (11.25 사용자 요청)
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
  // 연습용 마을의 가짜 데이터 (진짜 마을이면 쓰지 않습니다)
  const dummyVillage = useMemo(
    () => getDummyVillage({ id, n: options.n, level: options.level }),
    [id, options.n, options.level],
  );
  // 진짜 마을(서버가 데이터베이스에서 읽어 준 값)이 있으면 그것을, 없으면 가짜 마을을 그립니다.
  // 두 쪽의 모양이 같아서(lib/village/data.ts) 아래 코드는 어느 쪽인지 신경 쓰지 않아도 됩니다
  const village: VillageData = realVillage ?? dummyVillage;

  // 장식 단계와 트리 보기: 화면 안에서 바뀌는 값(state)이고, props로 주면 그 값이 우선합니다
  const [devLevel, setDevLevel] = useState(village.level);
  const [treeViewState, setTreeViewState] = useState(options.tree);
  // 진짜 마을의 진행 숫자: "지금까지 한 일의 개수"(편지 수). 편지를 쓰거나 지울 때마다 다시 읽어 옵니다.
  // 써야 할 개수(required)는 "정원과 주민 수 중 큰 쪽"으로 정해지고, 진행률(%)과 장식 단계는 이 둘로 계산합니다 (lib/decor/progress.ts)
  const [doneCount, setDoneCount] = useState(village.doneCount);
  // 주민 수: 처음에는 화면에 그린 주민 수이고, 진행 숫자를 다시 읽을 때 서버 값으로 맞춥니다.
  // (화면을 열어 둔 사이에 새 주민이 들어오면 써야 할 편지 수가 늘어나므로, 옛 주민 수로 계산하면 진행률이 실제보다 높게 나옵니다)
  const [liveResidentCount, setLiveResidentCount] = useState(village.residents.length);
  const residentCount = Math.max(liveResidentCount, village.residents.length);
  // 정원: 주민이 정원을 넘으면 데이터베이스가 정원을 올리므로, 진행 숫자를 다시 읽을 때 함께 맞춥니다
  const [liveCapacity, setLiveCapacity] = useState(village.capacity);
  const required = requiredCount(village.kind, residentCount, Math.max(liveCapacity, village.capacity));
  // 장식 단계: 진짜 마을은 지금 진행률로 계산, 연습용 마을(과 ?dev 슬라이더)은 화면 안의 값
  const decorLevel = level ?? (realVillage && !options.dev ? computeDecorLevel(doneCount, required) : devLevel);
  // 진행률(%): 진짜 마을은 편지 수로 계산, 연습용 마을은 장식 단계 × 10
  const percent = realVillage && !options.dev ? progressPercent(doneCount, required) : decorLevel * 10;
  const isTreeView = treeView ?? treeViewState;

  // 겹침 창과 안내 메시지(토스트)
  // ?customize=1로 들어오면(입주 직후 흐름) 꾸미기 창을 바로 엽니다
  // (닉네임은 마을을 만들 때·초대받아 들어올 때 이미 정했습니다. 여기서는 메뉴에서 바꿀 때만 창이 뜹니다)
  const [overlay, setOverlay] = useState<OverlayState>(options.customize ? { kind: "customize" } : null);
  const closeOverlay = useCallback(() => setOverlay(null), []);
  // 장식 단계가 올라간 순간: "몇 % 달성, 새 장식은 무엇"을 알려 주는 카드를 띄웁니다 (처음 들어왔을 때·내려갈 때는 띄우지 않음)
  // 💡 화면을 그리는 도중에 이전 값과 비교해 상태를 맞추는 방법입니다 (React가 권하는 방식)
  const [seenDecorLevel, setSeenDecorLevel] = useState(decorLevel);
  const [levelUp, setLevelUp] = useState<{ id: number; level: number } | null>(null);
  if (decorLevel !== seenDecorLevel) {
    setSeenDecorLevel(decorLevel);
    setLevelUp(decorLevel > seenDecorLevel ? { id: (levelUp?.id ?? 0) + 1, level: decorLevel } : null);
  }
  const clearLevelUp = useCallback(() => setLevelUp(null), []);
  // 진행률 게이지 (F008): 알약을 누르면 화면 아래에 장식 길이 뜨고(다시 누르면 닫힘), 달성한 그림을 누르면 마을에서 그 장식이 깜빡입니다
  const toggleGauge = useCallback(() => setOverlay((prev) => (prev?.kind === "gauge" ? null : { kind: "gauge" })), []);
  const pickGaugeStage = (stage: number) => {
    // 띠를 열어 둔 사이 진행률이 내려갔을 수 있으므로, 누른 순간에 다시 확인합니다. 화면(카메라)은 움직이지 않습니다 [확정 11.24]
    if (isReached(decorLevel, stage)) blinkStage(stage);
  };
  // 안내(notice)를 받고 들어왔으면 처음부터 그 문구를 띄워 둡니다
  const [toast, setToast] = useState<ToastMessage | null>(
    notice === "not_resident" ? { id: 0, text: t.notResidentNotice } : null,
  );
  const clearToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text })), []);

  // 걸어갈 목표: React 상태가 아니라 작은 보관함에 넣습니다. (11.26 성능)
  // 땅을 누를 때 이 화면 전체가 아니라 캐릭터와 "누른 자리 표시"만 다시 그려집니다 → lib/village/walkStore.ts
  const [walkStore] = useState(createWalkStore);
  const handleGroundPointerDown = useCallback(
    (point: { x: number; z: number }) => walkStore.set(point),
    [walkStore],
  );

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
      walkStore.set(p);
    },
    [mailboxSpots, walkStore],
  );

  // 초대 링크 복사: 이 마을의 초대 코드로 주소를 만듭니다. 실패하면 안내 메시지로 알려 줍니다
  const copyInvite = useCallback(async () => {
    const ok = await copyText(inviteUrl(window.location.origin, village.inviteCode));
    // 브라우저가 복사를 막은 경우(권한·http 주소 등)에는 실패 안내
    showToast(ok ? t.inviteCopied : t.inviteCopyFailed);
  }, [showToast, village.inviteCode, t.inviteCopied, t.inviteCopyFailed]);

  // 이름표: 내 집은 "내 집"이라고, 나머지는 주민 이름을 집 위(높이 6)에 띄웁니다
  // (useMemo·useCallback: 값이 같으면 같은 것을 다시 써서, 3D 장면이 "바뀐 게 없다"고 알아채게 합니다)
  const nameTags: NameTagData[] = useMemo(
    () =>
      village.residents.map((r, i) => ({
        id: r.id,
        label: r.isMe ? t.myHouse : r.name,
        isMe: r.isMe,
        position: [slots[i].x, 6, slots[i].z],
      })),
    [village.residents, slots, t.myHouse],
  );
  const mailboxLabel = useCallback((name: string) => t.mailboxLabel.replace("{name}", name), [t.mailboxLabel]);

  // ── 함께 걷기 (Task 025): 같은 마을에 접속해 있는 다른 주민들 ──
  // 다른 주민의 자리·목표 보관함. 3D가 직접 읽으므로, 누가 걸어도 이 화면 전체는 다시 그려지지 않습니다
  const [remoteStore] = useState(createRemoteStore);
  // 접속 중인 주민 목록 (캐릭터를 그리지 않는 9번째 접속자도 포함). 집 이름표의 초록 점에 씁니다
  const [onlineStore] = useState(createOnlineStore);
  // 내 캐릭터가 처음 서 있을 자리: 진짜 마을에서는 사람마다 조금씩 다른 자리 (모두 한 점에 겹쳐 서지 않게)
  const myId = realVillage?.residents.find((r) => r.isMe)?.id;
  const playerStart = useMemo(() => (myId ? spawnPoint(myId) : undefined), [myId]);
  // 개발용 가짜 주민 (?ghosts=5&ghostwalk=1). 실시간 통신 없이 다른 주민 그리기를 확인·측정합니다
  const residentTotal = village.residents.length;
  useEffect(() => {
    if (options.ghosts <= 0) return;
    return startGhosts({
      store: remoteStore,
      count: options.ghosts,
      walk: options.ghostwalk,
      obstacles: buildObstacles(slots),
      boundsRadius: walkRadius(residentTotal),
    });
  }, [options.ghosts, options.ghostwalk, remoteStore, slots, residentTotal]);
  // 다른 주민 캐릭터의 머리 위 이름표에 쓸 이름 (주민 id → 이름). 가짜 주민의 이름도 함께 넣습니다
  const remoteNames = useMemo(() => {
    const names: Record<string, string> = options.ghosts > 0 ? ghostNames(options.ghosts) : {};
    for (const r of village.residents) if (!r.isMe) names[r.id] = r.name;
    return names;
  }, [village.residents, options.ghosts]);

  // 다른 주민 캐릭터의 꾸미기 값 (주민 id → 값). 꾸민 적 없는 주민은 넣지 않습니다(기본 모습으로 그려짐).
  // 가짜 주민은 서로 다른 옷을 입혀 여러 모습을 한눈에 볼 수 있게 합니다
  const remoteParts = useMemo(() => {
    const map: Record<string, CharacterParts> = {};
    for (let i = 0; i < options.ghosts; i++) map[ghostId(i)] = partsFromSeed(ghostId(i));
    for (const r of village.residents) if (!r.isMe && r.characterParts) map[r.id] = r.characterParts;
    return map;
  }, [village.residents, options.ghosts]);

  // 3D 모델 파일을 받는 중인지 (drei가 다운로드 진행 상황을 알려 줍니다)
  const { active } = useProgress();

  // "이용 방법" 안내: 이 브라우저로 마을에 처음 들어온 사람에게 한 번 자동으로 띄웁니다.
  // - 3D 그림을 다 불러온 뒤(active가 false), 다른 창이 없을 때만 띄웁니다
  //   (입주 직후에는 꾸미기 창이 먼저 열려 있으므로, 그 창을 닫은 뒤에 뜹니다)
  // - 닫을 때 "봤음"을 기억해 두어 다시는 자동으로 뜨지 않습니다 (메뉴의 "이용 방법"으로 다시 볼 수 있습니다)
  const noOverlay = overlay === null;
  useEffect(() => {
    if (active || !noOverlay || loadIntroSeen()) return;
    const timer = setTimeout(() => setOverlay((prev) => prev ?? { kind: "howto" }), INTRO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active, noOverlay]);
  // 메뉴 버튼을 가리키는 한 번짜리 말풍선: 메뉴를 한 번 열면 다시 뜨지 않습니다 (이 브라우저에 기억)
  const [menuHint, setMenuHint] = useState(() => !loadMenuHintSeen());
  const openMenu = useCallback(() => {
    saveMenuHintSeen();
    setMenuHint(false);
    setOverlay({ kind: "menu" });
  }, []);
  const closeHowTo = useCallback(() => {
    saveIntroSeen();
    setOverlay(null);
  }, []);

  // D-day: 처음 한 번만 현재 시각으로 계산 (이 화면은 브라우저에서만 그려져서 서버와 어긋나지 않음)
  const [now] = useState(() => new Date());
  const dday = daysUntilChristmas(now);

  const villageName = village.name;

  // ── 마을 목록 (F017, Task 017) ──
  // 목록은 창을 열 때마다 새로 읽습니다 (다른 사람이 입주하거나 편지를 쓰면 주민 수·진행률이 바뀌기 때문에 기억해 두지 않습니다)
  const [villageList, setVillageList] = useState<{ status: "loading" | "ready" | "error"; rows: MyVillageRow[] | null }>({
    status: "loading",
    rows: null,
  });
  // 가장 마지막에 보낸 요청의 번호. 창을 빠르게 여러 번 열었을 때, 늦게 도착한 옛 답이 새 답을 덮어쓰지 않게 합니다
  const villageRequest = useRef(0);
  const openVillages = useCallback(() => {
    setOverlay({ kind: "villages" });
    if (village.isDemo) {
      // 연습용 마을: 데이터베이스를 부르지 않고 가짜 목록을 보여 줍니다.
      // 연습용 마을은 진행률을 "장식 단계 × 10%"로 보여 주므로(화면 위 숫자), 목록의 첫 칸도 같은 값이 나오게 쓴 개수를 거꾸로 계산합니다
      setVillageList({
        status: "ready",
        rows: dummyVillageRows({ id: village.id, name: village.name, residentCount, doneCount: Math.ceil((required * decorLevel) / 10) }),
      });
      return;
    }
    const request = ++villageRequest.current;
    setVillageList({ status: "loading", rows: null });
    void fetchMyVillages().then((rows) => {
      if (request !== villageRequest.current) return;
      setVillageList(rows ? { status: "ready", rows } : { status: "error", rows: null });
    });
  }, [village.isDemo, village.id, village.name, residentCount, required, decorLevel]);
  const villageItems = useMemo(
    () => (villageList.rows ? toVillageList(villageList.rows, village.id) : null),
    [villageList.rows, village.id],
  );
  const selectVillage = useCallback(
    (villageId: string) => {
      // 지금 보고 있는 마을을 누르면 창만 닫습니다
      if (villageId === village.id) {
        closeOverlay();
        return;
      }
      if (village.isDemo) {
        showToast(t.villageDemoNotice);
        return;
      }
      // 💡 일부러 "새로 열기"로 이동합니다. 마을이 바뀌면 집·주민·편지·실시간 연결이 모두 달라지는데,
      //    화면이 기억하고 있는 값(useState)은 부드러운 이동(router.push)으로는 새 마을 값으로 바뀌지 않기 때문입니다.
      //    이동하면 문지기(proxy.ts)가 "마지막으로 들어간 마을"도 새 마을로 바꿔 기억합니다.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/village/${encodeURIComponent(villageId)}`);
    },
    [village.id, village.isDemo, closeOverlay, showToast, t.villageDemoNotice],
  );
  const me = village.residents.find((r) => r.isMe);

  // ── 편지 ──
  // 진짜 마을: 데이터베이스에 저장합니다 (lib/letters/store.ts). 처음 목록은 서버가 읽어 준 값
  // 연습용 마을: 이 브라우저에만 저장하는 가짜 편지 (lib/dummy/letters.ts)
  //
  // lettersClosed: 편지 보내기가 끝났는지. 진짜 마을은 데이터베이스의 잠금 시각을 따르고,
  //   화면이 열려 있는 동안 마감이 지나 저장이 거절되면 그때 true로 바꿉니다
  const [lettersClosed, setLettersClosed] = useState(village.lettersClosed);
  // locked = 아직 12.25 전: 받은 편지는 못 읽고, 보낸 편지는 고치거나 지울 수 있습니다
  // (?unlock=1 잠금 풀어 보기는 연습용 마을에서만 듣습니다)
  const locked = realVillage ? !lettersClosed : options.unlock ? false : isLetterLocked(now);
  const [sentLetters, setSentLetters] = useState<SentLetter[]>(() =>
    realVillage ? realVillage.sentLetters : loadSentLetters(id, initialSentLetters(dummyVillage)),
  );
  // 목록을 바꿉니다. 연습용 마을은 이 브라우저의 저장 공간에도 함께 적어 둡니다
  const updateSentLetters = useCallback(
    (next: SentLetter[]) => {
      setSentLetters(next);
      if (!realVillage) saveSentLetters(id, next);
    },
    [id, realVillage],
  );
  // 편지를 쓰거나 지운 뒤: 진행 숫자를 다시 읽어 진행률·장식을 맞춥니다 (그 사이 다른 주민이 쓴 편지도 함께 반영됨)
  const router = useRouter();
  const shownResidentCount = village.residents.length;
  // 다시 읽기를 부른 순번. 여러 번 겹쳐 불렸을 때 "가장 나중에 부른 것"의 답만 씁니다
  // (먼저 부른 것의 답이 늦게 도착해서, 방금 올라간 트리가 옛 숫자로 되돌아가는 일을 막습니다)
  const progressCall = useRef(0);
  const refreshProgress = useCallback(async () => {
    const call = ++progressCall.current;
    const next = await fetchProgress(village.id);
    if (!next || call !== progressCall.current) return;
    setDoneCount(next.doneCount);
    setLiveResidentCount(next.residentCount);
    setLiveCapacity(next.capacity);
    // 새 주민이 들어와 있으면: 서버에서 마을 정보를 다시 받아 새 집을 그립니다 (화면 전체 새로고침 없이)
    if (next.residentCount > shownResidentCount) router.refresh();
  }, [village.id, shownResidentCount, router]);
  // 함께 걷기의 실시간 연결: 진짜 마을이고 기능이 켜져 있을 때만 엽니다 (lib/village/useLiveWalk.ts)
  // 화면이 모르는 주민(방금 입주한 사람)의 소식이 오면 진행 숫자를 다시 읽어 새 집을 그립니다
  const residentIds = useMemo(() => village.residents.map((r) => r.id), [village.residents]);
  const live = useLiveWalk({
    enabled: Boolean(liveWalk && realVillage && myId),
    villageId: village.id,
    myId,
    residentIds,
    boundsRadius: walkRadius(residentTotal),
    walkStore,
    remoteStore,
    onlineStore,
    onUnknownResident: refreshProgress,
    // 다른 주민이 편지를 쓰거나 지웠다는 알림이 오면 진행 숫자를 다시 읽어 트리를 바로 바꿉니다
    onProgressChanged: refreshProgress,
  });
  // 다른 앱을 보다가 돌아왔을 때도 진행 숫자를 다시 읽습니다 (그 사이 친구가 쓴 편지·새 주민을 반영)
  const isRealVillage = realVillage !== undefined;
  useEffect(() => {
    if (!isRealVillage) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshProgress();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isRealVillage, refreshProgress]);
  // 화면을 보고 있는 동안에는 정해진 간격으로도 진행 숫자를 다시 읽습니다 (11.28 사용자 요청: 새로고침 없이 트리가 바뀌게)
  // 💡 알림 방송(위의 onProgressChanged)이 오면 바로 바뀌지만, 함께 걷기가 꺼져 있거나 연결이 끊긴 때에는 방송이 오지 않습니다.
  //    그때에도 반영되도록 두는 안전망입니다. 숫자가 그대로면 화면은 다시 그려지지 않습니다.
  useEffect(() => {
    if (!isRealVillage) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      // 실시간 통로가 이어져 있으면 느리게(30초), 아니면 자주(10초) 확인합니다
      timer = setTimeout(
        () => {
          if (document.visibilityState === "visible" && navigator.onLine !== false) void refreshProgress();
          schedule();
        },
        live.isConnected() ? PROGRESS_POLL_LIVE_MS : PROGRESS_POLL_MS,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [isRealVillage, refreshProgress, live]);
  // 저장이 거절됐을 때의 안내
  // action: 무엇을 하다 실패했는지 ("save" = 쓰기·고치기, "delete" = 지우기) → 안내 문구가 달라집니다
  const showLetterError = useCallback(
    (reason: LetterError, action: "save" | "delete" = "save") => {
      if (reason === "closed") {
        setLettersClosed(true);
        showToast(t.lettersClosed);
      } else {
        showToast(action === "delete" ? t.letterDeleteFailed : t.letterSaveFailed);
      }
    },
    [showToast, t.lettersClosed, t.letterSaveFailed, t.letterDeleteFailed],
  );
  // 저장 요청을 보내는 중인지 (같은 편지가 두 번 보내지지 않게 막습니다)
  const letterBusy = useRef(false);
  // 내가 편지를 보낸 주민 id 목록 → 우체통의 "보냄" 표시에 씁니다
  const sentTo = useMemo(() => sentLetters.map((l) => l.recipientId), [sentLetters]);
  // 이 화면에서 방금 열어 본 편지의 "처음 연 시각" (편지 번호 → 시각). 서버가 준 목록 위에 덧씌웁니다
  const [openedHere, setOpenedHere] = useState<Record<string, string>>({});
  const received = useMemo(() => {
    const base = realVillage ? realVillage.receivedLetters : receivedLetters(dummyVillage, locked);
    return Object.entries(openedHere).reduce((list, [letterId, at]) => markOpenedInList(list, letterId, at), base);
  }, [realVillage, dummyVillage, locked, openedHere]);

  // 받은 편지 줄을 눌렀을 때: 읽기 창을 엽니다. 처음 여는 편지면 개봉 연출을 보여 주고 "열어 봤음"으로 기록합니다
  const handleLetterRead = useCallback(
    (letterId: string) => {
      const letter = received.find((l) => l.id === letterId);
      // 잠긴 편지(내용 없음)는 열 수 없습니다
      if (!letter || letter.content === null) return;
      // ⚠️ 처음 여는지는 "지금" 한 번만 정합니다. 바로 아래에서 읽음으로 바꾸기 때문에,
      //    나중에 다시 계산하면 false가 되어 연출이 중간에 끊깁니다
      const firstOpen = isUnread(letter);
      if (firstOpen) {
        setOpenedHere((prev) => ({ ...prev, [letterId]: new Date().toISOString() }));
        // 진짜 마을이면 데이터베이스에도 적습니다. 결과를 기다리지 않고, 실패해도 편지는 그대로 읽습니다
        if (realVillage) void markLetterOpened(letterId);
      }
      setOverlay({ kind: "read", letterId, firstOpen });
    },
    [received, realVillage],
  );
  // 지금 읽기 창에 떠 있는 편지 (없으면 undefined)
  const readingLetter = overlay?.kind === "read" ? received.find((l) => l.id === overlay.letterId) : undefined;

  // 편지함 열기. 12.25 0시를 넘겼는데 이 화면이 아직 "잠김"으로 알고 있으면(자정 전에 열어 둔 화면),
  // 화면을 한 번 새로 불러와 서버에서 편지를 받아 옵니다.
  // 💡 잠금을 푸는 것은 서버(데이터베이스)입니다. 휴대폰 시계를 앞당겨도 편지는 내려오지 않습니다.
  //    그런 경우 새로고침이 되풀이되지 않게, 이 탭에서 한 번만 합니다.
  const openLetterbox = useCallback(() => {
    if (realVillage && locked && !isLetterLocked(new Date()) && readSession(UNLOCK_RELOAD_KEY) === null) {
      writeSession(UNLOCK_RELOAD_KEY, "1");
      // 표시가 실제로 남았을 때만 새로 부릅니다 (저장이 막힌 브라우저에서 새로고침이 끝없이 되풀이되지 않게)
      if (readSession(UNLOCK_RELOAD_KEY) === "1") {
        window.location.reload();
        return;
      }
    }
    setOverlay({ kind: "letterbox" });
  }, [realVillage, locked]);

  // 말풍선 버튼을 눌렀을 때: 내 우체통이면 편지함, 친구 우체통이면 그 친구에게 편지 쓰기
  // (openLetterbox를 쓰기 때문에 그 아래에 둡니다)
  const openMailbox = useCallback(
    (residentId: string) => {
      const resident = village.residents.find((r) => r.id === residentId);
      if (!resident) return;
      if (resident.isMe) openLetterbox();
      else setOverlay({ kind: "write", residentId });
    },
    [village.residents, openLetterbox],
  );

  // 편지함의 보낸 편지 줄: 받는 사람 이름을 붙이고, 이 마을에 없는 사람의 편지는 뺍니다
  const sentRows: SentLetterRow[] = sentLetters.flatMap((l) => {
    const recipient = village.residents.find((r) => r.id === l.recipientId);
    return recipient
      ? [{ recipientId: l.recipientId, recipientName: recipient.name, content: l.content, paper: l.paper, edited: l.editedAt !== null }]
      : [];
  });

  // ── 캐릭터 꾸미기 값 (마을마다 따로 저장, D-05) ──
  // 진짜 마을: 데이터베이스의 내 주민 줄에 저장된 값 (아직 꾸민 적이 없으면 기본 모양)
  // 연습용 마을: 이 브라우저에 저장된 값
  const [characterParts, setCharacterParts] = useState<CharacterParts>(() =>
    village.isDemo ? loadCharacterParts(id) : (me?.characterParts ?? DEFAULT_PARTS),
  );
  const handlePartsConfirm = async (parts: CharacterParts) => {
    // 화면은 먼저 바꾸고(기다리지 않게), 저장 결과는 뒤에 알려 줍니다
    setCharacterParts(parts);
    closeOverlay();
    if (village.isDemo || !me) {
      saveCharacterParts(id, parts);
      showToast(t.customizeSaved);
      return;
    }
    const ok = await saveResidentParts(village.id, me.id, parts);
    showToast(ok ? t.customizeSaved : t.saveFailed);
  };

  const handleNicknameConfirm = async (nickname: string) => {
    // 이름이 그대로면 저장하지 않고 넘어갑니다
    if (me && !village.isDemo && nickname !== me.name) {
      const ok = await saveResidentNickname(village.id, me.id, nickname);
      if (!ok) {
        // 실패하면 창을 닫지 않습니다 (입력한 이름이 남아 있어 다시 누를 수 있게)
        showToast(t.saveFailed);
        return;
      }
      showToast(t.nicknameSaved);
      // 서버에서 마을을 다시 읽어 화면의 내 이름을 새 닉네임으로 바꿉니다
      router.refresh();
    }
    closeOverlay();
  };

  const writeTarget = overlay?.kind === "write" ? village.residents.find((r) => r.id === overlay.residentId) : undefined;
  // 그 친구에게 이미 보낸 편지가 있으면 "고치기" 모드가 됩니다
  const writeExisting = writeTarget ? sentLetters.find((l) => l.recipientId === writeTarget.id) : undefined;
  // 편지 쓰기 창의 처음 상태: 고치기면 보낸 글·편지지, 새 편지면 빈 글·기본 편지지
  const writeInitial: LetterDraft = {
    content: writeExisting?.content ?? "",
    paper: writeExisting?.paper ?? DEFAULT_PAPER,
  };
  // 그 친구에게 쓰다 만 글 (편지 쓰기 창은 열릴 때의 값만 씁니다)
  const writeDraft = writeTarget ? loadDraft(id, writeTarget.id) : null;
  // 쓰는 동안 글이 바뀔 때마다 임시 저장 (저장할 것이 없으면 지움)
  const handleDraftChange = (draft: LetterDraft | null) => {
    if (writeTarget) saveDraft(id, writeTarget.id, draft);
  };
  // 편지를 보냄(또는 고침): 저장하고, 목록에 넣고, 임시 글을 지우고, 창을 닫습니다
  const handleLetterSubmit = async (content: string, paper: LetterDraft["paper"]) => {
    if (!writeTarget) return;
    const done = (next: SentLetter[]) => {
      updateSentLetters(next);
      saveDraft(id, writeTarget.id, null);
      setOverlay(null);
      showToast(writeExisting ? t.letterEdited : t.letterSent);
    };

    // 연습용 마을: 이 브라우저에만 저장
    if (!realVillage || !me) {
      done(upsertLetter(sentLetters, writeTarget.id, content, paper, new Date()));
      return;
    }

    // 진짜 마을: 데이터베이스에 저장
    if (letterBusy.current) return;
    letterBusy.current = true;
    try {
      const result = writeExisting?.id
        ? await editLetter(writeExisting.id, content, paper)
        : await sendLetter({ villageId: village.id, senderId: me.id, recipientId: writeTarget.id, content, paper });
      if (result.ok) {
        done(putSentLetter(sentLetters, result.letter));
        void refreshProgress();
        // 새 편지면 편지 수가 늘었으므로, 접속해 있는 다른 주민에게 알려 그 화면의 트리도 바로 바뀌게 합니다 (고치기는 수가 그대로라 알리지 않음)
        if (!writeExisting?.id) live.announceProgress();
        return;
      }
      // 실패: 쓰던 글은 임시 저장에 남아 있으므로 창만 닫고 이유를 알려 줍니다
      setOverlay(null);
      if (result.reason === "duplicate" || result.reason === "not_found") {
        // 다른 기기에서 먼저 보냈거나 지운 경우: 목록을 데이터베이스와 다시 맞춥니다
        const fresh = await fetchSentLetters(village.id, me.id);
        if (fresh) updateSentLetters(fresh);
        void refreshProgress();
        showToast(result.reason === "duplicate" ? t.letterAlreadySent : t.letterSaveFailed);
      } else {
        showLetterError(result.reason);
      }
    } finally {
      letterBusy.current = false;
    }
  };
  // 보낸 편지를 지움 (편지함에서 "정말 지울까요?"에 답한 뒤)
  const handleLetterDelete = async (recipientId: string) => {
    const target = sentLetters.find((l) => l.recipientId === recipientId);
    if (!target) return;
    if (!realVillage || !target.id) {
      updateSentLetters(removeLetter(sentLetters, recipientId));
      showToast(t.letterDeleted);
      return;
    }
    if (letterBusy.current) return;
    letterBusy.current = true;
    try {
      const result = await deleteLetter(target.id);
      // not_found: 이미 지워진 편지 → 화면에서도 빼면 됩니다
      if (result.ok || result.reason === "not_found") {
        updateSentLetters(removeLetter(sentLetters, recipientId));
        void refreshProgress();
        live.announceProgress();
        showToast(t.letterDeleted);
      } else {
        showLetterError(result.reason, "delete");
      }
    } finally {
      letterBusy.current = false;
    }
  };
  // 편지 쓰기 창을 그냥 닫음: 쓰던 글이 임시 저장돼 있으면 알려 줍니다 (글이 사라지지 않았다는 안심)
  const closeWrite = () => {
    if (writeTarget && loadDraft(id, writeTarget.id)) showToast(t.letterDraftSaved);
    setOverlay(null);
  };
  const overlayOpen = overlay !== null;

  // 말풍선 버튼 글자. 창이 열려 있거나 트리 전체 보기 중이면 숨깁니다
  const nearResident = nearMailbox ? village.residents.find((r) => r.id === nearMailbox) : undefined;
  const promptLabel =
    nearResident && !overlayOpen && !isTreeView
      ? nearResident.isMe
        ? t.openLetterboxPrompt
        : t.writeLetterTitle.replace("{name}", nearResident.name)
      : null;
  const promptSent = nearResident && !nearResident.isMe && sentTo.includes(nearResident.id);

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
          sentTo={sentTo}
          mailboxLabel={mailboxLabel}
          onMailboxSelect={handleMailboxSelect}
          mailboxSpots={mailboxSpots}
          onNearMailboxChange={setNearMailbox}
          level={decorLevel}
          walkStore={walkStore}
          remoteStore={remoteStore}
          playerParts={characterParts}
          remoteParts={remoteParts}
          playerStart={playerStart}
          // 편지 쓰기 큰 창(화면의 93%)이 열려 있는 동안에는 뒤의 3D를 멈춥니다
          paused={overlay?.kind === "write" && locked}
          treeView={isTreeView}
          sky={sky}
          onGroundPointerDown={handleGroundPointerDown}
        />
      </div>

      {/* 이름표 글자 상자들 (3D 위에 겹침) */}
      <NameTagLayer tags={nameTags} onlineStore={onlineStore} />
      {/* 함께 걷는 다른 주민의 머리 위 이름표 */}
      <RemoteNameTagLayer store={remoteStore} names={remoteNames} />

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
            villageName={villageName}
            ddayText={dday.isDDay ? t.ddayDone : t.ddayLabel.replace("{n}", String(dday.days))}
            ddayCaption={dday.isDDay ? undefined : t.untilChristmas}
            percent={percent}
            progressAria={t.progressAria}
            onOpenGauge={toggleGauge}
            night={SKY_THEMES[sky].lightText}
          />
          {/* ?dev면 단계 슬라이더 (초대 카드는 없앴습니다 → 초대는 메뉴에서, 아래 메뉴 버튼 위의 말풍선이 알려 줍니다) */}
          <div className="flex flex-col gap-2 px-4">
            {options.dev && (
              <DevLevelBar level={decorLevel} max={MAX_DECOR_LEVEL} label={t.devLevel} onChange={setDevLevel} />
            )}
            {/* 단계가 올라간 순간의 안내 카드 */}
            <LevelUpCard
              data={
                levelUp && {
                  id: levelUp.id,
                  title: t.decorLevelUpTitle.replace("{n}", String(levelUp.level * 10)),
                  label: t.decorNewLabel,
                  names: t.decorNames[levelUp.level - 1] ?? "",
                }
              }
              onDone={clearLevelUp}
            />
            {/* 개발용: ?fps=1 이면 초당 장면 수 표시 */}
            {options.fps && <FpsMeter note={options.ghosts > 0 ? `ghosts ${options.ghosts}` : undefined} />}
          </div>
        </div>

        <BottomBar
          treeView={isTreeView}
          showHint={!overlayOpen && !isTreeView}
          labels={{ hint: t.tapHint, treeView: t.treeView, backToVillage: t.backToVillage, menu: t.menu }}
          onToggleTreeView={() => setTreeViewState((prev) => !prev)}
          // 말풍선은 다른 창이 없고 3D가 다 뜬 뒤에만 보입니다 (이용 방법 안내 창과 겹치지 않게)
          menuHint={menuHint && !active && !overlayOpen && !isTreeView ? t.menuHint : undefined}
          onOpenMenu={openMenu}
        />
      </div>

      <Toast message={toast} onDone={clearToast} />

      {/* 겹침 창들 (Overlay 뼈대 재사용) */}
      <Overlay
        open={overlay?.kind === "write"}
        onClose={closeWrite}
        title={t.writeLetterTitle.replace("{name}", writeTarget?.name ?? "")}
        // 편지 쓰기는 넓은 자리가 필요해서 화면을 거의 다 덮는 큰 창으로 엽니다 (잠금 뒤 안내만 보일 땐 작게)
        size={locked ? "full" : "auto"}
      >
        {writeTarget && (
          <LetterForm
            toName={writeTarget.name}
            fromName={me?.name ?? ""}
            initial={writeInitial}
            draft={writeDraft}
            mode={writeExisting ? "edit" : "new"}
            closed={!locked}
            onDraftChange={handleDraftChange}
            onSubmit={handleLetterSubmit}
          />
        )}
      </Overlay>
      <Overlay open={overlay?.kind === "letterbox"} onClose={closeOverlay} title={t.letterbox}>
        <LetterboxPanel
          received={received}
          sent={sentRows}
          locked={locked}
          daysLeft={dday.days}
          // 수정: 편지함을 닫고 그 친구에게 쓰는 창을 "고치기" 모드로 엽니다
          onRead={handleLetterRead}
          onEdit={(recipientId) => setOverlay({ kind: "write", residentId: recipientId })}
          onDelete={handleLetterDelete}
        />
      </Overlay>
      {/* 받은 편지 읽기 창. 닫으면 편지함으로 돌아갑니다 (다음 편지를 이어서 읽기 쉽게) */}
      <Overlay
        open={overlay?.kind === "read" && readingLetter !== undefined}
        onClose={() => setOverlay({ kind: "letterbox" })}
        title={t.letterReadTitle.replace("{name}", readingLetter?.senderName ?? "")}
      >
        {overlay?.kind === "read" && readingLetter && readingLetter.content !== null && (
          <LetterReader
            // key: 다른 편지를 열면 연출 상태를 처음부터 다시 시작합니다
            key={readingLetter.id}
            senderName={readingLetter.senderName ?? ""}
            content={readingLetter.content}
            paper={readingLetter.paper ?? DEFAULT_PAPER}
            firstOpen={overlay.firstOpen}
          />
        )}
      </Overlay>
      {/* 진행률 게이지 (F008) */}
      {/* 큰 창(Overlay)이 아니라 화면 아래의 얇은 띠라서, 마을이 그대로 보이고 누를 수도 있습니다 */}
      {overlay?.kind === "gauge" && (
        <GaugePanel
          level={decorLevel}
          percent={percent}
          names={t.decorNames}
          labels={{ title: t.gaugeTitle, hint: t.gaugeHint, locked: t.gaugeLocked, close: t.close }}
          onPick={pickGaugeStage}
          onClose={closeOverlay}
        />
      )}
      <Overlay open={overlay?.kind === "customize"} onClose={closeOverlay} title={t.customize}>
        <CharacterEditor
          initial={characterParts}
          onConfirm={handlePartsConfirm}
        />
      </Overlay>
      <Overlay open={overlay?.kind === "nickname"} onClose={closeOverlay} title={t.nicknameTitle}>
        {/* key: 이름이 바뀌면 입력칸을 새 이름으로 다시 시작합니다 */}
        {me && <NicknameForm key={me.name} currentName={me.name} onConfirm={handleNicknameConfirm} />}
      </Overlay>
      {/* 마을 목록 (F017): 칸을 누르면 그 마을로 이동합니다 */}
      <Overlay open={overlay?.kind === "villages"} onClose={closeOverlay} title={t.villages}>
        <VillageListPanel items={villageItems} status={villageList.status} onSelect={selectVillage} onRetry={openVillages} />
      </Overlay>
      <HowToPlay open={overlay?.kind === "howto"} onClose={closeHowTo} />
      <MenuSheet
        open={overlay?.kind === "menu"}
        labels={{
          title: t.menu,
          letterbox: t.letterbox,
          customize: t.customize,
          nickname: t.nickname,
          invite: t.invite,
          villages: t.villages,
          skyMode: t.skyMode,
          skyNames: { day: t.skyDay, night: t.skyNight },
          language: t.language,
          howTo: t.howToOpen,
          logout: t.logout,
          comingSoon: t.appComingSoon,
        }}
        // 메뉴의 기능 타일: 메뉴를 닫고(또는 다른 창으로 바꾸고) 그 기능을 실행합니다
        onOpenLetterbox={openLetterbox}
        onOpenCustomize={() => setOverlay({ kind: "customize" })}
        onCopyInvite={() => {
          closeOverlay();
          void copyInvite();
        }}
        onOpenVillages={openVillages}
        onOpenHowTo={() => setOverlay({ kind: "howto" })}
        // 닉네임은 진짜 마을에서만 바꿀 수 있습니다 (연습용 마을은 저장할 곳이 없음)
        onOpenNickname={village.isDemo ? undefined : () => setOverlay({ kind: "nickname" })}
        sky={sky}
        onSkyChange={changeSky}
        locale={locale}
        onLocaleChange={changeLocale}
        onClose={closeOverlay}
        // 로그아웃: 로그인 상태(쿠키)를 지우고 로그인 화면으로 갑니다.
        // window.location으로 "새로 열기"를 해서, 브라우저에 남아 있던 이전 사람의 화면 기억도 함께 비웁니다
        onLogout={() => {
          closeOverlay();
          void createSupabaseClient()
            .auth.signOut()
            .catch(() => undefined)
            // 일부러 router.push가 아닌 "새로 열기"를 씁니다 (이전 사람의 화면 기억을 비우기 위해)
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            .finally(() => window.location.assign("/"));
        }}
      />
    </main>
    </LocaleContext.Provider>
  );
}
