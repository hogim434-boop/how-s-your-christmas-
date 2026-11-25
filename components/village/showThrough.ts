// 반투명해진 집 뒤에서도 "또렷하게" 보여야 하는 물체(우체통·캐릭터)를 표시하는 도구입니다. (11.25 사용자 요청)
//
// 💡 스텐실(stencil)이란? 화면 크기의 "도장 찍기 판"입니다.
//    우체통·캐릭터를 그릴 때 그 자리에 도장(1)을 찍어 두고,
//    반투명한 집은 도장이 찍힌 자리는 칠하지 않습니다. → 우체통·캐릭터가 흐려지지 않고 또렷하게 보입니다.

import * as THREE from "three";

/** 도장 번호 */
export const SHOW_THROUGH_STENCIL = 1;

/** 이 물체를 그릴 때 화면에 도장을 찍게 합니다 (우체통·캐릭터용) */
export function markShowThrough(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      m.stencilWrite = true;
      m.stencilRef = SHOW_THROUGH_STENCIL;
      m.stencilFunc = THREE.AlwaysStencilFunc;
      m.stencilZPass = THREE.ReplaceStencilOp;
    }
  });
}

/** 반투명한 집 재질: 도장이 찍힌 자리는 칠하지 않게 합니다 (on=false면 원래대로) */
export function skipShowThrough(material: THREE.Material, on: boolean) {
  material.stencilWrite = on; // three.js는 이 값이 true일 때만 도장 검사를 합니다
  material.stencilRef = SHOW_THROUGH_STENCIL;
  material.stencilFunc = THREE.NotEqualStencilFunc;
  material.stencilZPass = THREE.KeepStencilOp;
  material.stencilWriteMask = 0x00; // 집은 도장을 찍지 않음
}
