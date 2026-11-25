"use client";

// 밤(노을) 모드에서 장면의 모든 물체가 그림자를 "만들고(cast)" "받도록(receive)" 표시해 주는 도우미입니다.
// 시안처럼 낮게 깔린 노을 해가 집·트리·가로등의 길고 푸른 그림자를 눈밭에 드리우게 합니다.
//
// 모델은 파일을 받은 뒤 나중에 나타나기도 해서(장식 단계가 오르면 새 장식 등장), 1초마다 한 번씩 새로 생긴 물체를 표시합니다.
// 알갱이(눈·연기)와 반투명 안개는 그림자를 만들지 않습니다.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function ShadowFlags() {
  const last = useRef(-1);
  useFrame(({ scene, clock }) => {
    if (clock.elapsedTime - last.current < 1) return;
    last.current = clock.elapsedTime;
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.Material;
      // 셰이더 재질(하늘·안개)과 반투명 물체는 제외
      if (material instanceof THREE.ShaderMaterial) return;
      mesh.castShadow = !material.transparent;
      mesh.receiveShadow = true;
    });
  });
  return null;
}
