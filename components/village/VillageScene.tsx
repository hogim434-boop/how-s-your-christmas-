"use client";

// 마을의 3D 장면 전체(하늘·빛·카메라·땅·집·숲·캐릭터·장식)를 조립하는 파일입니다.

import { memo, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Ground } from "./Ground";
import { GiantTree } from "./GiantTree";
import { House } from "./House";
import { Mailbox, MailboxWreaths } from "./Mailbox";
import { Lamps } from "./Lamps";
import { Forest } from "./Forest";
import { Fence } from "./Fence";
import { Player } from "./Player";
import { RemotePlayers } from "./RemotePlayers";
import { TapMarker } from "./TapMarker";
import { Decorations } from "./Decorations";
import { CAMERA_FOV, FollowCamera } from "./FollowCamera";
import { NameTagProjector, type NameTagData } from "./NameTag";
import { MailboxPromptProjector } from "./MailboxPrompt";
import type { Spot } from "@/lib/village/proximity";
import { FENCE_INNER_GAP, FENCE_MARGIN, type HouseSlot } from "@/lib/village/layout";
import { createTerrain } from "@/lib/village/terrain";
import type { WalkStore } from "@/lib/village/walkStore";
import type { RemoteStore } from "@/lib/village/remoteStore";
import type { Point } from "@/lib/village/collision";
import { SKY_THEMES, VILLAGE_COLORS, type SkyMode } from "@/lib/village/theme";
import { ShadowFlags } from "./ShadowFlags";
import { NightContext } from "./nightContext";
import { NightAtmosphere } from "./NightAtmosphere";
import { VillageSnow } from "./VillageSnow";
import { ChimneySmoke } from "./ChimneySmoke";
import { SkyEffects } from "./SkyEffects";
import type { DummyResident } from "@/lib/dummy/village";
import type { CharacterParts } from "@/types/domain";
import { hasDecor } from "@/lib/decor/decorTable";

interface VillageSceneProps {
  residents: DummyResident[];
  /** 집 자리 (houseSlots 결과). residents와 같은 순서·같은 개수 */
  slots: HouseSlot[];
  /** 집이 놓인 원의 반지름 (경계·숲 위치 계산용) */
  villageRadius: number;
  /** 이름표 데이터 (글자 상자는 3D 바깥 HTML에서 그림) */
  nameTags: NameTagData[];
  /** 내가 편지를 보낸 주민 id 목록 */
  sentTo: string[];
  /** 우체통 접근성 이름 만들기 (주민 이름 → 문장) */
  mailboxLabel: (name: string) => string;
  /** 장식 단계 (0~10) */
  level: number;
  /** 캐릭터가 걸어갈 목표가 담긴 보관함 (lib/village/walkStore.ts) */
  walkStore: WalkStore;
  /** 같은 마을에 접속해 있는 다른 주민들의 자리·목표 보관함 (lib/village/remoteStore.ts). 비어 있으면 아무도 그리지 않습니다 */
  remoteStore: RemoteStore;
  /** 내 캐릭터의 꾸미기 값 */
  playerParts: CharacterParts;
  /** 다른 주민의 꾸미기 값 (주민 id → 값) */
  remoteParts: Readonly<Record<string, CharacterParts>>;
  /** 내 캐릭터가 처음 서 있을 자리. 없으면 광장 앞 기본 자리 */
  playerStart?: Point;
  /**
   * true면 3D를 계속 그리지 않고 멈춰 둡니다. (11.26 성능)
   * 편지 쓰기 창이 화면의 93%를 덮는 동안에는 뒤의 마을을 그려 봐야 보이지 않아서,
   * 그 시간과 전기를 글자 입력에 양보합니다. 창을 닫으면 다시 움직입니다.
   */
  paused: boolean;
  /** true면 카메라가 트리 전체를 보여 주는 자리로 이동 */
  treeView: boolean;
  /** 하늘: 아침 / 밤 */
  sky: SkyMode;
  onMailboxSelect: (residentId: string) => void;
  /** 우체통 자리 목록 (가까이 가면 뜨는 "편지 쓰기" 버튼용) */
  mailboxSpots: Spot[];
  /** 캐릭터 가까이의 우체통이 바뀌었을 때 (없으면 null) */
  onNearMailboxChange: (residentId: string | null) => void;
  /** 땅을 눌렀을 때 (눌린 곳의 3D 좌표) */
  onGroundPointerDown: (point: { x: number; y: number; z: number }) => void;
}

