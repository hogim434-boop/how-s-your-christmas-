"use client";

// 같은 마을에 지금 접속해 있는 "다른 주민들"의 캐릭터 — 예전 방식입니다. (Task 025-2)
//
// ⚠️ 지금 기본으로 쓰는 것은 RemoteCrowd.tsx(모두를 한 번에 그리는 방식, Task 026)입니다.
//    이 파일은 (1) 새 방식을 쓸 수 없는 경우의 예비, (2) 연습용 마을에서 &classic=1 로 두 방식을 비교할 때만 씁니다.
//    주민 한 명마다 모델을 복사해 따로 그리고 따로 뼈 계산을 하므로, 사람이 많아지면 그만큼 느려집니다.
//
// - 누가 있는지·어디로 걷는지는 보관함(lib/village/remoteStore.ts)에서 읽습니다.
//   이 파일은 그 값이 어디서 왔는지(개발용 가짜 주민인지, 실시간 통신인지) 모릅니다.
// - 걷기 계산은 내 캐릭터와 같은 코드(lib/village/walker.ts)를 씁니다.
// - 주민이 들어오거나 나갈 때만 React가 캐릭터 목록을 다시 그리고,
//   걷는 동안에는 아래 useFrame 한 곳에서 모든 캐릭터를 직접 움직입니다. (화면 전체를 다시 훑지 않음)
//
// ⚡ 화면이 똑같은 절약: 카메라에 보이지 않는 캐릭터는 "팔다리 동작 계산"을 건너뜁니다.
//    (자리는 계속 계산하므로, 다시 화면에 들어오면 있어야 할 곳에 있습니다)
// 💡 그림자: 움직이는 캐릭터는 달빛 그림자를 만들지 않고, 내 캐릭터처럼 발밑의 둥근 그림자로 대신합니다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { buildObstacles, type Circle } from "@/lib/village/collision";
import type { HouseSlot } from "@/lib/village/layout";
import { hashText } from "@/lib/village/liveProtocol";
import { useRemoteIds, type RemoteStore } from "@/lib/village/remoteStore";
import { ARRIVE_DISTANCE, createWalker, planRoute, stepWalker, type WalkerState } from "@/lib/village/walker";
import { CHARACTER_MODEL_URL, FADE_SECONDS, IDLE_CLIP, WALK_CLIP, disposeCharacter, prepareCharacter } from "./characterModel";
import { placeRemoteNameTag } from "./NameTag";
import { useNight } from "./nightContext";
import { softDot } from "./particles";
import { NO_SHADOW_CAST, PLAYER_SCALE } from "./Player";

/** 이름표를 띄울 높이 (캐릭터 머리 조금 위) */
const NAME_TAG_HEIGHT = 2.9;
/** "화면에 보이는지" 볼 때 쓰는 캐릭터 둘레 공의 중심 높이와 반지름. 넉넉하게 잡아 화면 가장자리에서 동작이 끊겨 보이지 않게 합니다 */
const VIEW_SPHERE_Y = 1.2;
const VIEW_SPHERE_RADIUS = 2.5;
/** 화면 밖에 있던 동안 밀린 동작 시간을 다시 들어올 때 한 번에 따라잡는 최댓값(초). 동작 섞기(0.25초)를 마저 끝내기에 충분한 값 */
const CATCH_UP_SECONDS = 0.5;

/** 캐릭터 한 명을 움직이는 데 필요한 것들 (React 상태가 아니라 useFrame이 직접 읽고 씁니다) */
/**
 * ⚡ 순간 멈칫 줄이기 (Task 025-3 측정 결과로 넣음)
 * 여러 명의 일이 "같은 장면"에 몰리면 그 한 장면만 길어져 화면이 툭 끊겨 보입니다.
 * 그래서 무거운 일 두 가지는 한 장면에 조금씩만 하고, 남은 것은 다음 장면으로 미룹니다.
 *  - 길 찾기: 한 장면에 2명까지 (19명이 동시에 새 목적지를 받으면 한 장면이 38~86ms → 미루면 최대 0.15초 늦게 출발)
 *  - 캐릭터 만들기: 한 장면에 1명씩 (19명이 한꺼번에 들어오면 약 0.3초에 걸쳐 차례로 나타남)
 */
