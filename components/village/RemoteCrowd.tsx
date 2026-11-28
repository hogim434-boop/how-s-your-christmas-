"use client";

// 같은 마을에 지금 접속해 있는 "다른 주민들"의 캐릭터를 모두 한 번에 그립니다. (Task 026)
//
// - 누가 있는지·어디로 걷는지는 보관함(lib/village/remoteStore.ts)에서 읽습니다.
// - 걷기와 동작 시간표 계산은 lib/village/remoteWalk.ts, 그리는 재료(모양·재질·자세 그림)는 crowdModel.ts에 있습니다.
// - 주민이 들어오고 나가거나 걸어 다녀도 React는 아무것도 다시 그리지 않습니다.
//   아래 useFrame 한 곳에서 매 장면 "주민마다 자리와 자세 줄 번호"만 적어 그래픽 장치에 넘깁니다.
//
// ⚡ 화면에 보이지 않는 주민은 그릴 목록에서 뺍니다 (자리와 동작 시간은 계속 계산하므로, 화면에 들어오면 있어야 할 모습으로 있습니다).
// 💡 그림자: 움직이는 캐릭터는 달빛 그림자를 만들지 않고, 내 캐릭터처럼 발밑의 둥근 그림자로 대신합니다.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildObstacles, type Circle } from "@/lib/village/collision";
import { hashText } from "@/lib/village/liveProtocol";
import type { RemoteStore } from "@/lib/village/remoteStore";
import {
  POSE_IDLE,
  POSE_WALK,
  advancePose,
  advanceRemoteWalk,
  createPose,
  poseRow,
  switchPose,
  type PoseState,
  type RemoteWalk,
} from "@/lib/village/remoteWalk";
import { createWalker } from "@/lib/village/walker";
import { FADE_SECONDS } from "./characterModel";
import type { CrowdAssets } from "./crowdModel";
import { placeRemoteNameTag } from "./NameTag";
import { useNight } from "./nightContext";
import { softDot } from "./particles";
import { NO_SHADOW_CAST, PLAYER_SCALE } from "./Player";
import type { RemotePlayersProps } from "./RemotePlayersClassic";

/** 한 번에 그릴 수 있는 최대 인원 (상한 MAX_REMOTE_AVATARS = 30명, 연습용 마을의 가짜 주민도 30명까지) */
export const CROWD_CAPACITY = 32;
/** 이 이름으로 측정 도구가 "지금 몇 명을 그리는지"를 읽습니다 */
const CROWD_OBJECT_NAME = "remote-avatars";

/** 이름표를 띄울 높이 (캐릭터 머리 조금 위) */
const NAME_TAG_HEIGHT = 2.9;
/** "화면에 보이는지" 볼 때 쓰는 캐릭터 둘레 공의 중심 높이와 반지름. 넉넉하게 잡아 화면 가장자리에서 잘려 보이지 않게 합니다 */
const VIEW_SPHERE_Y = 1.2;
const VIEW_SPHERE_RADIUS = 2.5;
/** 한 장면에 동작 시간이 흐르는 최댓값(초). 화면이 잠깐 멈췄다 돌아와도 동작이 크게 튀지 않게 합니다 */
const MAX_POSE_STEP = 0.1;
/** 길 찾기는 한 장면에 2명까지 (여러 명이 동시에 새 목적지를 받아도 한 장면이 길어지지 않게, Task 025-3) */
const MAX_ROUTE_PLANS_PER_FRAME = 2;
/** 그리기가 이만큼(밀리초) 넘게 멈췄다가 다시 시작되면, 걷던 주민을 각자의 목표 자리에 바로 세웁니다 (Task 025-6) */
const SNAP_AFTER_PAUSE_MS = 1000;
/** 자세 굽기는 한 장면에 이만큼씩 (전부 128줄 → 8장면, 약 0.13초에 걸쳐 끝남). 한 장면에 다 하면 첫 주민이 들어올 때 멈칫합니다 */
const BAKE_ROWS_PER_FRAME = 16;
/** 밤: 발밑 둥근 그림자의 크기와 높이 (내 캐릭터와 같은 값) */
const BLOB_SIZE = 1.3;
const BLOB_Y = 0.07;

/** 주민 한 명을 움직이는 데 필요한 값들 (React 상태가 아니라 useFrame이 직접 읽고 씁니다) */
type Member = RemoteWalk & {
  /** 발이 닿는 땅 높이 (자리가 바뀔 때만 다시 계산) */
  y: number;
  pose: PoseState;
};

interface RemoteCrowdProps extends RemotePlayersProps {
  assets: CrowdAssets;
}

