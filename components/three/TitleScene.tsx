"use client";

// 첫 화면(로그인 화면)의 배경입니다: 눈 내리는 밤, 어느 집 앞 우체통을 가까이에서 보여 줍니다. (11.27 사용자 요청: 메인 화면 다시 만들기)
//
// 💡 왜 우체통인가요?
//    이 서비스는 "편지를 주고받으며 트리를 완성해 가는" 곳입니다. 처음부터 다 꾸며진 트리를 보여 주면
//    완성했을 때의 기쁨이 줄어듭니다(11.27 사용자 의견). 그래서 첫 화면의 주인공은 편지가 오가는 우체통이고,
//    대왕 트리는 그 뒤에 아직 아무 장식도 없는 어두운 모습으로만 서 있습니다.
// 💡 참고한 게임: 모여봐요 동물의 숲의 타이틀 화면처럼, 따로 그린 그림이 아니라 실제 마을의 3D 부품
//    (트리·집·우체통·숲·눈)을 그대로 보여 줍니다. 새로 만든 것은 카메라 하나뿐이고 빛도 마을 화면의 것(가짜 빛)입니다.
//
// 캐릭터·이름표·말풍선 버튼은 없습니다. 구경만 하는 화면이라 누를 수 있는 것이 없습니다.

import { Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Ground } from "@/components/village/Ground";
import { GiantTree } from "@/components/village/GiantTree";
import { House } from "@/components/village/House";
import { Mailbox, MailboxWreaths } from "@/components/village/Mailbox";
import { Lamps } from "@/components/village/Lamps";
import { Forest } from "@/components/village/Forest";
import { Fence } from "@/components/village/Fence";
import { Decorations } from "@/components/village/Decorations";
import { ChimneySmoke } from "@/components/village/ChimneySmoke";
import { NightAtmosphere } from "@/components/village/NightAtmosphere";
import { NightContext } from "@/components/village/nightContext";
import { ShadowFlags } from "@/components/village/ShadowFlags";
import { SkyEffects } from "@/components/village/SkyEffects";
import { CAMERA_FOV } from "@/components/village/FollowCamera";
import { FENCE_MARGIN, houseSlots, ringRadius, type HouseSlot } from "@/lib/village/layout";
import { createTerrain } from "@/lib/village/terrain";
import { SKY_THEMES, VILLAGE_COLORS } from "@/lib/village/theme";

/** 보여 줄 집의 수 */
const HOUSES = 6;
/**
 * 보여 줄 장식 단계: 0 = 아직 아무것도 꾸미지 않은 마을.
 * 장식은 편지를 쓰며 직접 채워 가는 것이라 여기서는 보여 주지 않습니다 (대왕 트리는 이 화면에 나오지도 않습니다).
 */
const LEVEL = 0;

/**
 * 카메라 자리 (주인공 우체통 기준, 단위는 3D 공간의 길이)
 * - out: 우체통에서 마을 바깥쪽으로 간 거리. 음수라서 "광장 쪽(안쪽)"에 서서 집 앞면을 바라봅니다
 * - side: 옆으로 비켜선 거리 (정면이 아니라 비스듬히 봐야 집이 입체적으로 보입니다)
 * - height: 카메라 높이 / lookHeight: 바라보는 높이
 * - lookOut·lookSide: 우체통에서 집 쪽(깊이)·옆으로 얼마나 비켜난 곳을 바라볼지 (세로 화면에서 집이 잘리지 않게 맞춘 값)
 */
const SHOT = {
  portrait: { out: -6, side: 10.2, height: 3.8, lookHeight: 1.9, lookOut: 2.3, lookSide: 0 },
  landscape: { out: -5.2, side: 7.6, height: 3.4, lookHeight: 2.3, lookOut: 1.3, lookSide: 0 },
};
/** 좌우로 천천히 흔들리는 폭(라디안)과 한 번 왕복하는 시간(초) */
const SWAY = { angle: 0.09, seconds: 46 };