const MAX_ROUTE_PLANS_PER_FRAME = 2;
/**
 * 그리기가 이만큼(밀리초) 넘게 멈췄다가 다시 시작되면, 다른 주민을 "걸어가는 중"이 아니라 각자의 목표 자리에 바로 세웁니다. (Task 025-6)
 * 💡 편지 쓰기 창을 열어 둔 동안이나 다른 탭을 보는 동안에는 3D가 멈춥니다. 그 사이 다른 주민은 이미 목표에 도착했을 텐데,
 *    멈춘 자리에서 이어 걷게 하면 한참 전의 걸음을 뒤늦게 보게 됩니다.
 */
const SNAP_AFTER_PAUSE_MS = 1000;
const EMPTY_IDS: ReadonlySet<string> = new Set();

type Avatar = {
  group: THREE.Group;
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  walker: WalkerState;
  /** 마지막으로 반영한 보관함의 소식 번호. 보관함의 seq와 다르면 새 목표가 온 것 */
  seq: number;
  walking: boolean;
  /** 화면 밖에 있어 건너뛴 동작 시간(초) */
  skipped: number;
};

export interface RemotePlayersProps {
  store: RemoteStore;
  /** 집 자리 (충돌 계산용) */
  slots: HouseSlot[];
  /** 마을 경계 반지름 (이 안에서만 걸을 수 있음) */
  boundsRadius: number;
  /** 땅 높이 */
  heightAt: (x: number, z: number) => number;
}

export function RemotePlayersClassic({ store, slots, boundsRadius, heightAt }: RemotePlayersProps) {
  // 주민이 들어오거나 나갈 때만 바뀌는 id 목록
  const ids = useRemoteIds(store);
  // 화면에 만들어 둔 주민 id. 접속 목록(ids)을 한 장면에 한 명씩 따라갑니다 (한꺼번에 만들면 멈칫하므로)
  const [shown, setShown] = useState(EMPTY_IDS);
  const obstacles = useMemo(() => buildObstacles(slots), [slots]);
  // 지금 그려져 있는 캐릭터들 (id → 움직이는 데 필요한 것들)
  const avatars = useRef(new Map<string, Avatar>());
  // 마지막으로 장면을 그린 시각. 그리기가 오래 멈췄다 돌아온 것을 알아채는 데 씁니다
  const lastFrameAt = useRef(0);
  const register = useCallback((id: string, avatar: Avatar | null) => {
    if (avatar) avatars.current.set(id, avatar);
    else avatars.current.delete(id);
  }, []);

  // 매 장면: 모든 캐릭터를 한 번에 움직입니다 (실제 계산은 아래 updateAvatars)
  useFrame(({ camera, size }, delta) => {
    const now = performance.now();
    const resumed = lastFrameAt.current > 0 && now - lastFrameAt.current > SNAP_AFTER_PAUSE_MS;
    lastFrameAt.current = now;
    updateAvatars(avatars.current, store, delta, obstacles, boundsRadius, heightAt, camera, size, resumed);
    // 아직 만들지 않은 주민이 있으면 이번 장면에 한 명만 추가합니다. 나간 주민은 목록에서 지웁니다
    const next = ids.find((id) => !shown.has(id));
    if (next !== undefined || shown.size > ids.length) {
      setShown((prev) => {
        const kept = new Set<string>();
        for (const id of ids) if (prev.has(id)) kept.add(id);
        if (next !== undefined) kept.add(next);
        return kept;
      });
    }
  });

  return (
    <>
      {ids.map((id) =>
        shown.has(id) ? (
          <RemoteAvatar key={id} id={id} store={store} heightAt={heightAt} register={register} />
        ) : null,
      )}
    </>
  );
}

