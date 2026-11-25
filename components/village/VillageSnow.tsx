"use client";

// 마을 안에 내리는 눈입니다. 아침·밤에 씁니다. (11.25 사용자 요청: 아침에도 눈이 내리게)
// 예전 시안 "미니어처"의 VillageSnow와 같은 움직임(높이 6에서 속도 0.5~0.9로 떨어짐)입니다.

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** 시안 마을 반지름(19). 눈 내리는 범위를 우리 마을 크기에 맞춰 늘리는 데 씁니다 */
const PROTO_RADIUS = 19;


/** 셰이더에 넘기는 값을 바꿉니다 (컴포넌트 밖 함수: React 규칙 검사와 충돌하지 않게) */
function setUniform(material: THREE.ShaderMaterial, name: string, value: number) {
  material.uniforms[name].value = value;
}

/**
 * 시안의 VillageSnow: 작은 눈송이가 마을 안에서 위(높이 6)에서 아래로 계속 떨어집니다.
 * 시안은 매 장면 눈송이 위치를 코드로 옮겼지만, 여기서는 같은 움직임을 셰이더(그래픽 카드)로 계산해 휴대폰 부담을 줄였습니다.
 */
function SnowPoints({ count, radius, color, opacity }: { count: number; radius: number; color: string; opacity: number }) {
  const geometry = useMemo(() => {
    // 새로고침해도 같은 배치가 되도록 정해진 규칙의 "가짜 난수"
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const positions = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = rand() * 6;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      // 시안: 떨어지는 속도 0.5 + (i % 5) × 0.1
      speed[i] = 0.5 + (i % 5) * 0.1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("speed", new THREE.BufferAttribute(speed, 1));
    return g;
  }, [count, radius]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: true,
        uniforms: {
          time: { value: 0 },
          color: { value: new THREE.Color(color) },
          opacity: { value: opacity },
          // 시안 pointsMaterial size 0.08 (실제 크기)
          size: { value: 0.08 },
          viewportH: { value: 800 },
          ...THREE.UniformsLib.fog,
        },
        vertexShader: /* glsl */ `
          #include <fog_pars_vertex>
          uniform float time;
          uniform float size;
          uniform float viewportH;
          attribute float speed;
          void main() {
            vec3 p = position;
            p.y = mod(p.y - time * speed, 6.0);
            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = size * projectionMatrix[1][1] * 0.5 * viewportH / -mvPosition.z;
            #include <fog_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          #include <fog_pars_fragment>
          uniform vec3 color;
          uniform float opacity;
          void main() {
            // 네모 점 대신 동그란 눈송이
            if (length(gl_PointCoord - 0.5) > 0.5) discard;
            gl_FragColor = vec4(color, opacity);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }
        `,
      }),
    [color, opacity],
  );
  useFrame(({ clock, size, viewport }) => {
    setUniform(material, "time", clock.elapsedTime);
    setUniform(material, "viewportH", size.height * viewport.dpr);
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

interface VillageSnowProps {
  /** 울타리까지의 반지름 */
  villageRadius: number;
  /** 눈송이 색과 불투명도 (시안: 아침 흰색 0.75, 밤 푸른빛 흰색 0.9) */
  color: string;
  opacity: number;
}

export function VillageSnow({ villageRadius, color, opacity }: VillageSnowProps) {
  const radius = villageRadius + 4;
  // 넓어진 만큼 눈송이를 늘려, 시안(반지름 23에 700개)과 같은 촘촘함을 유지합니다
  const count = Math.round(700 * (radius / (PROTO_RADIUS + 4)) ** 2);
  return <SnowPoints count={count} radius={radius} color={color} opacity={opacity} />;
}
