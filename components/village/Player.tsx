"use client";

// 마을을 걸어 다니는 내 캐릭터입니다. (KayKit Rogue 모델)
// - 땅을 누르면(target이 바뀌면) 그 자리로 일정한 속도로 걸어갑니다.
// - 가는 방향으로 부드럽게 몸을 돌리고, 도착하면 멈춥니다.
// - 서 있을 땐 Unarmed_Idle, 걸을 땐 Walking_A 동작을 서로 부드럽게 섞어 보여 줍니다.
// - 트리·집·우체통·가로등과 마을 경계는 buildObstacles가 만든 동그라미로 막습니다.
// 💡 "한 장면 동안 얼마나 걷는지" 계산은 lib/village/walker.ts에 있습니다. (Task 025-2)
//    같은 마을에 접속한 다른 주민(RemotePlayers.tsx)도 같은 계산을 써서, 누구의 화면에서든 똑같이 걷습니다.

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { buildObstacles, type Point } from "@/lib/village/collision";
import { PLAYER_START, type HouseSlot } from "@/lib/village/layout";
import { createWalker, planRoute, stepWalker } from "@/lib/village/walker";
import { useWalkTarget, type WalkStore } from "@/lib/village/walkStore";
import { PLAYER_OBJECT_NAME } from "./FollowCamera";
import { CHARACTER_MODEL_URL, FADE_SECONDS, IDLE_CLIP, WALK_CLIP, prepareCharacter } from "./characterModel";
import { useNight } from "./nightContext";
import { softDot } from "./particles";

/** 캐릭터 크기 배율 */
export const PLAYER_SCALE = 1;
/** 그림자를 만들지 않는 물체라는 표시 (ShadowFlags.tsx가 읽습니다). 움직이는 캐릭터는 발밑의 둥근 그림자로 대신합니다 */
export const NO_SHADOW_CAST = { noShadowCast: true } as const;

interface PlayerProps {
  /** 걸어갈 목표가 담긴 보관함. 목표가 바뀌면 캐릭터만 다시 그려집니다 (lib/village/walkStore.ts) */
  store: WalkStore;
  /** 집 자리 (충돌 계산용) */
  slots: HouseSlot[];
  /** 마을 경계 반지름 (이 안에서만 걸을 수 있음) */
  boundsRadius: number;
  /** 땅 높이. 눈 둔덕을 오르내리며 걷도록 발 높이를 맞춥니다 */
  heightAt: (x: number, z: number) => number;
  /** 처음 서 있을 자리. 주지 않으면 광장 앞 기본 자리(PLAYER_START) */
  start?: Point;
}

export function Player({ store, slots, boundsRadius, heightAt, start }: PlayerProps) {
  // 걸어갈 목표. 땅을 누를 때마다 id가 바뀝니다. 없으면 제자리
  const target = useWalkTarget(store);
  const night = useNight();
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(CHARACTER_MODEL_URL);

  // 받아 온 모델에서 캐릭터 한 명을 복사합니다 (characterModel.ts)
  const model = useMemo(() => prepareCharacter(scene), [scene]);

  const { actions } = useAnimations(animations, group);
  const obstacles = useMemo(() => buildObstacles(slots), [slots]);

  // 처음 서 있을 자리 (처음 한 번만 정합니다. 나중에 값이 바뀌어도 캐릭터가 갑자기 옮겨 가지 않게)
  const [spawn] = useState(() => {
    const p = start ?? PLAYER_START;
    return { x: p.x, y: start ? heightAt(p.x, p.z) : 0, z: p.z };
  });

  // 걷기 상태 (자리·방향·앞으로 지나갈 경유지). 화면을 다시 그리지 않고 프레임마다 바로 읽고 씁니다
  const walker = useRef(createWalker(spawn.x, spawn.z));
  const walking = useRef(false);

  // 새 목표가 들어오면 지금 서 있는 곳에서 그 목표까지, 트리·집을 돌아가는 길을 찾습니다 (walker.ts의 planRoute)
  useEffect(() => {
    if (!target) return;
    planRoute(walker.current, target, obstacles, boundsRadius);
  }, [target, obstacles, boundsRadius]);

  // 처음 선 자리를 보관함에 적어 둡니다 (함께 걷기에서 다른 주민에게 내 자리를 알릴 때 씁니다)
  useEffect(() => {
    store.setPos(walker.current.x, walker.current.z);
  }, [store]);

  // 처음에는 서 있는 동작
  useEffect(() => {
    actions[IDLE_CLIP]?.reset().fadeIn(0.1).play();
  }, [actions]);

  // 동작 바꾸기: 지금 동작을 서서히 끄고 새 동작을 서서히 켭니다 (cross-fade)
  const setWalking = (next: boolean) => {
    if (walking.current === next) return;
    walking.current = next;
    const from = actions[next ? IDLE_CLIP : WALK_CLIP];
    const to = actions[next ? WALK_CLIP : IDLE_CLIP];
    from?.fadeOut(FADE_SECONDS);
    to?.reset().fadeIn(FADE_SECONDS).play();
  };

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const w = walker.current;
    // 서 있는 중이면(경유지가 없으면) 아무것도 하지 않습니다
    if (w.route.length === 0) return;
    const before = w.route.length;
    const x = w.x;
    const z = w.z;
    const stillWalking = stepWalker(w, delta, obstacles, boundsRadius);
    if (!stillWalking) {
      // 도착했거나 막혀서 멈춤
      setWalking(false);
      return;
    }
    // 경유지 하나에 막 도착한 장면: 자리는 그대로이고 다음 경유지로 넘어가기만 합니다
    if (w.route.length !== before && w.x === x && w.z === z) return;
    g.rotation.y = w.rotY;
    g.position.x = w.x;
    g.position.z = w.z;
    // 둔덕 높이에 발을 맞춥니다 (계산은 이 한 점뿐이라 가볍습니다)
    g.position.y = heightAt(w.x, w.z);
    store.setPos(w.x, w.z);
    setWalking(true);
  });

  return (
    <group
      ref={group}
      name={PLAYER_OBJECT_NAME}
      position={[spawn.x, spawn.y, spawn.z]}
      scale={PLAYER_SCALE}
      userData={NO_SHADOW_CAST}
    >
      <primitive object={model} />
      {/* 밤: 발밑의 둥근 그림자 (달빛 그림자를 매번 다시 그리지 않으려고 캐릭터 그림자는 이걸로 대신합니다) */}
      {night && (
        <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <planeGeometry args={[1.3, 1.3]} />
          <meshBasicMaterial map={softDot()} color="#0b1030" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

useGLTF.preload(CHARACTER_MODEL_URL);
