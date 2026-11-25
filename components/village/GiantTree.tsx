"use client";

// 마을 한가운데의 대왕 트리입니다. 집보다 훨씬 큰 (높이 약 15, 집은 약 4) , 처음엔 아무 장식도 없습니다.
// 장식(전구·별 등)은 Decorations가 장식 단계에 따라 이 트리 위에 얹습니다.
//
// 어떤 모델을 쓸지는 lib/village/layout.ts의 TREE_MODEL에서 정합니다. (라이선스는 각 모델 폴더의 LICENSE.txt)

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { TREE_MODEL, TREE_POSITION, TREE_SCALE } from "@/lib/village/layout";
import { useNight } from "./nightContext";

const MODEL_URL = TREE_MODEL.url;

/**
 * 밤의 트리 빛: 트리가 자기 색(잎은 초록, 줄기는 갈색)에 따뜻한 빛을 섞어 살짝 빛납니다. (가짜 빛)
 * 예전에는 트리 앞에 진짜 불빛(pointLight)을 두었지만, 진짜 불빛은 화면 전체 계산을 늘려서
 * 11.25 사용자 요청으로 모든 불빛을 가짜 빛으로 바꿨습니다.
 */
// tint: 따뜻한 빛의 색(트리 자기 색에 곱해짐), intensity: 빛나는 정도
const NIGHT_TREE_GLOW = { tint: "#ffe2b0", intensity: 0.7 };

const WARM = new THREE.Color(NIGHT_TREE_GLOW.tint);

/** 트리 재질의 "스스로 빛남"을 낮/밤에 맞게 바꿉니다 (three.js 재질은 React 상태가 아니라서 직접 고칩니다) */
function applyTreeGlow(object: THREE.Object3D, night: boolean) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      const m = material as THREE.MeshStandardMaterial;
      // 낮의 값은 처음 한 번 적어 두었다가 아침으로 돌아오면 되돌립니다
      m.userData.day ??= { emissive: m.emissive.clone(), emissiveMap: m.emissiveMap, intensity: m.emissiveIntensity };
      const day = m.userData.day as { emissive: THREE.Color; emissiveMap: THREE.Texture | null; intensity: number };
      if (night) {
        // 자기 색 × 따뜻한 빛 색 → 초록 잎은 초록빛으로, 갈색 줄기는 갈색빛으로 밝아집니다
        // (잎의 초록은 꼭짓점 색이라, 위 GiantTree의 셰이더 한 줄이 곱해 줍니다)
        m.emissive.copy(m.color).multiply(WARM);
        m.emissiveMap = m.map;
        m.emissiveIntensity = NIGHT_TREE_GLOW.intensity;
      } else {
        m.emissive.copy(day.emissive);
        m.emissiveMap = day.emissiveMap;
        m.emissiveIntensity = day.intensity;
      }
      m.needsUpdate = true;
    }
  });
}

export function GiantTree() {
  const { scene } = useGLTF(MODEL_URL);
  const night = useNight();

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
        // 잎은 색을 "꼭짓점마다 칠한 색"으로 담고 있습니다. 밤에 스스로 빛날 때도 그 초록색으로 빛나도록
        // 그리는 프로그램(셰이더)에 한 줄을 끼워 넣습니다: 빛나는 색 × 꼭짓점 색
        if (m.vertexColors) {
          m.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <emissivemap_fragment>",
              "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;",
            );
          };
        }
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

  useEffect(() => applyTreeGlow(object, night), [object, night]);

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