// 계산용 임시 값들. 매 장면 새로 만들지 않도록 한 번만 만들어 재사용합니다
const FRUSTUM = new THREE.Frustum();
const VIEW_MATRIX = new THREE.Matrix4();
const VIEW_SPHERE = new THREE.Sphere();
const TAG_POINT = new THREE.Vector3();

/**
 * 한 장면만큼 모든 캐릭터를 움직입니다.
 * (three.js 물체는 React 상태가 아니라서 컴포넌트 밖 함수에서 직접 고칩니다 — React 규칙 검사와 충돌하지 않게)
 */
function updateAvatars(
  avatars: Map<string, Avatar>,
  store: RemoteStore,
  delta: number,
  obstacles: Circle[],
  boundsRadius: number,
  heightAt: (x: number, z: number) => number,
  camera: THREE.Camera,
  size: { width: number; height: number },
  /** 그리기가 오래 멈췄다가 방금 다시 시작됐는지. true면 모두를 목표 자리에 바로 세웁니다 */
  resumed: boolean,
) {
  if (avatars.size === 0) return;
  // 카메라에 보이는 범위(시야)를 구합니다. 다른 부품이 이번 장면에 카메라를 옮겼을 수 있어 먼저 맞춰 둡니다
  camera.updateMatrixWorld();
  VIEW_MATRIX.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  FRUSTUM.setFromProjectionMatrix(VIEW_MATRIX);

  let plansLeft = MAX_ROUTE_PLANS_PER_FRAME;
  for (const [id, a] of avatars) {
    const entry = store.read(id);
    if (!entry) continue;
    const w = a.walker;

    if (resumed && (a.seq !== entry.seq || w.route.length > 0)) {
      // 멈췄다 돌아옴: 걷는 중이었거나 그 사이 새 목표가 온 사람을 목표 자리에 바로 세웁니다.
      // (길을 한 번 찾아 그 길의 끝 = 장애물을 피해 실제로 멈추게 될 자리를 씁니다)
      a.seq = entry.seq;
      planRoute(w, { x: entry.tx, z: entry.tz }, obstacles, boundsRadius);
      const end = w.route[w.route.length - 1];
      if (end) {
        w.x = end.x;
        w.z = end.z;
      }
      w.route = [];
      a.group.position.set(w.x, heightAt(w.x, w.z), w.z);
      setWalking(a, false);
    }

    // 새 소식이 왔으면 그 목표로 가는 길을 다시 찾습니다 (지금 서 있는 곳에서 이어서 걸어 순간 이동하지 않습니다)
    if (a.seq !== entry.seq) {
      if (Math.hypot(entry.tx - w.x, entry.tz - w.z) <= ARRIVE_DISTANCE) {
        a.seq = entry.seq; // 이미 그 자리: 길을 찾을 필요 없음
      } else if (plansLeft > 0) {
        plansLeft--;
        a.seq = entry.seq;
        planRoute(w, { x: entry.tx, z: entry.tz }, obstacles, boundsRadius);
      }
      // 이번 장면 몫을 다 썼으면 seq를 그대로 둡니다 → 다음 장면에 다시 시도 (그동안은 하던 대로 걷거나 서 있음)
    }

    // 걷기: 내 캐릭터와 같은 계산
    if (w.route.length > 0) {
      const walking = stepWalker(w, delta, obstacles, boundsRadius);
      a.group.position.set(w.x, heightAt(w.x, w.z), w.z);
      a.group.rotation.y = w.rotY;
      setWalking(a, walking);
    }

    // 화면에 보이는 캐릭터만 팔다리 동작을 계산합니다
    VIEW_SPHERE.center.set(w.x, a.group.position.y + VIEW_SPHERE_Y, w.z);
    VIEW_SPHERE.radius = VIEW_SPHERE_RADIUS;
    if (FRUSTUM.intersectsSphere(VIEW_SPHERE)) {
      a.mixer.update(Math.min(delta, 0.1) + a.skipped);
      a.skipped = 0;
    } else {
      a.skipped = Math.min(a.skipped + delta, CATCH_UP_SECONDS);
    }

    // 머리 위 이름표를 캐릭터를 옮긴 "뒤"에 맞춥니다 (먼저 하면 한 장면씩 늦게 따라옵니다)
    TAG_POINT.set(w.x, a.group.position.y + NAME_TAG_HEIGHT, w.z);
    placeRemoteNameTag(id, TAG_POINT, camera, size);
  }
}

