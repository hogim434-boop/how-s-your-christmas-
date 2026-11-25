"use client";

// 별이 달리면 트리 꼭대기에서 계속 터지는 간단한 폭죽입니다. (점 입자가 퍼졌다가 떨어지며 사라짐)

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** 한 번 터지는 입자 개수 */
const PARTICLES = 28;
/** 한 번 터지고 다음에 다시 터질 때까지(초) */
const CYCLE = 2.4;

interface FireworkProps {
  position: [number, number, number];
  color: string;
  /** 터지는 시작 시점을 어긋나게 하는 값(초) */
  delay?: number;
}

export function Firework({ position, color, delay = 0 }: FireworkProps) {
  const points = useRef<THREE.Points>(null);

  // 입자마다 퍼지는 방향(구 모양)을 미리 정해 둡니다. 시드가 고정이라 항상 같은 모양
  const directions = useMemo(() => {
    const arr = new Float32Array(PARTICLES * 3);
    for (let i = 0; i < PARTICLES; i++) {
      // 황금각으로 구 표면에 고르게 퍼뜨리기
      const y = 1 - (i / (PARTICLES - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const phi = i * 2.399963;
      arr[i * 3] = Math.cos(phi) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(phi) * r;
    }
    return arr;
  }, []);
  const positions = useMemo(() => new Float32Array(PARTICLES * 3), []);
  // 네모 점이 아니라 동그란 불꽃으로 보이게 하는 흐릿한 원 모양 그림
  const sprite = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.5, "rgba(255,255,255,0.8)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(({ clock }) => {
    const p = points.current;
    if (!p) return;
    // 이번 주기에서 몇 초 지났는지 (0 ~ CYCLE)
    const t = (((clock.elapsedTime - delay) % CYCLE) + CYCLE) % CYCLE;
    const spread = 3.4 * (1 - Math.exp(-t * 2.2)); // 처음엔 빠르게, 점점 느리게 퍼짐
    const fall = 0.9 * t * t; // 중력처럼 아래로 처짐
    const attr = p.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLES; i++) {
      attr.setXYZ(i, directions[i * 3] * spread, directions[i * 3 + 1] * spread - fall, directions[i * 3 + 2] * spread);
    }
    attr.needsUpdate = true;
    // 시간이 지날수록 투명해져서 사라짐
    (p.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - t / (CYCLE * 0.85));
  });

  return (
    <points ref={points} position={position} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.5} map={sprite} transparent depthWrite={false} sizeAttenuation fog={false} />
    </points>
  );
}
