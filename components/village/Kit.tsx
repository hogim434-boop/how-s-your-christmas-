"use client";

// Kenney 3D 모델(.glb 파일) 하나를 불러와서 화면에 놓는 공용 부품입니다.
// 같은 모델을 여러 번(집 20채 등) 놓아도 파일은 한 번만 받고, 장면(scene)만 복사해서 씁니다.

import { useMemo } from "react";
import type { ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/** 모델 묶음(팩) 종류: Kenney Holiday Kit(.glb) / KayKit Holiday Bits(.gltf). 둘 다 CC0(자유 사용) */
export type ModelPack = "kenney" | "kaykit";

/** 팩 이름 + 모델 이름 → 파일 주소. 파일은 public/models 아래에 있습니다 */
export function modelUrl(pack: ModelPack, name: string): string {
  return pack === "kaykit" ? `/models/kaykit-holiday/${name}.gltf` : `/models/kenney/${name}.glb`;
}

type KitProps = ThreeElements["group"] & {
  /** 모델 이름 (확장자 제외). 예: "tree", "lantern" */
  name: string;
  /** 어느 팩의 모델인지 (기본 kenney) */
  pack?: ModelPack;
  /** 지정하면 이 색을 곱해서 칠합니다 (집 벽 색깔 바꾸기용). 원본 재질은 건드리지 않고 복사해서 씁니다. */
  tint?: string;
  /**
   * 0보다 크면 모델이 자기 색으로 스스로 빛납니다 (가짜 빛: 조명 없이 밝아 보이게). 밤의 트리 장식용.
   * 원본 재질은 건드리지 않고 복사해서 씁니다.
   */
  glow?: number;
};

export function Kit({ name, pack = "kenney", tint, glow = 0, ...props }: KitProps) {
  const { scene } = useGLTF(modelUrl(pack, name));

  // 복사본 만들기. scene.clone: 모양은 공유하고 위치·회전만 따로 가지는 사본
  const object = useMemo(() => {
    const copy = scene.clone(true);
    if (tint || glow > 0) {
      copy.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        // 재질도 복사해야 같은 모델을 쓰는 다른 물체의 색이 같이 바뀌지 않습니다
        const material = (mesh.material as THREE.MeshStandardMaterial).clone();
        if (tint) material.color.set(tint);
        if (glow > 0) {
          // 모델의 색 그림 그대로 빛나게 (빨간 방울은 빨갛게, 종은 금색으로)
          material.emissive = new THREE.Color("#ffffff");
          material.emissiveMap = material.map;
          material.emissiveIntensity = glow;
        }
        mesh.material = material;
      });
    }
    return copy;
  }, [scene, tint, glow]);

  return (
    <group {...props}>
      <primitive object={object} />
    </group>
  );
}

/** 마을에서 쓰는 모델 이름 목록. 미리 받아 두면 처음 화면이 덜 늦게 뜹니다. */
export const PRELOAD_MODELS = [
  "cabin-fence",
  "cabin-door-rotate",
  "cabin-window-a",
  "cabin-window-b",
  "cabin-wall",
  "cabin-wall-wreath",
  "cabin-corner-logs",
  "cabin-wall-roof",
  "cabin-roof-snow",
  "cabin-roof-snow-chimney",
  "tree",
  "lantern",
  // 장식 단계에서 쓰는 모델
  "present-a-cube",
  "present-a-rectangle",
  "present-a-round",
  "present-b-cube",
  "present-b-rectangle",
  "present-b-round",
  "reindeer",
  "sled",
  "nutcracker",
  "tree-decorated-snow",
  "sock-red",
  "sock-green",
  "sock-red-cane",
  "snowflake-a",
  "snowflake-b",
  "snowflake-c",
  "gingerbread-man",
  "candy-cane-red",
  "candy-cane-green",
] as const;

/** KayKit Holiday Bits에서 쓰는 모델 이름 목록 (미리 받아 두기) */
export const PRELOAD_KAYKIT = [
  "lantern",
  "bell",
  "gingerbread_man",
  "snowman_A",
  "snowman_B",
  "snowball_pile",
  "wreath",
  "christmas_tree_decorated",
  "present_A_red",
  "present_A_green",
  "present_B_blue",
  "present_B_red",
  "present_C_white",
  "present_C_yellow",
  "present_D_green",
  "present_E_red",
  "present_sphere_A_red",
  "present_sphere_B_green",
] as const;

PRELOAD_MODELS.forEach((name) => useGLTF.preload(modelUrl("kenney", name)));
PRELOAD_KAYKIT.forEach((name) => useGLTF.preload(modelUrl("kaykit", name)));
