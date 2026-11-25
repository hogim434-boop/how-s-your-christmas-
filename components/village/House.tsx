"use client";

// 주민 한 명의 집입니다. Kenney 통나무집 부품(벽·창문·지붕)을 레고처럼 조립합니다.
// 부품 하나는 가로세로 1칸이고, 벽은 그 칸의 앞쪽 가장자리에 붙어 있습니다.
// 그래서 부품을 돌리면(rot) 왼쪽·오른쪽·뒤쪽 벽이 됩니다.
//
// 이 집이 카메라와 캐릭터 사이를 가리면 반투명해집니다. (11.25 사용자 요청)
// 캐릭터와 집 뒤쪽 우체통이 지붕에 가려 보이지 않던 문제를 막습니다.

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Kit } from "./Kit";
import { PLAYER_OBJECT_NAME } from "./FollowCamera";
import { skipShowThrough } from "./showThrough";
import { isOccludingShape } from "@/lib/village/occlusion";

/** 가렸을 때의 불투명도 (0 = 완전 투명, 1 = 원래대로) */
const FADED_OPACITY = 0.3;
/** 흐려지고 돌아오는 빠르기 (클수록 빠름) */
const FADE_SPEED = 10;
/** 캐릭터를 감싸는 상자 (가림 판단용): 반지름, 키 */
const PLAYER_BOX = { radius: 0.45, height: 2.3 };
/**
 * 그리는 순서. 반투명한 집은 ①깊이만 먼저 그리고(PREPASS) ②색을 칠합니다(COLOR).
 * 이렇게 하면 집의 "맨 앞면"만 칠해져서, 부품끼리 겹쳐 그려지며 떨리던 현상이 사라집니다.
 */
const RENDER_ORDER = { PREPASS: 10, COLOR: 11 };

/**
 * 캐릭터 몸의 확인 지점들 (발·허리·가슴·머리, 좌우 어깨). 카메라에서 이 점들로 "시선"을 쏴서
 * 하나라도 집에 먼저 부딪히면 "가려지기 시작했다"고 봅니다.
 */
const BODY_POINTS: [number, number, number][] = [
  [0, 0.2, 0],
  [0, 0.9, 0],
  [0, 1.5, 0],
  [0, 2.1, 0],
  [-0.35, 1.3, 0],
  [0.35, 1.3, 0],
];
/** 시선 계산 도구 (모든 집이 같이 씀) */
const raycaster = new THREE.Raycaster();

/** 카메라 → 캐릭터 몸의 지점들로 시선을 쏴서, 이 집의 메시에 먼저 부딪히는지 */
function rayHitsHouse(camera: THREE.Camera, playerPos: THREE.Vector3, meshes: THREE.Mesh[], v: THREE.Vector3): boolean {
  for (const [dx, dy, dz] of BODY_POINTS) {
    v.set(playerPos.x + dx, playerPos.y + dy, playerPos.z + dz);
    const dist = camera.position.distanceTo(v);
    raycaster.set(camera.position, v.sub(camera.position).normalize());
    raycaster.far = dist;
    if (raycaster.intersectObjects(meshes, false).length > 0) return true;
  }
  return false;
}

/** 깊이만 기록하는 재질 (색은 칠하지 않음). 모든 집이 같이 씁니다 */
const PREPASS_MATERIAL = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true });

/** 재질 목록의 불투명도를 바꿉니다. (three.js 재질은 React 상태가 아니라서 직접 고칩니다) */
function applyOpacity(list: THREE.Material[], value: number) {
  const transparent = value < 0.999;
  for (const m of list) {
    if (m.transparent !== transparent) {
      m.transparent = transparent;
      // 우체통·캐릭터 자리는 칠하지 않아서 또렷하게 보이게 합니다
      skipShowThrough(m, transparent);
      m.needsUpdate = true;
    }
    m.opacity = value;
  }
}

/** 깊이 먼저 그리기용 사본들을 켜고 끕니다 */
function setPrepassVisible(list: THREE.Mesh[], visible: boolean) {
  for (const mesh of list) mesh.visible = visible;
}

const HALF = Math.PI / 2;

