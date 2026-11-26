"use client";

// 마을을 걸어 다니는 내 캐릭터입니다. (KayKit Rogue 모델)
// - 땅을 누르면(target이 바뀌면) 그 자리로 일정한 속도로 걸어갑니다.
// - 가는 방향으로 부드럽게 몸을 돌리고, 도착하면 멈춥니다.
// - 서 있을 땐 Unarmed_Idle, 걸을 땐 Walking_A 동작을 서로 부드럽게 섞어 보여 줍니다.
// - 트리·집·우체통·가로등과 마을 경계는 buildObstacles가 만든 동그라미로 막습니다.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { buildObstacles, resolveCollisions } from "@/lib/village/collision";
import { PLAYER_START, type HouseSlot } from "@/lib/village/layout";
import { useWalkTarget, type WalkStore } from "@/lib/village/walkStore";
import { PLAYER_OBJECT_NAME } from "./FollowCamera";
import { markShowThrough } from "./showThrough";
import { useNight } from "./nightContext";
import { softDot } from "./particles";

const MODEL_URL = "/models/character/Rogue.glb";
/** 걷는 속도 (3D 길이 단위/초) */
const WALK_SPEED = 4.5;
/** 몸 반지름 (충돌 계산용) */
const BODY_RADIUS = 0.5;
/** 도착으로 보는 거리 */
const ARRIVE_DISTANCE = 0.08;
/** 몸 돌리는 빠르기 (클수록 빨리 돌아봄) */
const TURN_SPEED = 12;
/** 동작 섞는 시간(초) */
const FADE_SECONDS = 0.25;
/** 캐릭터 크기 배율 */
const PLAYER_SCALE = 1;
/** 무기 모델(캐릭터 손에 붙어 있는 칼·석궁)은 숨깁니다 */
const HIDDEN_PARTS = ["Knife_Offhand", "1H_Crossbow", "2H_Crossbow", "Knife", "Throwable"];

const IDLE_CLIP = "Unarmed_Idle";
const WALK_CLIP = "Walking_A";

interface PlayerProps {
  /** 걸어갈 목표가 담긴 보관함. 목표가 바뀌면 캐릭터만 다시 그려집니다 (lib/village/walkStore.ts) */
  store: WalkStore;
  /** 집 자리 (충돌 계산용) */
  slots: HouseSlot[];
  /** 마을 경계 반지름 (이 안에서만 걸을 수 있음) */
  boundsRadius: number;
  /** 땅 높이. 눈 둔덕을 오르내리며 걷도록 발 높이를 맞춥니다 */
  heightAt: (x: number, z: number) => number;
}

export function Player({ store, slots, boundsRadius, heightAt }: PlayerProps) {
  // 걸어갈 목표. 땅을 누를 때마다 id가 바뀝니다. 없으면 제자리
  const target = useWalkTarget(store);
  const night = useNight();
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);

  // 스킨(뼈대) 모델은 일반 clone이 아니라 SkeletonUtils.clone으로 복사해야 합니다
  const model = useMemo(() => {
    const copy = cloneSkinned(scene);
    copy.traverse((child) => {
      if (HIDDEN_PARTS.includes(child.name)) child.visible = false;
    });
    // 반투명해진 집 뒤에 있어도 캐릭터는 또렷하게 보이게 합니다 (showThrough.ts)
    markShowThrough(copy);
    return copy;
  }, [scene]);

  const { actions } = useAnimations(animations, group);
  const obstacles = useMemo(() => buildObstacles(slots), [slots]);

  // 걷기 상태를 담는 값들 (화면을 다시 그리지 않고 프레임마다 바로 읽고 씀)
  const goal = useRef<{ x: number; z: number } | null>(null);
  const walking = useRef(false);
  const stuckTime = useRef(0);

  // 새 목표가 들어오면: 장애물 안이면 바깥으로, 경계 밖이면 안으로 옮긴 자리를 목표로 삼습니다
  useEffect(() => {
    if (!target) return;
    goal.current = resolveCollisions(target, obstacles, boundsRadius, BODY_RADIUS);
    stuckTime.current = 0;
  }, [target, obstacles, boundsRadius]);

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
    const dt = Math.min(delta, 0.05); // 탭 전환 등으로 시간이 크게 튀는 것을 막음
    const dest = goal.current;
    if (!dest) return;

    const dx = dest.x - g.position.x;
    const dz = dest.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < ARRIVE_DISTANCE) {
      goal.current = null;
      setWalking(false);
      return;
    }

    // 이번 프레임에 가려는 거리 (남은 거리보다 멀리 가지 않음)
    const step = Math.min(WALK_SPEED * dt, dist);
    const wanted = { x: g.position.x + (dx / dist) * step, z: g.position.z + (dz / dist) * step };
    // 장애물을 만나면 바깥으로 밀려나서 가장자리를 따라 미끄러집니다
    const next = resolveCollisions(wanted, obstacles, boundsRadius, BODY_RADIUS);
    const moved = Math.hypot(next.x - g.position.x, next.z - g.position.z);

    // 거의 못 움직이는 상태가 0.4초 이어지면(정면으로 막힘) 멈춥니다
    if (moved < step * 0.25) {
      stuckTime.current += dt;
      if (stuckTime.current > 0.4) {
        goal.current = null;
        setWalking(false);
        return;
      }
    } else {
      stuckTime.current = 0;
    }

    // 실제로 움직인 방향으로 몸을 부드럽게 돌립니다 (각도의 가장 짧은 길로)
    if (moved > 1e-5) {
      const heading = Math.atan2(next.x - g.position.x, next.z - g.position.z);
      let diff = heading - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, TURN_SPEED * dt);
    }
    g.position.x = next.x;
    g.position.z = next.z;
    // 둔덕 높이에 발을 맞춥니다 (계산은 이 한 점뿐이라 가볍습니다)
    g.position.y = heightAt(next.x, next.z);
    setWalking(true);
  });

  return (
    <group ref={group} name={PLAYER_OBJECT_NAME} position={[PLAYER_START.x, 0, PLAYER_START.z]} scale={PLAYER_SCALE}>
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

useGLTF.preload(MODEL_URL);
