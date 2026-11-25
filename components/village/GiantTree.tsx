"use client";

// 마을 한가운데의 대왕 트리입니다. 집보다 훨씬 큰 (높이 약 15, 집은 약 4) , 처음엔 아무 장식도 없습니다.
// 장식(전구·별 등)은 Decorations가 장식 단계에 따라 이 트리 위에 얹습니다.
//
// 어떤 모델을 쓸지는 lib/village/layout.ts의 TREE_MODEL에서 정합니다. (라이선스는 각 모델 폴더의 LICENSE.txt)

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { TREE_MODEL, TREE_POSITION, TREE_SCALE } from "@/lib/village/layout";

const MODEL_URL = TREE_MODEL.url;

export function GiantTree() {
  const { scene } = useGLTF(MODEL_URL);

  const object = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = list.map((original) => {
        const m = original.clone() as THREE.MeshStandardMaterial;
        // 원본은 "금속 40%"로 되어 있어, 비칠 주변 풍경이 없는 우리 장면에서는 거의 검게 보입니다 → 금속감 끔
        m.metalness = 0;
        if (m.transparent) {
          // 잎 카드 뒷면이 그늘져 너무 어두워지지 않게, 잎 그림 색으로 살짝 스스로 빛나게 합니다
          m.emissiveMap = m.map;
          m.emissive = new THREE.Color("#ffffff");
          m.emissiveIntensity = 0.25;
          // 잎은 "투명한 부분이 있는 그림 카드"입니다. 반투명(blend)으로 그리면 잎끼리 겹칠 때 깜빡이므로,
          // 그림의 투명한 부분만 잘라내는 방식(alphaTest)으로 바꿔 또렷하고 안정적으로 그립니다.
          m.transparent = false;
          m.alphaTest = 0.5;
          m.depthWrite = true;
          m.side = THREE.DoubleSide; // 잎 카드 뒷면도 보이게
        }
        return m;
      });
      if (mesh.material.length === 1) mesh.material = mesh.material[0];
    });
    return copy;
  }, [scene]);

  return (
    <primitive
      object={object}
      position={[TREE_POSITION.x, 0, TREE_POSITION.z]}
      // 가로·세로 똑같이 키웁니다 (한쪽만 늘리면 찌그러져 보임)
      scale={TREE_SCALE}
    />
  );
}

useGLTF.preload(MODEL_URL);