type Piece = {
  name: string;
  x: number;
  z: number;
  y?: number;
  /** 돌리는 각도(라디안) */
  rot?: number;
  /** 좌우 뒤집기 */
  flip?: boolean;
  /** 앞뒤 길이 배율 (지붕이 겹치지 않게 살짝 줄임) */
  depth?: number;
  /** true면 집마다 정해진 벽 색을 입힙니다 (지붕·기둥은 그대로) */
  wall?: boolean;
};

const PIECES: Piece[] = [
  // 앞면(+z 쪽): 문 + 창문
  { name: "cabin-door-rotate", x: -0.5, z: 0.5, wall: true },
  { name: "cabin-window-a", x: 0.5, z: 0.5, wall: true },
  // 뒷면
  { name: "cabin-wall", x: -0.5, z: -0.5, rot: Math.PI, wall: true },
  { name: "cabin-window-b", x: 0.5, z: -0.5, rot: Math.PI, wall: true },
  // 왼쪽 면
  { name: "cabin-wall-wreath", x: -0.5, z: 0.5, rot: -HALF, wall: true },
  { name: "cabin-wall", x: -0.5, z: -0.5, rot: -HALF, wall: true },
  // 오른쪽 면
  { name: "cabin-window-b", x: 0.5, z: 0.5, rot: HALF, wall: true },
  { name: "cabin-wall-wreath", x: 0.5, z: -0.5, rot: HALF, wall: true },
  // 네 모서리 통나무 기둥
  { name: "cabin-corner-logs", x: -0.5, z: 0.5 },
  { name: "cabin-corner-logs", x: 0.5, z: 0.5, rot: HALF },
  { name: "cabin-corner-logs", x: 0.5, z: -0.5, rot: Math.PI },
  { name: "cabin-corner-logs", x: -0.5, z: -0.5, rot: -HALF },
  // 지붕 아래 세모난 벽 (앞, 뒤)
  { name: "cabin-wall-roof", x: 0.5, z: 0.5, y: 1, wall: true },
  { name: "cabin-wall-roof", x: -0.5, z: 0.5, y: 1, flip: true, wall: true },
  { name: "cabin-wall-roof", x: -0.5, z: -0.5, y: 1, rot: Math.PI, wall: true },
  { name: "cabin-wall-roof", x: 0.5, z: -0.5, y: 1, rot: Math.PI, flip: true, wall: true },
  // 눈 쌓인 지붕 (오른쪽 2장, 왼쪽 2장)
  { name: "cabin-roof-snow", x: 0.5, z: 0.6, y: 1, depth: 0.857 },
  { name: "cabin-roof-snow-chimney", x: 0.5, z: -0.6, y: 1, depth: 0.857 },
  { name: "cabin-roof-snow", x: -0.5, z: 0.6, y: 1, rot: Math.PI, depth: 0.857 },
  { name: "cabin-roof-snow", x: -0.5, z: -0.6, y: 1, rot: Math.PI, depth: 0.857 },
];

/** 집 모델 확대 배율 (한 변 2칸 × 1.9 = 약 3.8) */
export const HOUSE_SCALE = 1.9;

interface HouseProps {
  /** 집 위치 (바닥 기준) */
  position: [number, number, number];
  /** y축 회전(라디안). 앞면이 광장을 보게 layout.ts가 계산해 줍니다. */
  rotation: number;
  /** 벽 색 (theme.ts의 walls 중 하나) */
  wallColor: string;
}

