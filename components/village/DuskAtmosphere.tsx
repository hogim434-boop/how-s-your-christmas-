"use client";

// 밤 모드 = 예전 시안의 "노을(dusk)" 분위기입니다. (11.25 사용자 요청: 시안 느낌과 완전히 같게)
// 출처: _archive/prototypes/island-3d/src/real/Atmosphere.tsx, mood.ts(dusk), RealVillage.tsx
// 시안의 숫자·셰이더를 그대로 옮기고, 마을 크기가 다른 부분(눈·안개 범위)만 우리 마을 크기에 맞춰 늘렸습니다.
//
// 들어 있는 것
//  - 하늘: 남색 → 보라 → 주황 그라데이션 (GradientSky)
//  - 빛: 하늘 사진(HDRI) 반사광 + 분홍/푸른 하늘빛 + 숲 너머 낮게 깔린 주황 해(긴 그림자)
//  - 불빛: 가로등·트리·집 앞의 따뜻한 조명
//  - 날씨: 내리는 눈, 땅에 낮게 깔린 분홍 안개, 반딧불 같은 금빛 알갱이, 굴뚝 연기
//
// 💡 셰이더(shader): 그래픽 카드가 점 하나하나의 색·위치를 직접 계산하는 작은 프로그램.
//    눈송이 수백 개를 매 순간 움직여야 해서 일반 코드 대신 셰이더로 그립니다.

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { lampPositions, type HouseSlot } from "@/lib/village/layout";
import { HOUSE_SCALE } from "./House";

// ───────── 시안의 노을 설정값 (mood.ts dusk) ─────────
export const DUSK = {
  /** 배경·안개 색: 해 질 녘 분홍빛이 섞인 보랏빛 */
  background: "#b79bb5",
  fog: [22, 95] as [number, number],
  sky: { top: "#2e3468", middle: "#9a6f9e", horizon: "#f2a27e" },
  hdri: "/hdri/rural_winter_roadside.hdr",
  envIntensity: 0.22,
  /** 숲 너머 왼쪽 뒤편, 지평선 바로 위의 해 → 길고 푸른 그림자 */
  sun: { position: [-30, 8, -22] as [number, number, number], color: "#ff8f52", intensity: 4.2 },
  /** 그늘은 차가운 푸른빛, 하늘 쪽은 분홍빛 */
  hemi: ["#d98fa0", "#33416f", 0.45] as [string, string, number],
  snowfall: 380,
  mist: 1,
  smoke: 1,
} as const;

/** 시안 마을 반지름(19). 우리 마을이 몇 배 큰지 계산해 눈·안개 범위를 늘리는 데 씁니다 */
const PROTO_RADIUS = 19;

// ───────── 알갱이 공통 도구 ─────────

/** 가운데는 진하고 가장자리로 갈수록 투명해지는 동그란 점 그림 (눈송이·연기·빛 알갱이 모양) */
let softDotTexture: THREE.CanvasTexture | null = null;
function softDot() {
  if (softDotTexture) return softDotTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.75)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  softDotTexture = new THREE.CanvasTexture(canvas);
  return softDotTexture;
}

/** 정해진 씨앗으로 매번 같은 "무작위" 숫자를 만듭니다 (새로고침해도 같은 배치) */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 셰이더에 넘기는 값(uniform)을 바꿉니다.
 * three.js 재질은 React 상태가 아니라서 매 장면마다 직접 고칩니다. (컴포넌트 밖 함수로 두어 React 규칙 검사와 충돌하지 않게)
 */
function setUniform(material: THREE.ShaderMaterial, name: string, value: number) {
  material.uniforms[name].value = value;
}

/** 알갱이 재질을 만들고, 매 장면마다 시간과 화면 높이를 알려 줍니다 */
function useParticleMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  blending: THREE.Blending,
) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { time: { value: 0 }, viewportH: { value: 800 }, map: { value: softDot() }, ...uniforms },
        transparent: true,
        depthWrite: false,
        blending,
      }),
    // 재질은 처음 한 번만 만듭니다 (셰이더 글자는 바뀌지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useFrame(({ clock, size, viewport }) => {
    setUniform(material, "time", clock.elapsedTime);
    setUniform(material, "viewportH", size.height * viewport.dpr);
  });
  return material;
}