/** 우체통을 가까이에서 바라보며 좌우로 아주 천천히 움직이는 카메라 */
function MailboxCamera({ slot }: { slot: HouseSlot }) {
  // "움직임 줄이기"를 켠 사람에게는 움직이지 않고 한 자리에서 보여 줍니다
  const still = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useFrame(({ camera, clock, size }) => {
    const t = still ? 0 : clock.elapsedTime;
    const shot = size.width < size.height ? SHOT.portrait : SHOT.landscape;
    const { x: mx, z: mz } = slot.mailbox;
    // 마을 가운데(트리)에서 집 쪽을 가리키는 방향(바깥쪽)과, 그 옆 방향
    const length = Math.hypot(slot.x, slot.z) || 1;
    const outX = slot.x / length;
    const outZ = slot.z / length;
    const sideX = -outZ;
    const sideZ = outX;
    // 우체통을 가운데 두고 좌우로 조금씩 도는 움직임
    const sway = Math.sin((t / SWAY.seconds) * Math.PI * 2) * SWAY.angle;
    const dx = outX * shot.out + sideX * shot.side;
    const dz = outZ * shot.out + sideZ * shot.side;
    const cos = Math.cos(sway);
    const sin = Math.sin(sway);
    camera.position.set(mx + dx * cos - dz * sin, shot.height + Math.sin(t * 0.21) * 0.12, mz + dx * sin + dz * cos);
    camera.lookAt(
      mx + outX * shot.lookOut + sideX * shot.lookSide,
      shot.lookHeight,
      mz + outZ * shot.lookOut + sideZ * shot.lookSide,
    );
  });
  return null;
}

const NO_OP = () => {};

export default function TitleScene() {
  const theme = SKY_THEMES.night;
  const slots = useMemo(() => houseSlots(HOUSES), []);
  const fence = ringRadius(HOUSES) + FENCE_MARGIN;
  const detailRadius = fence + 30;
  const terrain = useMemo(() => createTerrain(slots, fence, detailRadius), [slots, fence, detailRadius]);
  // 주인공 집: 가장 오른쪽(x가 가장 큰) 집. 광장 건너편에도 집이 있어서 배경에 불 켜진 창이 보입니다
  const hero = useMemo(() => slots.reduce((best, slot) => (slot.x > best.x ? slot : best)), [slots]);

  return (
    <Canvas dpr={[1, 2]} camera={{ fov: CAMERA_FOV, near: 0.5, far: 300 }} gl={{ stencil: true }} shadows>
      <NightContext.Provider value={true}>
        <color attach="background" args={[theme.sky]} />
        <fog attach="fog" args={[theme.sky, ...theme.fog]} />

        <Suspense fallback={null}>
          <NightAtmosphere villageRadius={fence} slots={slots} />
        </Suspense>
        <ShadowFlags />
        <SkyEffects />
        <MailboxCamera slot={hero} />

        <Suspense fallback={null}>
          <Ground radius={ringRadius(HOUSES) + 80} detailRadius={detailRadius} terrain={terrain} />
          <GiantTree />
          <Lamps />
          <Fence radius={fence} />
          <Forest villageRadius={fence} heightAt={terrain.heightAt} />
          {slots.map((slot, i) => (
            <group key={i}>
              <House
                position={[slot.x, 0, slot.z]}
                rotation={slot.rotation}
                wallColor={VILLAGE_COLORS.walls[i % VILLAGE_COLORS.walls.length]}
              />
              {/* 우체통: 이 화면에서는 눌러도 아무 일이 없습니다 (배경 전체가 손가락에 반응하지 않게 해 두었습니다) */}
              <Mailbox
                residentId={String(i)}
                label=""
                position={[slot.mailbox.x, 0, slot.mailbox.z]}
                rotation={slot.rotation}
                sent={false}
                onSelect={NO_OP}
              />
            </group>
          ))}
          <MailboxWreaths slots={slots} />
          <Decorations level={LEVEL} slots={slots} />
          <ChimneySmoke slots={slots} sky="night" />
        </Suspense>
      </NightContext.Provider>
    </Canvas>
  );
}