export function House({ position, rotation, wallColor }: HouseProps) {
  const group = useRef<THREE.Group>(null);
  // 이 집만의 재질 목록. 다른 집과 재질을 같이 쓰면 함께 흐려지므로 집마다 복사해 둡니다
  const materials = useRef<THREE.Material[]>([]);
  // 깊이 먼저 그리기용 사본 메시들 (반투명일 때만 켬)
  const prepass = useRef<THREE.Mesh[]>([]);
  // 집을 감싸는 상자의 꼭짓점 8개 (집 기준 좌표). 화면 위 네모를 계산할 때 씁니다
  const corners = useRef<THREE.Vector3[]>([]);
  // 이 집의 원래 메시들 (시선 검사용)
  const houseMeshes = useRef<THREE.Mesh[]>([]);
  const opacity = useRef(1);
  const player = useRef<THREE.Object3D | null>(null);
  // 계산용 임시 값 (매 프레임 새로 만들지 않게)
  const temp = useRef({ v: new THREE.Vector3(), center: new THREE.Vector3() });

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);
    const toLocal = g.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    const meshes: THREE.Mesh[] = [];
    g.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) meshes.push(mesh);
    });

    const list: THREE.Material[] = [];
    const extra: THREE.Mesh[] = [];
    for (const mesh of meshes) {
      // 재질 복사 + 그리는 순서 지정
      const copy = (mesh.material as THREE.Material).clone();
      mesh.material = copy;
      mesh.renderOrder = RENDER_ORDER.COLOR;
      list.push(copy);
      // 같은 모양으로 깊이만 그리는 사본을 바로 옆에 붙입니다 (평소엔 숨김)
      const depthOnly = new THREE.Mesh(mesh.geometry, PREPASS_MATERIAL);
      depthOnly.renderOrder = RENDER_ORDER.PREPASS;
      depthOnly.visible = false;
      mesh.add(depthOnly);
      extra.push(depthOnly);
      // 집 기준 좌표로 상자 넓히기
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox!.clone().applyMatrix4(toLocal.clone().multiply(mesh.matrixWorld));
      box.union(b);
    }
    materials.current = list;
    prepass.current = extra;
    houseMeshes.current = meshes;
    corners.current = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) =>
        new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z),
    );
    return () => {
      extra.forEach((m) => m.removeFromParent());
      list.forEach((m) => m.dispose());
    };
  }, [wallColor]);

  useFrame(({ camera, scene }, delta) => {
    const g = group.current;
    // 캐릭터는 한 번 찾아 두고 재사용합니다 (매 프레임 장면 전체를 뒤지지 않게)
    if (!player.current) player.current = scene.getObjectByName(PLAYER_OBJECT_NAME) ?? null;
    const p = player.current;
    if (!g || !p || corners.current.length === 0) return;
    const { v, center } = temp.current;

    // 화면 위 집의 꼭짓점들
    const housePts = corners.current.map((c) => {
      v.copy(c).applyMatrix4(g.matrixWorld).project(camera);
      return { x: v.x, y: v.y };
    });
    // 화면 위 캐릭터의 꼭짓점들
    const { radius: r, height: h } = PLAYER_BOX;
    const playerPts = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      v.set(p.position.x + (i & 1 ? r : -r), i & 2 ? h : 0, p.position.z + (i & 4 ? r : -r)).project(camera);
      return { x: v.x, y: v.y };
    });
    g.getWorldPosition(center);
    // 1단계(빠름): 화면에서 집 윤곽과 캐릭터 윤곽이 겹치는지 대충 확인
    // 2단계(정확): 겹칠 때만 카메라→캐릭터 몸으로 시선을 쏴서 실제로 집에 부딪히는지 확인
    const hiding =
      isOccludingShape(housePts, playerPts, camera.position.distanceTo(center), camera.position.distanceTo(p.position)) &&
      rayHitsHouse(camera, p.position, houseMeshes.current, v);

    const goal = hiding ? FADED_OPACITY : 1;
    if (opacity.current === goal) return; // 이미 목표값이면 아무것도 안 함
    opacity.current += (goal - opacity.current) * (1 - Math.exp(-FADE_SPEED * Math.min(delta, 0.05)));
    if (Math.abs(opacity.current - goal) < 0.01) opacity.current = goal;
    applyOpacity(materials.current, opacity.current);
    setPrepassVisible(prepass.current, opacity.current < 0.999);
  });

  return (
    <group ref={group} position={position} rotation={[0, rotation, 0]} scale={HOUSE_SCALE}>
      {PIECES.map((p, i) => (
        <Kit
          key={i}
          name={p.name}
          tint={p.wall ? wallColor : undefined}
          position={[p.x, p.y ?? 0, p.z]}
          rotation={[0, p.rot ?? 0, 0]}
          scale={[p.flip ? -1 : 1, 1, p.depth ?? 1]}
        />
      ))}
    </group>
  );
}