/** 알갱이 크기를 "실제 크기" 기준으로 화면 픽셀 크기로 바꾸는 셰이더 한 줄 */
const POINT_SIZE = /* glsl */ `
  uniform float viewportH;
  float worldSize(float size, vec4 mv) {
    return size * projectionMatrix[1][1] * 0.5 * viewportH / -mv.z;
  }
`;

// ───────── 하늘 ─────────

/** 위에서 아래로 세 가지 색이 부드럽게 이어지는 하늘 */
function GradientSky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide, // 우리는 공 안에 있으니 안쪽 면에 칠합니다
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(DUSK.sky.top) },
          middle: { value: new THREE.Color(DUSK.sky.middle) },
          horizon: { value: new THREE.Color(DUSK.sky.horizon) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 middle;
          uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = max(vDir.y, 0.0);
            vec3 color = mix(horizon, middle, smoothstep(0.0, 0.18, h));
            color = mix(color, top, smoothstep(0.18, 0.7, h));
            gl_FragColor = vec4(color, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  );
  return (
    // 카메라가 볼 수 있는 가장 먼 거리(300)보다 안쪽에 둡니다
    <mesh material={material} renderOrder={-10}>
      <sphereGeometry args={[250, 32, 16]} />
    </mesh>
  );
}

// ───────── 빛 ─────────

/** 하늘 사진(HDRI) 반사광 + 하늘빛 + 낮게 깔린 노을 해 (그림자를 만듦) */
function Lighting({ shadowRange }: { shadowRange: number }) {
  return (
    <>
      {/* 하늘 사진: 실제 겨울 하늘의 빛이 모든 물체를 은은하게 비춥니다 (Poly Haven, CC0) */}
      <Environment files={DUSK.hdri} environmentIntensity={DUSK.envIntensity} />
      <hemisphereLight args={DUSK.hemi} />
      <directionalLight
        position={DUSK.sun.position}
        color={DUSK.sun.color}
        intensity={DUSK.sun.intensity}
        castShadow
        // 그림자 지도 해상도: 시안은 4096이지만 휴대폰 메모리를 생각해 2048
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowRange}
        shadow-camera-right={shadowRange}
        shadow-camera-top={shadowRange}
        shadow-camera-bottom={-shadowRange}
        shadow-camera-far={140}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
      />
    </>
  );
}

// ───────── 내리는 눈 ─────────

/** 부드러운 동그란 눈송이가 좌우로 흔들리며 천천히 내립니다 */
function Snowfall({ count, radius }: { count: number; radius: number }) {
  const geometry = useMemo(() => {
    const rand = seeded(21);
    const positions = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = rand() * 10;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      phase[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    return g;
  }, [count, radius]);

  const material = useParticleMaterial(
    /* glsl */ `
      ${POINT_SIZE}
      uniform float time;
      attribute float phase;
      varying float vFade;
      void main() {
        vec3 p = position;
        // 아래로 떨어지다 바닥에 닿으면 다시 위에서 시작
        p.y = mod(p.y - time * (0.45 + phase * 0.35), 10.0);
        // 바람에 흔들리듯 좌우로
        p.x += sin(time * 0.8 + phase * 20.0) * 0.35;
        p.z += cos(time * 0.6 + phase * 14.0) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = worldSize(0.07 + phase * 0.06, mv);
        vFade = smoothstep(0.0, 0.6, p.y);
      }
    `,
    /* glsl */ `
      uniform sampler2D map;
      varying float vFade;
      void main() {
        float a = texture2D(map, gl_PointCoord).a;
        gl_FragColor = vec4(vec3(1.0), a * 0.9 * vFade);
      }
    `,
    {},
    THREE.NormalBlending,
  );
  // frustumCulled={false}: 셰이더가 위치를 바꾸므로 "화면 밖"으로 잘못 판단해 숨기지 않게
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ───────── 땅 안개 ─────────

/** 땅 위에 낮게 깔려 천천히 흘러가는 안개 (반투명 판 3겹) */
function GroundMist({ scale }: { scale: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          time: { value: 0 },
          color: { value: new THREE.Color(DUSK.background) },
          amount: { value: DUSK.mist },
          // 마을이 시안보다 큰 만큼 안개 무늬와 범위를 늘립니다
          scale: { value: scale },
        },
        vertexShader: /* glsl */ `
          varying vec2 vWorld;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float time;
          uniform vec3 color;
          uniform float amount;
          uniform float scale;
          varying vec2 vWorld;
          // 부드럽게 이어지는 무작위 무늬 (구름 같은 얼룩)
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
          }
          float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
            return v;
          }
          void main() {
            vec2 w = vWorld / scale;
            vec2 p = w * 0.09 + vec2(time * 0.025, time * 0.012);
            float cloud = smoothstep(0.35, 0.85, fbm(p));
            // 마을 가운데는 옅게, 바깥쪽(숲)으로 갈수록 진하게
            float edge = smoothstep(6.0, 22.0, length(w));
            gl_FragColor = vec4(color, cloud * (0.12 + 0.3 * edge) * amount);
            #include <colorspace_fragment>
          }
        `,
      }),
    [scale],
  );
  useFrame(({ clock }) => setUniform(material, "time", clock.elapsedTime));
  return (
    <group>
      {[0.25, 0.75, 1.4].map((y, i) => (
        // raycast 끔: 안개 판이 땅 터치(걷기)를 가로채지 않게
        <mesh
          key={y}
          position={[i * 7, y, i * -5]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={material}
          raycast={() => null}
        >
          <circleGeometry args={[70 * scale, 48]} />
        </mesh>
      ))}
    </group>
  );
}