/** 동작 바꾸기: 지금 동작을 서서히 끄고 새 동작을 서서히 켭니다 (내 캐릭터와 같은 방식) */
function setWalking(a: Avatar, next: boolean) {
  if (a.walking === next) return;
  a.walking = next;
  const from = next ? a.idle : a.walk;
  const to = next ? a.walk : a.idle;
  from.fadeOut(FADE_SECONDS);
  to.reset().fadeIn(FADE_SECONDS).play();
}

interface RemoteAvatarProps {
  id: string;
  store: RemoteStore;
  heightAt: (x: number, z: number) => number;
  register: (id: string, avatar: Avatar | null) => void;
}

/** 다른 주민 한 명. 모델을 복사해 장면에 올리고, 움직이는 데 필요한 것들을 위(RemotePlayers)에 등록합니다 */
function RemoteAvatar({ id, store, heightAt, register }: RemoteAvatarProps) {
  const night = useNight();
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(CHARACTER_MODEL_URL);
  const model = useMemo(() => prepareCharacter(scene), [scene]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const entry = store.read(id);
    const x = entry?.x ?? 0;
    const z = entry?.z ?? 0;
    g.position.set(x, heightAt(x, z), z);

    // 동작 재생기(mixer)를 직접 만듭니다. (drei의 useAnimations는 캐릭터마다 매 장면 무조건 계산해서, 화면 밖 건너뛰기를 할 수 없습니다)
    const mixer = new THREE.AnimationMixer(model);
    const idleClip = THREE.AnimationClip.findByName(animations, IDLE_CLIP);
    const walkClip = THREE.AnimationClip.findByName(animations, WALK_CLIP);
    if (!idleClip || !walkClip) return;
    const idle = mixer.clipAction(idleClip);
    const walk = mixer.clipAction(walkClip);
    // 모두가 똑같은 박자로 숨 쉬지 않게, 서 있는 동작의 시작 시점을 사람마다 다르게 둡니다
    idle.time = ((hashText(id) % 1000) / 1000) * idleClip.duration;
    idle.play();
    mixer.update(0);

    // seq를 -1로 두어, 첫 장면에 보관함의 목표를 바로 읽게 합니다
    register(id, { group: g, mixer, idle, walk, walker: createWalker(x, z), seq: -1, walking: false, skipped: 0 });
    return () => {
      register(id, null);
      // 재생기가 붙잡고 있던 것들을 놓아 줍니다 (모양·재질은 다른 캐릭터와 함께 쓰므로 지우지 않습니다)
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      disposeCharacter(model);
    };
  }, [id, store, heightAt, register, model, animations]);

  return (
    // 💡 이름을 "player"로 두면 안 됩니다. 카메라·우체통 안내가 그 이름으로 "내 캐릭터"를 찾기 때문입니다
    <group ref={group} scale={PLAYER_SCALE} userData={NO_SHADOW_CAST}>
      <primitive object={model} />
      {/* 밤: 발밑의 둥근 그림자 (내 캐릭터와 같은 방식) */}
      {night && (
        <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <planeGeometry args={[1.3, 1.3]} />
          <meshBasicMaterial map={softDot()} color="#0b1030" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
