"use client";

// 같은 모델을 여러 자리에 "한 번에" 그리는 공용 부품입니다. (11.25 성능 개선)
//
// 💡 왜 필요한가요?
//    모델을 하나씩 따로 그리면, 그릴 때마다 그래픽 카드에 "그리기 명령"을 한 번씩 보냅니다.
//    집이 44채면 리스도 44번, 눈사람도 44번… 명령 수가 많아질수록 느려집니다.
//    InstancedMesh는 "이 모양을 이 자리들에 전부 그려 줘"라고 한 번만 명령합니다. 보이는 모습은 똑같습니다.

import { useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { modelUrl, type ModelPack } from "./Kit";
import { markShowThrough } from "./showThrough";

interface InstancedKitProps {
  /** 모델 이름 (확장자 제외) */
  name: string;
  /** 어느 팩의 모델인지 (기본 kenney) */
  pack?: ModelPack;
  /** 모델을 놓을 자리들 (위치·회전·크기를 담은 행렬) */
  matrices: THREE.Matrix4[];
  /** true면 반투명해진 집 뒤에서도 또렷하게 보이게 합니다 (우체통 장식용, showThrough.ts) */
  showThrough?: boolean;
}

export function InstancedKit({ name, pack = "kenney", matrices, showThrough = false }: InstancedKitProps) {
  const { scene } = useGLTF(modelUrl(pack, name));

  // 모델 안의 부품마다 "모양·재질"을 꺼내 둡니다 (부품의 위치·회전은 모양에 미리 적용)
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const list: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      list.push({
        geometry: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
        // showThrough일 때는 재질을 복사해서, 같은 모델을 쓰는 다른 물체에 영향이 가지 않게 합니다
        material: showThrough ? (mesh.material as THREE.Material).clone() : (mesh.material as THREE.Material),
      });
    });
    return list;
  }, [scene, showThrough]);

  if (matrices.length === 0) return null;
  return (
    <group>
      {parts.map((part, i) => (
        <InstancedPart
          // 개수가 바뀌면 새로 만듭니다 (InstancedMesh는 만들 때 개수가 정해집니다)
          key={`${i}-${matrices.length}`}
          geometry={part.geometry}
          material={part.material}
          matrices={matrices}
          showThrough={showThrough}
        />
      ))}
    </group>
  );
}

interface InstancedPartProps {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  showThrough: boolean;
}

function InstancedPart({ geometry, material, matrices, showThrough }: InstancedPartProps) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    // 전체를 감싸는 범위를 다시 계산해야 화면 밖으로 잘못 판단되어 사라지지 않습니다
    mesh.computeBoundingSphere();
    if (showThrough) markShowThrough(mesh);
  }, [matrices, showThrough]);

  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} />;
}

/** 위치·y축 회전·크기로 행렬을 만듭니다 */
export function placement(position: [number, number, number], rotationY = 0, scale = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
    new THREE.Vector3(scale, scale, scale),
  );
}
