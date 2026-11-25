"use client";

// 집집마다 굴뚝에서 피어오르는 연기입니다. (11.25 사용자 요청: 아침·밤 모두)
// 예전 시안(real/Atmosphere.tsx의 Smoke)의 움직임을 그대로 옮겼고, 시간대마다 연기 색만 다릅니다.

import { useMemo } from "react";
import * as THREE from "three";
import type { HouseSlot } from "@/lib/village/layout";
import type { SkyMode } from "@/lib/village/theme";
import { HOUSE_SCALE } from "./House";
import { POINT_SIZE, useParticleMaterial } from "./particles";

/** 시간대별 연기 색과 진하기 (아침은 옅은 회색, 밤은 달빛 받은 푸른 회색) */
const SMOKE_LOOK: Record<SkyMode, { color: string; amount: number }> = {
  // 시안의 진하기(1)로는 너무 옅어 거의 안 보여서, 모두 진하게 올렸습니다 (11.25 확인 후 수정)
  // 아침: 하얀 눈·하늘 위에서도 보이도록 회색빛
  day: { color: "#9aa5b5", amount: 2.2 },
  night: { color: "#aab3d6", amount: 1.8 },
};


const SMOKE_COUNT = 26;

/**
 * 굴뚝 꼭대기 위치 (집 안쪽 좌표, 앞면 = +z). Kenney 굴뚝 지붕 부품을 재서 얻은 값:
 * 부품 위치(0.5, 1, -0.6) + 굴뚝 꼭대기(0.2, 1.27, 0) → 집 크기 배율을 곱함
 */
const CHIMNEY_TOP: [number, number, number] = [0.7 * HOUSE_SCALE, 2.3 * HOUSE_SCALE, -0.6 * HOUSE_SCALE];

/** 굴뚝 하나에서 피어오르는 연기 */
function Smoke({ position, color, amount }: { position: [number, number, number]; color: string; amount: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(SMOKE_COUNT * 3);
    const phase = new Float32Array(SMOKE_COUNT);
    for (let i = 0; i < SMOKE_COUNT; i++) phase[i] = i / SMOKE_COUNT;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    return g;
  }, []);

  const material = useParticleMaterial(
    /* glsl */ `
      ${POINT_SIZE}
      uniform float time;
      attribute float phase;
      varying float vAlpha;
      void main() {
        // t: 연기 한 덩이의 나이 (0 = 막 나옴, 1 = 사라짐)
        float t = fract(time * 0.1 + phase);
        vec3 p = vec3(0.0);
        p.y = t * 5.0;
        // 위로 갈수록 바람에 밀려 옆으로 휘어집니다
        p.x = t * t * 2.6 + sin(t * 7.0 + phase * 30.0) * 0.18 * t;
        p.z = -t * t * 1.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = worldSize(0.35 + t * 2.4, mv);
        vAlpha = smoothstep(0.0, 0.08, t) * pow(1.0 - t, 1.6);
      }
    `,
    /* glsl */ `
      uniform sampler2D map;
      uniform vec3 color;
      uniform float amount;
      varying float vAlpha;
      void main() {
        float a = texture2D(map, gl_PointCoord).a;
        gl_FragColor = vec4(color, a * vAlpha * 0.32 * amount);
        #include <colorspace_fragment>
      }
    `,
    { color: { value: new THREE.Color(color) }, amount: { value: amount } },
    THREE.NormalBlending,
  );
  return <points position={position} geometry={geometry} material={material} frustumCulled={false} />;
}

interface ChimneySmokeProps {
  slots: HouseSlot[];
  sky: SkyMode;
}

/** 모든 집의 굴뚝 연기 */
export function ChimneySmoke({ slots, sky }: ChimneySmokeProps) {
  const look = SMOKE_LOOK[sky];
  return (
    <group>
      {slots.map((s, i) => {
        // 집 안쪽 좌표 → 마을 좌표로 돌려 옮기기
        const [x, y, z] = CHIMNEY_TOP;
        const cos = Math.cos(s.rotation);
        const sin = Math.sin(s.rotation);
        return (
          // key에 sky를 넣어, 시간대가 바뀌면 새 색으로 다시 만듭니다
          <Smoke
            key={`${sky}-${i}`}
            position={[s.x + x * cos + z * sin, y, s.z - x * sin + z * cos]}
            color={look.color}
            amount={look.amount}
          />
        );
      })}
    </group>
  );
}