// ───────── 떠다니는 빛 알갱이 ─────────

/** 노을빛 속에 반딧불처럼 천천히 떠오르는 금빛 알갱이 (광장 둘레) */
function Motes({ radius }: { radius: number }) {
  const geometry = useMemo(() => {
    const rand = seeded(33);
    const count = 180;
    const positions = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = rand();
      positions[i * 3 + 2] = Math.sin(angle) * r;
      phase[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    return g;
  }, [radius]);

  const material = useParticleMaterial(
    /* glsl */ `
      ${POINT_SIZE}
      uniform float time;
      attribute float phase;
      varying float vAlpha;
      void main() {
        float t = fract(position.y + time * 0.03 * (0.5 + phase));
        vec3 p = position;
        p.y = 0.3 + t * 4.5;
        p.x += sin(time * 0.4 + phase * 30.0) * 0.6;
        p.z += cos(time * 0.35 + phase * 21.0) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        // 천천히 깜박이며, 나타날 때와 사라질 때 부드럽게
        vAlpha = sin(t * 3.14159) * (0.55 + 0.45 * sin(time * 2.0 + phase * 50.0));
        gl_PointSize = worldSize(0.11, mv);
      }
    `,
    /* glsl */ `
      uniform sampler2D map;
      varying float vAlpha;
      void main() {
        float a = texture2D(map, gl_PointCoord).a;
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * 2.2, a * vAlpha);
      }
    `,
    {},
    THREE.AdditiveBlending,
  );
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ───────── 굴뚝 연기 ─────────

const SMOKE_COUNT = 26;

/**
 * 굴뚝 꼭대기 위치 (집 안쪽 좌표, 앞면 = +z). Kenney 굴뚝 지붕 부품을 재서 얻은 값:
 * 부품 위치(0.5, 1, -0.6) + 굴뚝 꼭대기(0.2, 1.27, 0) → 집 크기 배율을 곱함
 */
const CHIMNEY_TOP: [number, number, number] = [0.7 * HOUSE_SCALE, 2.3 * HOUSE_SCALE, -0.6 * HOUSE_SCALE];

/** 굴뚝에서 피어오르는 연기 (노을빛을 받아 따뜻한 회색) */
function Smoke({ position }: { position: [number, number, number] }) {
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
    { color: { value: new THREE.Color("#cbb9c2") }, amount: { value: DUSK.smoke } },
    THREE.NormalBlending,
  );
  return <points position={position} geometry={geometry} material={material} frustumCulled={false} />;
}

// ───────── 카메라를 따라가는 안개 ─────────

/** 안개 시작·끝 거리를 바꿉니다 (컴포넌트 밖 함수: React 규칙 검사와 충돌하지 않게) */
function setFogRange(fog: THREE.Fog, near: number, far: number) {
  fog.near = near;
  fog.far = far;
}

const FOG_DEPTH = DUSK.fog[1] - DUSK.fog[0]; // 안개가 진해지는 구간 길이 (73)
const PROTO_CAMERA_DISTANCE = 27; // 시안 카메라가 캐릭터에서 떨어진 거리 (세로 화면 기준)
const forward = new THREE.Vector3();

/**
 * 시안의 안개(22~95)는 카메라가 캐릭터에서 약 27 떨어져 있을 때 기준입니다.
 * 우리 카메라는 "트리 전체 보기"에서 44까지 멀어지므로, 같은 숫자를 쓰면 마을 가운데가 뿌옇게 됩니다. (11.25 수정)
 * 그래서 "카메라가 바라보는 땅까지의 거리"를 재서, 시안과 같은 비율이 되도록 안개 시작 거리를 함께 옮깁니다.
 */
function FogFollow() {
  useFrame(({ camera, scene }) => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog || !("near" in fog)) return;
    camera.getWorldDirection(forward);
    // 바라보는 방향이 땅(y=0)과 만나는 곳까지의 거리
    const focus = forward.y < -0.05 ? camera.position.y / -forward.y : PROTO_CAMERA_DISTANCE;
    const near = Math.max(DUSK.fog[0], DUSK.fog[0] + (focus - PROTO_CAMERA_DISTANCE));
    setFogRange(fog, near, near + FOG_DEPTH);
  });
  return null;
}

