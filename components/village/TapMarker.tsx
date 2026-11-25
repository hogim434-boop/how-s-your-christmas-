"use client";

// 땅을 눌렀을 때 그 자리에 잠깐 나타났다 사라지는 동그란 표시입니다.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WalkTarget } from "./Player";

/** 사라지는 데 걸리는 시간(초) */
const FADE_SECONDS = 0.9;

export function TapMarker({ target }: { target: WalkTarget | null }) {
  // key를 target.id로 줘서, 새로 누를 때마다 처음부터 다시 시작합니다
  if (!target) return null;
  return <Ring key={target.id} x={target.x} z={target.z} />;
}

function Ring({ x, z }: { x: number; z: number }) {
  const mesh = useRef<THREE.Mesh>(null);
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
    <mesh ref={mesh} position={[x, 0.08, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.35, 0.5, 32]} />
      <meshBasicMaterial color="#e8504a" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}