export function RemoteCrowd({ store, slots, boundsRadius, heightAt, assets }: RemoteCrowdProps) {
  const night = useNight();
  const obstacles = useMemo(() => buildObstacles(slots), [slots]);
  const members = useRef(new Map<string, Member>());
  // 마지막으로 반영한 접속 목록 (보관함은 누가 들어오거나 나갈 때만 새 배열을 줍니다)
  const seenIds = useRef<readonly string[] | null>(null);
  // 마지막으로 장면을 그린 시각. 그리기가 오래 멈췄다 돌아온 것을 알아채는 데 씁니다
  const lastFrameAt = useRef(0);

  // 모두를 한 번에 그리는 물체. 주민마다 다른 값(자리, 자세 줄)은 속성으로 넘깁니다
  const crowd = useMemo(() => {
    const mesh = new THREE.InstancedMesh(assets.geometry, assets.material, CROWD_CAPACITY);
    mesh.name = CROWD_OBJECT_NAME;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // 화면 밖 주민은 아래에서 직접 빼므로, three.js의 "통째로 화면 밖인지" 검사는 끕니다 (기본 자세 기준이라 맞지도 않습니다)
    mesh.frustumCulled = false;
    return mesh;
  }, [assets]);

  // 밤: 발밑의 둥근 그림자도 모두 한 번에 그립니다 (자리는 캐릭터와 같은 값을 함께 씁니다)
  const blobs = useMemo(() => {
    if (!night) return null;
    const geometry = new THREE.PlaneGeometry(BLOB_SIZE, BLOB_SIZE);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, BLOB_Y, 0);
    const material = new THREE.MeshBasicMaterial({
      map: softDot(),
      color: "#0b1030",
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, CROWD_CAPACITY);
    // 자리 값은 캐릭터와 "같은 숫자 배열"을 보되, 그래픽 장치에 올리는 묶음(속성)은 따로 둡니다.
    // ⚠️ 속성까지 함께 쓰면 안 됩니다 (11.28 버그): 낮으로 바꿔 이 그림자를 치울 때 three.js가 그 속성의 그래픽 장치 쪽 저장소를 지우는데,
    //    캐릭터는 지워진 저장소를 계속 보게 되어 몸이 옛 자리에 멈춰 서고 이름표·그림자만 움직였습니다.
    mesh.instanceMatrix = new THREE.InstancedBufferAttribute(crowd.instanceMatrix.array, 16);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    return mesh;
  }, [night, crowd]);

  useEffect(() => () => void crowd.dispose(), [crowd]);
  useEffect(() => {
    if (!blobs) return;
    return () => {
      blobs.geometry.dispose();
      (blobs.material as THREE.Material).dispose();
      blobs.dispose();
    };
  }, [blobs]);

  // 매 장면: 모든 주민을 한 번에 움직이고, 그릴 목록을 다시 적습니다 (실제 계산은 아래 updateCrowd)
  useFrame(({ camera, size }, delta) => {
    const now = performance.now();
    const resumed = lastFrameAt.current > 0 && now - lastFrameAt.current > SNAP_AFTER_PAUSE_MS;
    lastFrameAt.current = now;
    const ids = store.getIds();
    if (ids !== seenIds.current) {
      seenIds.current = ids;
      syncMembers(members.current, ids, store, heightAt, assets);
    }
    updateCrowd(members.current, store, assets, crowd, blobs, delta, obstacles, boundsRadius, heightAt, camera, size, resumed);
  });

  return (
    // 💡 "그림자를 만들지 않음" 표시: 밤의 달빛 그림자 계산(ShadowFlags.tsx)이 이 묶음을 건너뜁니다
    <group userData={NO_SHADOW_CAST}>
      <primitive object={crowd} />
      {blobs && <primitive object={blobs} />}
    </group>
  );
}

/** 접속 목록에 맞춰 주민을 더하고 뺍니다 (모델을 복사하지 않으므로 여러 명이 한꺼번에 들어와도 가볍습니다) */
function syncMembers(
  members: Map<string, Member>,
  ids: readonly string[],
  store: RemoteStore,
  heightAt: (x: number, z: number) => number,
  assets: CrowdAssets,
) {
  const present = new Set(ids);
  for (const id of members.keys()) if (!present.has(id)) members.delete(id);
  for (const id of ids) {
    if (members.has(id)) continue;
    const entry = store.read(id);
    const x = entry?.x ?? 0;
    const z = entry?.z ?? 0;
    members.set(id, {
      walker: createWalker(x, z),
      // seq를 -1로 두어, 첫 장면에 보관함의 목표를 바로 읽게 합니다
      seq: -1,
      y: heightAt(x, z),
      // 모두가 똑같은 박자로 숨 쉬지 않게, 서 있는 동작의 시작 시점을 사람마다 다르게 둡니다
      pose: createPose(((hashText(id) % 1000) / 1000) * assets.idle.duration),
    });
  }
}

// 계산용 임시 값들. 매 장면 새로 만들지 않도록 한 번만 만들어 재사용합니다
const FRUSTUM = new THREE.Frustum();
const VIEW_MATRIX = new THREE.Matrix4();
const VIEW_SPHERE = new THREE.Sphere();
const TAG_POINT = new THREE.Vector3();
const PLAN_BUDGET = { left: 0 };

/**
 * 한 장면만큼 모든 주민을 움직이고, 화면에 보이는 주민만 그릴 목록에 적습니다.
 * (three.js 물체는 React 상태가 아니라서 컴포넌트 밖 함수에서 직접 고칩니다 — React 규칙 검사와 충돌하지 않게)
 */