const LAMPS = lampPositions();

// ───────── 전체 묶음 ─────────

interface DuskAtmosphereProps {
  /** 울타리까지의 반지름 */
  villageRadius: number;
  /** 집 자리 (집 앞 불빛·굴뚝 연기 위치) */
  slots: HouseSlot[];
}

/** 노을 하늘·빛·날씨·집 불빛을 한꺼번에 깔아 줍니다 */
export function DuskAtmosphere({ villageRadius, slots }: DuskAtmosphereProps) {
  // 우리 마을이 시안보다 몇 배 큰지
  const scale = Math.max(1, villageRadius / PROTO_RADIUS);
  const snowRadius = villageRadius + 6;
  // 넓어진 만큼 눈송이를 늘려서, 시안과 같은 촘촘함을 유지합니다
  const snowCount = Math.round(DUSK.snowfall * (snowRadius / (PROTO_RADIUS + 6)) ** 2);

  return (
    <>
      <GradientSky />
      <FogFollow />
      <Lighting shadowRange={villageRadius + 4} />
      <Snowfall count={snowCount} radius={snowRadius} />
      <GroundMist scale={scale} />
      <Motes radius={13 * scale} />
      {/* 가로등마다 따뜻한 불빛 (시안: 높이 2.5, 세기 9, 범위 9) */}
      {LAMPS.map((p, i) => (
        <pointLight key={`lamp-${i}`} position={[p.x, 2.5, p.z]} color="#ffc98a" intensity={9} distance={9} decay={2} />
      ))}
      {/* 트리 아래 따뜻한 불빛 */}
      <pointLight position={[0, 4, 3.5]} color="#ffc98a" intensity={30} distance={14} decay={2} />
      {slots.map((s, i) => {
        // 집 안쪽 좌표 → 마을 좌표로 돌려 옮기기
        const cos = Math.cos(s.rotation);
        const sin = Math.sin(s.rotation);
        const toWorld = ([x, y, z]: [number, number, number]): [number, number, number] => [
          s.x + x * cos + z * sin,
          y,
          s.z - x * sin + z * cos,
        ];
        return (
          <group key={i}>
            {/* 창문 너머 새어 나오는 듯한 집 앞 따뜻한 불빛 (시안: 0.2, 1.4, 0.7 → 집 크기 배율) */}
            <pointLight
              position={toWorld([0.2 * HOUSE_SCALE, 1.4 * HOUSE_SCALE, 1.6 * HOUSE_SCALE])}
              color="#ffb870"
              intensity={5 * HOUSE_SCALE * HOUSE_SCALE}
              distance={5 * HOUSE_SCALE}
              decay={2}
            />
            <Smoke position={toWorld(CHIMNEY_TOP)} />
          </group>
        );
      })}
    </>
  );
}

