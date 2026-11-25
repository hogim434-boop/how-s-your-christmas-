"use client";

// 밤 = 예전 시안의 "미니어처 밤" 분위기입니다. (11.25 사용자 요청: 시안 느낌 그대로)
// 출처: _archive/prototypes/island-3d/src/VillageApp.tsx(Lights night), Village.tsx(불빛·눈), styles.ts(night)
//
// 들어 있는 것
//  - 하늘: 짙은 남색 + 별
//  - 빛: 푸른 달빛(하늘빛 + 달 방향 빛, 그림자를 만듦)
//  - 따뜻한 불빛: 트리 앞, 가로등마다, 집 앞마다 (시안 값 그대로, 집·가로등 크기 차이만 맞춤)
//  - 마을 안에만 내리는 눈
// 시안처럼 따뜻한 빛은 "불빛"이 만들고, 달빛은 마을 모양만 보이게 은은하게 비춥니다.

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { lampPositions, type HouseSlot } from "@/lib/village/layout";
import { HOUSE_SCALE } from "./House";

/** 시안의 집 크기 배율(1.25). 우리 집(1.9)이 몇 배 큰지 계산해 집 앞 불빛 위치·범위를 맞춥니다 */
const PROTO_HOUSE_SCALE = 1.25;
const HOUSE_RATIO = HOUSE_SCALE / PROTO_HOUSE_SCALE;
/** 시안 마을 반지름(19). 눈 내리는 범위를 우리 마을 크기에 맞춰 늘리는 데 씁니다 */
const PROTO_RADIUS = 19;

const LAMPS = lampPositions();

// ───────── 마을 안에만 내리는 눈 ─────────

/** 셰이더에 넘기는 값을 바꿉니다 (컴포넌트 밖 함수: React 규칙 검사와 충돌하지 않게) */
function setUniform(material: THREE.ShaderMaterial, name: string, value: number) {
  material.uniforms[name].value = value;
}

/**
 * 시안의 VillageSnow: 작은 눈송이가 마을 안에서 위(높이 6)에서 아래로 계속 떨어집니다.
 * 시안은 매 장면 눈송이 위치를 코드로 옮겼지만, 여기서는 같은 움직임을 셰이더(그래픽 카드)로 계산해 휴대폰 부담을 줄였습니다.
 */
function VillageSnow({ count, radius }: { count: number; radius: number }) {
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
          color: { value: new THREE.Color("#e8eeff") },
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
          void main() {
            // 네모 점 대신 동그란 눈송이
            if (length(gl_PointCoord - 0.5) > 0.5) discard;
            gl_FragColor = vec4(color, 0.9);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }
        `,
      }),
    [],
  );
  useFrame(({ clock, size, viewport }) => {
    setUniform(material, "time", clock.elapsedTime);
    setUniform(material, "viewportH", size.height * viewport.dpr);
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ───────── 전체 묶음 ─────────

interface NightAtmosphereProps {
  /** 울타리까지의 반지름 */
  villageRadius: number;
  /** 집 자리 (집 앞 불빛 위치) */
  slots: HouseSlot[];
}

export function NightAtmosphere({ villageRadius, slots }: NightAtmosphereProps) {
  const snowRadius = villageRadius + 4;
  // 넓어진 만큼 눈송이를 늘려, 시안(반지름 23에 700개)과 같은 촘촘함을 유지합니다
  const snowCount = Math.round(700 * (snowRadius / (PROTO_RADIUS + 4)) ** 2);
  // 그림자가 마을 전체에 드리우도록 그림자 범위를 마을 크기만큼
  const shadowRange = villageRadius + 4;

  return (
    <>
      {/* 별: 시안과 같은 값 */}
      <Stars radius={120} depth={40} count={1400} factor={5} saturation={0} fade speed={0.6} />

      {/* 푸른 달빛: 마을 모양은 보이게, 따뜻한 빛은 불빛이 만듭니다 */}
      <hemisphereLight args={["#9fb2f0", "#2c3566", 1.0]} />
      <directionalLight
        position={[-6, 12, 5]}
        color="#b9c7ff"
        intensity={0.9}
        castShadow
        // 시안은 4096이지만 휴대폰 메모리를 생각해 2048
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowRange}
        shadow-camera-right={shadowRange}
        shadow-camera-top={shadowRange}
        shadow-camera-bottom={-shadowRange}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />

      {/* 트리 앞 따뜻한 불빛 */}
      <pointLight position={[0, 4, 3]} color="#ffd38a" intensity={22} distance={14} />

      {/* 가로등마다 따뜻한 불빛 (등불 높이) */}
      {LAMPS.map((p, i) => (
        <pointLight key={i} position={[p.x, 3.0, p.z]} color="#ffd9a0" intensity={9} distance={7} />
      ))}

      {/* 집 앞마다 창문 불빛 (시안: 집 안쪽 좌표 (0, 1, 1.9) × 집 배율) */}
      {slots.map((s, i) => {
        const x = 0;
        const z = 1.9 * HOUSE_SCALE;
        const cos = Math.cos(s.rotation);
        const sin = Math.sin(s.rotation);
        return (
          <pointLight
            key={i}
            position={[s.x + x * cos + z * sin, 1.0 * HOUSE_SCALE, s.z - x * sin + z * cos]}
            color="#ffc98a"
            intensity={5 * HOUSE_RATIO * HOUSE_RATIO}
            distance={5 * HOUSE_RATIO}
          />
        );
      })}

      <VillageSnow count={snowCount} radius={snowRadius} />
    </>
  );
}