function updateCrowd(
  members: Map<string, Member>,
  store: RemoteStore,
  assets: CrowdAssets,
  crowd: THREE.InstancedMesh,
  blobs: THREE.InstancedMesh | null,
  delta: number,
  obstacles: Circle[],
  boundsRadius: number,
  heightAt: (x: number, z: number) => number,
  camera: THREE.Camera,
  size: { width: number; height: number },
  resumed: boolean,
) {
  if (members.size === 0) {
    crowd.count = 0;
    if (blobs) blobs.count = 0;
    return;
  }
  // 자세 그림을 아직 다 굽지 못했으면 이번 장면 몫만큼 굽습니다. 다 구울 때까지(약 0.13초)는 그리지 않습니다
  const ready = assets.bake(BAKE_ROWS_PER_FRAME);

  // 카메라에 보이는 범위(시야)를 구합니다. 다른 부품이 이번 장면에 카메라를 옮겼을 수 있어 먼저 맞춰 둡니다
  camera.updateMatrixWorld();
  VIEW_MATRIX.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  FRUSTUM.setFromProjectionMatrix(VIEW_MATRIX);

  const matrices = crowd.instanceMatrix.array as Float32Array;
  const poses = assets.poseAttribute.array as Float32Array;
  const poseDt = Math.min(delta, MAX_POSE_STEP);
  PLAN_BUDGET.left = MAX_ROUTE_PLANS_PER_FRAME;
  let shown = 0;
  // 이번 장면에 "동작을 바꾸는 중"이라 자세를 직접 계산한 사람 수 (섞임 그림의 줄 번호로 씁니다)
  let blending = 0;
  for (const [id, m] of members) {
    const entry = store.read(id);
    if (!entry) continue;
    const w = m.walker;

    const moved = advanceRemoteWalk(m, entry, delta, obstacles, boundsRadius, resumed, PLAN_BUDGET);
    if (moved !== "none") {
      m.y = heightAt(w.x, w.z);
      switchPose(m.pose, moved === "walking" ? POSE_WALK : POSE_IDLE);
    }
    advancePose(m.pose, poseDt, FADE_SECONDS, assets.idle.duration, assets.walk.duration);

    // 화면에 보이는 주민만 그릴 목록에 적습니다
    VIEW_SPHERE.center.set(w.x, m.y + VIEW_SPHERE_Y, w.z);
    VIEW_SPHERE.radius = VIEW_SPHERE_RADIUS;
    if (ready && shown < CROWD_CAPACITY && FRUSTUM.intersectsSphere(VIEW_SPHERE)) {
      // 자리·방향·크기를 4×4 행렬로 적습니다 (Y축으로 rotY만큼 돌리고 (x, y, z)로 옮김)
      const c = Math.cos(w.rotY) * PLAYER_SCALE;
      const s = Math.sin(w.rotY) * PLAYER_SCALE;
      const o = shown * 16;
      matrices[o] = c;
      matrices[o + 1] = 0;
      matrices[o + 2] = -s;
      matrices[o + 3] = 0;
      matrices[o + 4] = 0;
      matrices[o + 5] = PLAYER_SCALE;
      matrices[o + 6] = 0;
      matrices[o + 7] = 0;
      matrices[o + 8] = s;
      matrices[o + 9] = 0;
      matrices[o + 10] = c;
      matrices[o + 11] = 0;
      matrices[o + 12] = w.x;
      matrices[o + 13] = m.y;
      matrices[o + 14] = w.z;
      matrices[o + 15] = 1;
      // 자세: (읽을 줄 번호, 어느 그림인지)
      const p = shown * 2;
      const pose = m.pose;
      if (pose.blend < 1 && pose.from !== pose.to) {
        // 동작을 바꾸는 0.25초 동안: 두 동작이 섞인 자세를 예전과 같은 방법으로 직접 계산합니다
        const toWalk = pose.to === POSE_WALK;
        assets.writeBlend(
          blending,
          toWalk ? pose.fromTime : pose.toTime,
          toWalk ? pose.toTime : pose.fromTime,
          toWalk ? pose.blend : 1 - pose.blend,
        );
        poses[p] = blending++;
        poses[p + 1] = 1;
      } else {
        // 평소: 미리 구워 둔 자세 그림에서 지금 시점의 줄을 읽습니다
        poses[p] = poseRow(pose.to === POSE_IDLE ? assets.idle : assets.walk, pose.toTime);
        poses[p + 1] = 0;
      }
      shown++;
    }

    // 머리 위 이름표를 자리를 옮긴 "뒤"에 맞춥니다 (먼저 하면 한 장면씩 늦게 따라옵니다)
    TAG_POINT.set(w.x, m.y + NAME_TAG_HEIGHT, w.z);
    placeRemoteNameTag(id, TAG_POINT, camera, size);
  }

  crowd.count = shown;
  if (blobs) blobs.count = shown;
  if (shown > 0) {
    crowd.instanceMatrix.needsUpdate = true;
    if (blobs) blobs.instanceMatrix.needsUpdate = true;
    assets.poseAttribute.needsUpdate = true;
  }
  if (blending > 0) assets.commitBlends();
}
