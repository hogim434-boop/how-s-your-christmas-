// 캐릭터 3D 모델(KayKit Rogue)을 "한 명 분"으로 준비하는 곳입니다. (Task 025-2)
// 내 캐릭터(Player.tsx)와 다른 주민(RemotePlayers.tsx)이 같은 준비 과정을 함께 씁니다.

import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { markShowThrough } from "./showThrough";

/** 캐릭터 모델 파일 */
export const CHARACTER_MODEL_URL = "/models/character/Rogue.glb";
/** 서 있을 때·걸을 때 동작 이름 (모델 파일 안에 들어 있는 이름) */
export const IDLE_CLIP = "Unarmed_Idle";
export const WALK_CLIP = "Walking_A";
/** 동작을 서로 부드럽게 섞는 시간(초) */
export const FADE_SECONDS = 0.25;
/** 무기 모델(캐릭터 손에 붙어 있는 칼·석궁)은 숨깁니다 */
const HIDDEN_PARTS = ["Knife_Offhand", "1H_Crossbow", "2H_Crossbow", "Knife", "Throwable"];

/**
 * 받아 온 모델에서 캐릭터 한 명을 복사해 돌려줍니다.
 * 💡 뼈대(스킨)가 있는 모델은 일반 clone이 아니라 SkeletonUtils.clone으로 복사해야 합니다.
 *    모양 데이터(geometry)와 색 그림(재질)은 복사본끼리 함께 쓰므로, 여러 명을 만들어도 메모리는 조금만 늡니다.
 */
export function prepareCharacter(scene: THREE.Object3D): THREE.Object3D {
  const copy = cloneSkinned(scene);
  // 숨기는 무기는 아예 떼어 냅니다 (보이지 않아도 달려 있으면 매 장면 위치 계산을 하기 때문)
  const hidden: THREE.Object3D[] = [];
  copy.traverse((child) => {
    if (HIDDEN_PARTS.includes(child.name)) hidden.push(child);
  });
  hidden.forEach((child) => child.removeFromParent());
  mergeBodyParts(scene, copy);
  // 반투명해진 집 뒤에 있어도 캐릭터는 또렷하게 보이게 합니다 (showThrough.ts)
  markShowThrough(copy);
  return copy;
}

/** 원본 모델 → 몸 조각들을 하나로 합친 모양. 한 번만 만들어 모든 캐릭터가 함께 씁니다 */
const mergedBodies = new WeakMap<THREE.Object3D, THREE.BufferGeometry | null>();

const isIdentity = (m: THREE.Matrix4) => m.equals(IDENTITY);
const IDENTITY = new THREE.Matrix4();

/**
 * ⚡ 화면이 똑같은 절약 (Task 025-3): 몸 조각 6개(팔·다리·몸통·머리)를 한 덩어리로 합칩니다.
 *
 * 왜? 이 모델은 몸이 6조각으로 나뉘어 있고, 복사하면 조각마다 "뼈대 계산"을 따로 합니다.
 *  → 캐릭터 한 명에 그리기 6번 + 뼈대 계산 6번. 여러 명이 모이면 이 횟수가 그대로 곱해집니다.
 * 조각들은 같은 뼈·같은 재질을 쓰므로 합쳐도 그려지는 모습은 완전히 같고, 그리기 1번 + 뼈대 계산 1번이 됩니다.
 * (망토는 뼈대 없이 가슴 뼈에 붙어 있는 조각이라 그대로 둡니다)
 *
 * 조건이 하나라도 맞지 않으면(다른 모델로 바뀐 경우 등) 아무것도 하지 않고 원래대로 둡니다.
 */
function mergeBodyParts(source: THREE.Object3D, copy: THREE.Object3D) {
  const parts: THREE.SkinnedMesh[] = [];
  copy.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh && mesh.visible) parts.push(mesh);
  });
  if (parts.length < 2) return;
  const first = parts[0];
  // 합쳐도 되는지 확인: 같은 부모·같은 재질·같은 뼈·제자리(이동·회전 없음)
  const mergeable = parts.every(
    (m) =>
      m.parent === first.parent &&
      m.material === first.material &&
      m.bindMode === first.bindMode &&
      isIdentity(m.matrix) &&
      isIdentity(m.bindMatrix) &&
      m.skeleton.bones.length === first.skeleton.bones.length &&
      m.skeleton.bones.every((bone, i) => bone === first.skeleton.bones[i]) &&
      m.skeleton.boneInverses.every((inv, i) => inv.equals(first.skeleton.boneInverses[i])),
  );
  if (!mergeable) return;

  let merged = mergedBodies.get(source);
  if (merged === undefined) {
    merged = mergeGeometries(parts.map((m) => m.geometry), false);
    mergedBodies.set(source, merged);
  }
  if (!merged) return;
  first.geometry = merged;
  first.name = "Rogue_Merged";
  // 나머지 조각은 떼어 내고, 쓰지 않게 된 뼈대(뼈 정보를 담는 그림)를 놓아 줍니다
  for (const part of parts.slice(1)) {
    part.removeFromParent();
    part.skeleton.dispose();
  }
}

/** 캐릭터가 화면에서 사라질 때: 뼈대가 그래픽 장치에 올려 둔 것을 놓아 줍니다 (모양·재질은 함께 쓰므로 지우지 않음) */
export function disposeCharacter(model: THREE.Object3D) {
  model.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
  });
}
