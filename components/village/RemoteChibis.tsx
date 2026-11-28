"use client";

// 같은 마을에 지금 접속해 있는 "다른 주민들"의 캐릭터입니다. (Task 025-2, Task 014에서 꾸미기 캐릭터로 교체)
// - 주민마다 고른 옷이 달라서, 주민 한 명 = 물체 하나(그리기 1번)로 그립니다. (chibiModel.ts)
//   뼈대가 없는 캐릭터라, 예전 캐릭터에서 무거웠던 "뼈 자세 계산"이 없습니다.
// - 걷는 계산(lib/village/walker.ts)과 한 장면에 조금씩 나눠 하는 규칙은 예전 방식(RemotePlayersClassic.tsx)과 같습니다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { buildObstacles, type Circle } from "@/lib/village/collision";
import type { HouseSlot } from "@/lib/village/layout";
import { hashText } from "@/lib/village/liveProtocol";
import { useRemoteIds, type RemoteStore } from "@/lib/village/remoteStore";
import { ARRIVE_DISTANCE, createWalker, planRoute, stepWalker, type WalkerState } from "@/lib/village/walker";
import { DEFAULT_PARTS } from "@/lib/character/parts";
import type { CharacterParts } from "@/types/domain";
import { CHIBI_MODEL_URL, CHIBI_NAME_TAG_HEIGHT, animateChibi, createChibi, disposeChibi, setChibiNight, type Chibi } from "./chibiModel";
import { placeRemoteNameTag } from "./NameTag";
import { useNight } from "./nightContext";
import { softDot } from "./particles";
import { NO_SHADOW_CAST, PLAYER_SCALE } from "./Player";

/** "화면에 보이는지" 볼 때 쓰는 캐릭터 둘레 공의 중심 높이와 반지름. 넉넉하게 잡아 화면 가장자리에서 동작이 끊겨 보이지 않게 합니다 */
const VIEW_SPHERE_Y = 1.2;
const VIEW_SPHERE_RADIUS = 2.5;

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
  chibi: Chibi;
  walker: WalkerState;
  /** 마지막으로 반영한 보관함의 소식 번호. 보관함의 seq와 다르면 새 목표가 온 것 */
  seq: number;
  walking: boolean;
};

export interface RemotePlayersProps {
  store: RemoteStore;
  /** 집 자리 (충돌 계산용) */
  slots: HouseSlot[];
  /** 마을 경계 반지름 (이 안에서만 걸을 수 있음) */
  boundsRadius: number;
  /** 땅 높이 */
  heightAt: (x: number, z: number) => number;
  /** 주민 id → 꾸미기 값. 목록에 없는 주민(아직 꾸미지 않은 주민)은 기본 모습으로 그립니다 */
  partsById: Readonly<Record<string, CharacterParts>>;
}

export function RemoteChibis({ store, slots, boundsRadius, heightAt, partsById }: RemotePlayersProps) {
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
          <RemoteAvatar
            key={id}
            id={id}
            parts={partsById[id] ?? DEFAULT_PARTS}
            store={store}
            heightAt={heightAt}
            register={register}
          />
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
      animateChibi(a.chibi, delta, a.walking);
    }

    // 머리 위 이름표를 캐릭터를 옮긴 "뒤"에 맞춥니다 (먼저 하면 한 장면씩 늦게 따라옵니다)
    TAG_POINT.set(w.x, a.group.position.y + CHIBI_NAME_TAG_HEIGHT, w.z);
    placeRemoteNameTag(id, TAG_POINT, camera, size);
  }
}

/** 걷는 중인지 적어 둡니다. 동작을 부드럽게 바꾸는 일은 animateChibi가 합니다 */
function setWalking(a: Avatar, next: boolean) {
  a.walking = next;
}

interface RemoteAvatarProps {
  id: string;
  parts: CharacterParts;
  store: RemoteStore;
  heightAt: (x: number, z: number) => number;
  register: (id: string, avatar: Avatar | null) => void;
}

/** 다른 주민 한 명. 고른 옷을 입은 캐릭터를 만들어 장면에 올리고, 움직이는 데 필요한 것들을 위(RemoteChibis)에 등록합니다 */
function RemoteAvatar({ id, parts, store, heightAt, register }: RemoteAvatarProps) {
  const night = useNight();
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(CHIBI_MODEL_URL);
  // 모두가 똑같은 박자로 숨 쉬지 않게, 서 있는 동작의 시작 시점을 사람마다 다르게 둡니다
  const chibi = useMemo(() => createChibi(scene, parts, (hashText(id) % 1000) / 100), [scene, parts, id]);
  useEffect(() => () => disposeChibi(chibi), [chibi]);
  // 밤에는 캐릭터가 자기 색을 스스로 조금 밝힙니다 (chibiModel.ts)
  useEffect(() => setChibiNight(chibi, night), [chibi, night]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const entry = store.read(id);
    const x = entry?.x ?? 0;
    const z = entry?.z ?? 0;
    g.position.set(x, heightAt(x, z), z);
    // seq를 -1로 두어, 첫 장면에 보관함의 목표를 바로 읽게 합니다
    register(id, { group: g, chibi, walker: createWalker(x, z), seq: -1, walking: false });
    return () => register(id, null);
  }, [id, store, heightAt, register, chibi]);

  return (
    // 💡 이름을 "player"로 두면 안 됩니다. 카메라·우체통 안내가 그 이름으로 "내 캐릭터"를 찾기 때문입니다
    <group ref={group} scale={PLAYER_SCALE} userData={NO_SHADOW_CAST}>
      <primitive object={chibi.mesh} />
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
