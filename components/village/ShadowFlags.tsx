"use client";

// 밤 모드에서 장면의 물체가 그림자를 "만들고(cast)" "받도록(receive)" 표시해 주는 도우미입니다.
// 시안처럼 달빛이 집·트리·가로등의 그림자를 눈밭에 드리우게 합니다.
//
// 모델은 파일을 받은 뒤 나중에 나타나기도 해서(장식 단계가 오르면 새 장식 등장), 1초마다 한 번씩 새로 생긴 물체를 표시합니다.
// 알갱이(눈·연기)와 반투명 물체는 그림자를 만들지 않습니다.
//
// ⚡ 11.25 성능 개선: 그림자를 "매 장면" 다시 그리지 않고, 물체가 늘거나 줄었을 때만 다시 그립니다.
//   집·트리·장식은 움직이지 않으니 한 번 그린 그림자를 계속 써도 똑같습니다.
//   움직이는 캐릭터(내 캐릭터와 함께 걷는 다른 주민)는 그림자를 만들지 않고, 발밑의 둥근 그림자로 대신합니다.
//   → 캐릭터 묶음에 붙여 둔 표시(userData.noShadowCast)를 보고 건너뜁니다. (Task 025-2: 이름 "player" 대신 표시로 판단)

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export function ShadowFlags() {
  const gl = useThree((s) => s.gl);
  const last = useRef(-1);
  /** 지난번에 센 "그림자를 만드는 물체" 수. 바뀌면 그림자를 다시 그립니다 */
  const casters = useRef(-1);

  // 밤 동안만 자동 갱신을 끄고, 밤이 끝나면(아침으로 바꾸면) 원래대로 돌려놓습니다
  useEffect(() => {
    setShadowAutoUpdate(gl, false);
    return () => setShadowAutoUpdate(gl, true);
  }, [gl]);

  useFrame(({ scene, clock }) => {
    // 그리기를 멈췄다 다시 시작하면(편지 쓰기 창) 시계가 0부터 다시 갑니다. 그때(since가 음수)도 바로 확인합니다
    const since = clock.elapsedTime - last.current;
    if (since >= 0 && since < 1) return;
    last.current = clock.elapsedTime;

    let count = 0;
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.Material;
      // 셰이더 재질(하늘·안개)과 반투명 물체는 제외
      if (material instanceof THREE.ShaderMaterial) return;
      mesh.castShadow = !material.transparent && !insideNoShadowCast(mesh);
      mesh.receiveShadow = true;
      if (mesh.castShadow) count++;
    });
    if (count !== casters.current) {
      casters.current = count;
      requestShadowUpdate(gl);
    }
  });
  return null;
}

/** obj나 그 조상(부모·조부모…) 중에 "그림자를 만들지 않음" 표시가 있는지 */
function insideNoShadowCast(obj: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (o.userData.noShadowCast) return true;
  return false;
}

// three.js 렌더러 설정은 React 상태가 아니라서 컴포넌트 밖 함수에서 바꿉니다 (React 규칙 검사와 충돌하지 않게)
function setShadowAutoUpdate(gl: THREE.WebGLRenderer, on: boolean) {
  gl.shadowMap.autoUpdate = on;
  gl.shadowMap.needsUpdate = true;
}
function requestShadowUpdate(gl: THREE.WebGLRenderer) {
  gl.shadowMap.needsUpdate = true;
}
