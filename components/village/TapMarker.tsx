"use client";

// 땅을 눌렀을 때 그 자리에 잠깐 나타났다 사라지는 동그란 표시입니다.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { markerPlacement } from "@/lib/village/markerPlacement";
import { useWalkTarget, type WalkStore } from "@/lib/village/walkStore";

/** 사라지는 데 걸리는 시간(초) */
const FADE_SECONDS = 0.9;
/** 동그라미가 처음 만들어질 때 바라보는 방향 (ringGeometry는 +z를 보는 세워진 판입니다) */
const RING_FACING = new THREE.Vector3(0, 0, 1);

interface TapMarkerProps {
  store: WalkStore;
  /** (x, z) 자리의 땅 높이. 눈 둔덕 위를 눌러도 표시가 땅 위에 놓이게 합니다 */
  heightAt: (x: number, z: number) => number;
}

export function TapMarker({ store, heightAt }: TapMarkerProps) {
  // 걸어갈 목표가 바뀌면 이 부품만 다시 그려집니다 (lib/village/walkStore.ts)
  const target = useWalkTarget(store);
  // key를 target.id로 줘서, 새로 누를 때마다 처음부터 다시 시작합니다
  if (!target) return null;
  return <Ring key={target.id} x={target.x} z={target.z} heightAt={heightAt} />;
}

function Ring({ x, z, heightAt }: { x: number; z: number; heightAt: (x: number, z: number) => number }) {
  const mesh = useRef<THREE.Mesh>(null);

  // 표시를 놓을 높이와 기울기를 한 번만 계산합니다 → lib/village/markerPlacement.ts
  // (11.27 버그 수정) 전에는 높이를 0.08로 고정해서, 눈 둔덕 위를 누르면 표시가 눈 속에 묻혀 안 보였습니다.
  const { y, quaternion } = useMemo(() => {
    const p = markerPlacement(x, z, heightAt);
    const normal = new THREE.Vector3(p.normal.x, p.normal.y, p.normal.z);
    // 세워진 판(+z를 봄)을 땅이 바라보는 방향으로 돌립니다
    return { y: p.y, quaternion: new THREE.Quaternion().setFromUnitVectors(RING_FACING, normal) };
  }, [x, z, heightAt]);

  const age = useRef(0);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    age.current += delta;
    const t = Math.min(age.current / FADE_SECONDS, 1);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    m.scale.setScalar(1 + t * 0.8);
    m.visible = t < 1;
  });

  return (
    <mesh ref={mesh} position={[x, y, z]} quaternion={quaternion}>
      <ringGeometry args={[0.35, 0.5, 32]} />
      <meshBasicMaterial color="#e8504a" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}
