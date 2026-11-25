"use client";

// 캐릭터를 부드럽게 따라다니는 카메라입니다. (OrbitControls는 쓰지 않아서 탭 걷기와 충돌하지 않음)
// - 평소: 캐릭터 뒤쪽 위에서 약 28도(낮고 넓게)로 내려다봅니다.
// - treeView가 true면: 트리 전체(뿌리부터 꼭대기까지)가 한 화면에 들어오는 자리로 이동합니다.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLAYER_START, TREE_HEIGHT } from "@/lib/village/layout";

/** 카메라 시야각(세로, 도) */
export const CAMERA_FOV = 50;
/** 평소 카메라가 수평선보다 몇 도 위에서 내려다보는지 */
const FOLLOW_PITCH_DEG = 30;
/**
 * 평소 카메라와 캐릭터 사이 거리.
 * 터치로 걸어 다니기 좋게 캐릭터 가까이 확대했습니다 (11.25 사용자 요청: 40 → 26).
 * 트리 윗부분이 잘려도 괜찮음 — 전체는 "트리 전체 보기" 버튼으로 봅니다
 */
const FOLLOW_DISTANCE = 26;
/** 바라보는 점을 캐릭터보다 트리 쪽(뒤)·위로 옮기는 정도. 캐릭터가 화면 아래쪽에, 트리가 위쪽에 자리 잡습니다 */
const LOOK_OFFSET = { y: 3, z: -2 };
/** 트리 전체 보기: 수평선 위 각도와 거리 */
const TREE_VIEW_PITCH_DEG = 10;
const TREE_VIEW_DISTANCE = 44;
/** 따라가는 빠르기 (클수록 빨리 따라옴) */
const FOLLOW_SPEED = 3;

/** 장면 안의 캐릭터를 찾을 때 쓰는 이름 (Player.tsx와 같은 값) */
export const PLAYER_OBJECT_NAME = "player";

interface FollowCameraProps {
  /** true면 트리 전체 보기 자리로 이동 */
  treeView?: boolean;
}

export function FollowCamera({ treeView = false }: FollowCameraProps) {
  // 지금 카메라가 바라보는 점 (부드럽게 움직이는 값)
  const look = useRef(new THREE.Vector3(PLAYER_START.x, 1, PLAYER_START.z));
  const started = useRef(false);
  const goalPos = useRef(new THREE.Vector3());
  const goalLook = useRef(new THREE.Vector3());

  useFrame(({ camera, scene }, delta) => {
    const player = scene.getObjectByName(PLAYER_OBJECT_NAME);
    const playerPos = player ? player.position : new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z);

    // 목표 자리 계산
    if (treeView) {
      const pitch = THREE.MathUtils.degToRad(TREE_VIEW_PITCH_DEG);
      goalLook.current.set(0, TREE_HEIGHT * 0.5, 0);
      goalPos.current.set(
        0,
        goalLook.current.y + Math.sin(pitch) * TREE_VIEW_DISTANCE,
        Math.cos(pitch) * TREE_VIEW_DISTANCE,
      );
    } else {
      const pitch = THREE.MathUtils.degToRad(FOLLOW_PITCH_DEG);
      goalLook.current.set(playerPos.x, LOOK_OFFSET.y, playerPos.z + LOOK_OFFSET.z);
      goalPos.current.set(
        playerPos.x,
        goalLook.current.y + Math.sin(pitch) * FOLLOW_DISTANCE,
        goalLook.current.z + Math.cos(pitch) * FOLLOW_DISTANCE,
      );
    }

    // 처음 한 번은 바로 그 자리에 놓고, 그 뒤로는 조금씩 다가갑니다 (lerp)
    const t = started.current ? 1 - Math.exp(-FOLLOW_SPEED * delta) : 1;
    started.current = true;
    camera.position.lerp(goalPos.current, t);
    look.current.lerp(goalLook.current, t);
    camera.lookAt(look.current);
  });

  return null;
}
