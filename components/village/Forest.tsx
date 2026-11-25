"use client";

// 마을 바깥을 둘러싼 눈 덮인 전나무 숲입니다.
// 위치는 "정해진 규칙의 가짜 난수"로 만들어서, 새로고침해도 항상 같은 모양입니다.
//
// 나무 모델: 대왕 트리와 같은 Blender 전나무에 눈을 얹은 가벼운 버전 (11.25 사용자 요청)
//   scripts/blender/make_fir.py -- public/models/handmade/fir_snow.glb --snow --lite
//
// 💡 인스턴싱(instancing): 같은 모양의 나무 110그루를 하나씩 따로 그리지 않고,
//    "모양 1개 + 자리 110개"를 그래픽 카드에 한 번에 넘겨 그립니다. 휴대폰 부담이 크게 줄어듭니다.

import { useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/handmade/fir_snow.glb";

/** 숲 나무 개수 (휴대폰 성능을 위해 제한) */
const TREE_COUNT = 110;

/** 시드가 같으면 항상 같은 수열을 돌려주는 작은 난수 함수 (mulberry32) */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ForestProps {
  /** 울타리 반지름. 숲은 이 바깥에 만듭니다. */
  villageRadius: number;
  /** 땅 높이 (나무를 언덕 위에 세우기 위해). 살짝 묻히도록 0.1만큼 내려 놓습니다 */
  heightAt: (x: number, z: number) => number;
}

export function Forest({ villageRadius, heightAt }: ForestProps) {
  const trees = useMemo(() => {
    const rand = seededRandom(1225);
    const list: { x: number; y: number; z: number; scale: number; rot: number }[] = [];
    for (let i = 0; i < TREE_COUNT; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = villageRadius + 3 + rand() * 24;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      // 카메라가 있는 앞쪽(+z) 반쪽은 숲을 만들지 않습니다. (큰 나무가 화면 아래를 가리지 않게)
      if (z > villageRadius * 0.15) continue;
      list.push({ x, y: Math.max(0, heightAt(x, z) - 0.1), z, scale: 2.8 + rand() * 2, rot: rand() * Math.PI * 2 });
    }
    return list;
  }, [villageRadius, heightAt]);

  // 모델 안의 부품(잎+눈, 줄기)마다 "모양·재질"을 꺼내 둡니다
  const { scene } = useGLTF(MODEL_URL);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const list: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      // 부품의 위치·회전을 모양에 미리 적용해 두면, 나무 자리만 바꿔 끼우면 됩니다
      list.push({
        geometry: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
        material: mesh.material as THREE.Material,
      });
    });
    return list;
  }, [scene]);

  return (
    <group>
      {parts.map((part, i) => (
        <ForestPart key={i} geometry={part.geometry} material={part.material} trees={trees} />
      ))}
    </group>
  );
}

interface ForestPartProps {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  trees: { x: number; y: number; z: number; scale: number; rot: number }[];
}

/** 부품 하나(예: 잎)를 모든 나무 자리에 한 번에 그립니다 */
function ForestPart({ geometry, material, trees }: ForestPartProps) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    trees.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.scale, t.scale, t.scale));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // 나무 전체를 감싸는 범위를 다시 계산해야 화면 밖으로 잘못 판단되어 사라지지 않습니다
    mesh.computeBoundingSphere();
  }, [trees]);

  return <instancedMesh ref={ref} args={[geometry, material, trees.length]} />;
}

useGLTF.preload(MODEL_URL);