function VillageScene({
  residents,
  slots,
  villageRadius,
  nameTags,
  sentTo,
  mailboxLabel,
  level,
  walkStore,
  remoteStore,
  playerParts,
  remoteParts,
  playerStart,
  paused,
  treeView,
  sky,
  onMailboxSelect,
  mailboxSpots,
  onNearMailboxChange,
  onGroundPointerDown,
}: VillageSceneProps) {
  const theme = SKY_THEMES[sky];
  // 울퉁불퉁한 눈밭: 숲 끝(울타리 + 30)까지. 그 바깥은 평평한 먼 눈밭
  const fence = villageRadius + FENCE_MARGIN;
  const detailRadius = fence + 30;
  // 지형은 집 자리·마을 크기가 바뀔 때만 다시 만듭니다
  const terrain = useMemo(() => createTerrain(slots, fence, detailRadius), [slots, fence, detailRadius]);
  return (
    <Canvas
      // frameloop: "always"는 매 장면 계속 그리기, "demand"는 꼭 필요할 때(화면 크기가 바뀔 때 등)만 그리기
      frameloop={paused ? "demand" : "always"}
      // dpr: 해상도 배율을 1~2배로 제한해 배터리와 속도를 아낍니다
      // (11.25: 1.5배 제한 + 자동 낮추기를 써 봤지만 화질이 눈에 띄게 나빠져 사용자 요청으로 되돌림)
      dpr={[1, 2]}
      camera={{ fov: CAMERA_FOV, near: 0.5, far: 300 }}
      // stencil: 반투명한 집 뒤의 우체통·캐릭터를 또렷하게 보이게 하는 "도장 판"을 켭니다 (showThrough.ts)
      gl={{ stencil: true }}
      // shadows: 그림자 기능 켜기. 실제 그림자는 밤의 달빛만 만듭니다 (낮에는 그림자 계산 없음)
      shadows
    >
      {/* 장면 안의 전구·가로등이 지금 밤인지 알 수 있게 합니다 */}
      <NightContext.Provider value={sky !== "day"}>
      {/* 하늘색 배경 + 먼 곳이 하늘색으로 흐려지는 안개 */}
      <color attach="background" args={[theme.sky]} />
      <fog attach="fog" args={[theme.sky, ...theme.fog]} />

      {sky === "day" ? (
        <>
          {/* 아침 조명: 그림자 없이 은은한 하늘빛 + 해 방향 빛 (휴대폰 성능을 위해) */}
          <hemisphereLight args={["#ffffff", "#dbe6f2", 2.0]} />
          <directionalLight position={[8, 16, 10]} intensity={1.1} />
          {/* 아침에도 내리는 눈 (시안 미니어처: 흰색, 불투명도 0.75) */}
          <VillageSnow villageRadius={villageRadius + FENCE_MARGIN} color="#ffffff" opacity={0.75} />
        </>
      ) : (
        <>
          {/* Suspense: 별 등 준비하는 동안 기다림 */}
          <Suspense fallback={null}>
            {/* 밤 = 예전 시안 "미니어처 밤" */}
            <NightAtmosphere villageRadius={villageRadius + FENCE_MARGIN} slots={slots} heightAt={terrain.heightAt} />
          </Suspense>
          {/* 그림자를 만들고 받을 물체 표시 */}
          <ShadowFlags />
          {/* 빛 번짐 등 화면 필터 */}
          <SkyEffects />
        </>
      )}

      <FollowCamera treeView={treeView} />
      <NameTagProjector tags={nameTags} />
      <MailboxPromptProjector spots={mailboxSpots} onNearChange={onNearMailboxChange} />

      {/* 모델 파일을 받는 동안은 하늘색 배경만 보입니다 (불러오는 중 문구는 VillageView가 HTML로 띄움) */}
      <Suspense fallback={null}>
        <Ground
          radius={villageRadius + 80}
          detailRadius={detailRadius}
          terrain={terrain}
          onGroundPointerDown={onGroundPointerDown}
        />
        <GiantTree lit={hasDecor(level, "tree_lights_upgrade")} />
        <Lamps />
        {/* 울타리: 집 원보다 바깥. 숲은 울타리 바깥에 심습니다 */}
        <Fence radius={villageRadius + FENCE_MARGIN} />
        <Forest villageRadius={villageRadius + FENCE_MARGIN} heightAt={terrain.heightAt} />

        {residents.map((resident, i) => {
          const slot = slots[i];
          return (
            <group key={resident.id}>
              <House
                position={[slot.x, 0, slot.z]}
                rotation={slot.rotation}
                wallColor={VILLAGE_COLORS.walls[i % VILLAGE_COLORS.walls.length]}
              />
              <Mailbox
                residentId={resident.id}
                label={mailboxLabel(resident.name)}
                position={[slot.mailbox.x, 0, slot.mailbox.z]}
                rotation={slot.rotation}
                sent={sentTo.includes(resident.id)}
                onSelect={onMailboxSelect}
              />
            </group>
          );
        })}

        {/* 우체통 리스는 모든 우체통 것을 한 번에 그립니다 */}
        <MailboxWreaths slots={slots} />

        <Decorations level={level} slots={slots} />
        {/* 집집마다 굴뚝 연기 (아침·밤 모두) */}
        <ChimneySmoke slots={slots.slice(0, residents.length)} sky={sky} />
        {/* 걸을 수 있는 범위: 울타리 바로 안쪽까지 */}
        <Player
          parts={playerParts}
          store={walkStore}
          slots={slots}
          boundsRadius={villageRadius + FENCE_MARGIN - FENCE_INNER_GAP}
          heightAt={terrain.heightAt}
          start={playerStart}
        />
        {/* 함께 걷기: 같은 마을에 접속해 있는 다른 주민들 (보관함이 비어 있으면 아무것도 그리지 않음) */}
        <RemotePlayers
          store={remoteStore}
          partsById={remoteParts}
          slots={slots}
          boundsRadius={villageRadius + FENCE_MARGIN - FENCE_INNER_GAP}
          heightAt={terrain.heightAt}
        />
        <TapMarker store={walkStore} heightAt={terrain.heightAt} />
      </Suspense>
      </NightContext.Provider>
    </Canvas>
  );
}

// memo: 넘겨받는 값이 하나도 안 바뀌면 이 부품(3D 장면 전체)을 다시 훑지 않습니다. (11.26 성능)
// 우체통 가까이 갈 때·안내 문구가 뜰 때·메뉴를 열 때마다 장면 전체를 다시 훑던 일을 없앱니다.
export default memo(VillageScene);
