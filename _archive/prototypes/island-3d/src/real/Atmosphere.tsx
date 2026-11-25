import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { ISLAND_RADIUS } from '../world'
import type { Mood } from './mood'
import { seeded, softDot } from './textures'

// 하늘, 햇빛, 날씨(눈·안개·연기·빛 알갱이)를 그리는 파일입니다.
// "분위기"의 대부분이 여기서 만들어집니다.

// ───────── 셰이더 공통 도구 ─────────
// 셰이더: 그래픽 카드에서 직접 돌아가는 작은 그림 프로그램입니다.
// 수천 개의 알갱이를 매 순간 하나하나 계산해야 해서, 일반 코드 대신 셰이더로 그립니다.

/**
 * 알갱이 재료를 만들고, 매 장면마다 시간(time)과 화면 높이(viewportH)를 알려 줍니다.
 * viewportH 는 "실제 크기 1칸이 화면에서 몇 픽셀인지" 계산할 때 씁니다.
 */
function useParticleMaterial(vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { time: { value: 0 }, viewportH: { value: 800 }, map: { value: softDot }, ...uniforms },
        transparent: true,
        depthWrite: false,
        blending,
      }),
    // 재료는 처음 한 번만 만들고, 값이 바뀌면 아래에서 uniforms 만 고칩니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useFrame(({ clock, size, viewport }) => {
    material.uniforms.time.value = clock.elapsedTime
    material.uniforms.viewportH.value = size.height * viewport.dpr
  })
  return material
}

/** 알갱이 크기를 "실제 크기(칸)" 기준으로 픽셀 크기로 바꾸는 셰이더 한 줄 */
const POINT_SIZE = /* glsl */ `
  uniform float viewportH;
  float worldSize(float size, vec4 mv) {
    return size * projectionMatrix[1][1] * 0.5 * viewportH / -mv.z;
  }
`

// ───────── 하늘 ─────────

/** 위에서 아래로 세 가지 색이 부드럽게 이어지는 하늘 (트리 전체 보기에서 보입니다) */
function GradientSky({ sky }: { sky: Mood['sky'] }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(sky.top) },
          middle: { value: new THREE.Color(sky.middle) },
          horizon: { value: new THREE.Color(sky.horizon) },
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
    [sky],
  )
  return (
    <mesh material={material} renderOrder={-10}>
      <sphereGeometry args={[450, 32, 16]} />
    </mesh>
  )
}

// ───────── 빛 ─────────

/** 해, 하늘빛, 주변 풍경 반사 */
function Lighting({ mood }: { mood: Mood }) {
  return (
    <>
      {/* 하늘 사진(HDRI): 실제 겨울 하늘의 빛이 모든 물체를 은은하게 비추고, 유리·금속에 풍경이 비칩니다 */}
      <Environment files={`/hdri/${mood.hdri}.hdr`} environmentIntensity={mood.envIntensity} />
      <hemisphereLight args={mood.hemi} />
      <directionalLight
        position={mood.sun.position}
        color={mood.sun.color}
        intensity={mood.sun.intensity}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-far={120}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
      />
    </>
  )
}

// ───────── 내리는 눈 ─────────

/** 부드러운 동그란 눈송이가 좌우로 흔들리며 천천히 내립니다 */
function Snowfall({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const rand = seeded(21)
    const positions = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2
      const radius = Math.sqrt(rand()) * (ISLAND_RADIUS + 6)
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = rand() * 10
      positions[i * 3 + 2] = Math.sin(angle) * radius
      phase[i] = rand()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('phase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [count])

  const material = useParticleMaterial(
    /* glsl */ `
      ${POINT_SIZE}
      uniform float time;
      attribute float phase;
      varying float vFade;
      void main() {
        vec3 p = position;
        // 시간이 지나면 아래로 떨어지고, 바닥에 닿으면 다시 위에서 시작합니다
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
  )
  return <points geometry={geometry} material={material} />
}

// ───────── 눈밭의 반짝임 ─────────

/** 햇빛을 받은 눈 결정이 여기저기서 반짝 빛났다 사라집니다 */
function Sparkle() {
  const geometry = useMemo(() => {
    const rand = seeded(9)
    const count = 2200
    const positions = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2
      const radius = Math.sqrt(rand()) * (ISLAND_RADIUS + 4)
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = 0.03
      positions[i * 3 + 2] = Math.sin(angle) * radius
      phase[i] = rand()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('phase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [])

  const material = useParticleMaterial(
    /* glsl */ `
      ${POINT_SIZE}
      uniform float time;
      attribute float phase;
      varying float vGlint;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // 대부분의 시간엔 0, 아주 잠깐만 1 → "반짝"
        vGlint = pow(max(0.0, sin(time * (1.2 + phase) + phase * 40.0)), 30.0);
        gl_PointSize = worldSize(0.16, mv) * (0.4 + vGlint);
      }
    `,
    /* glsl */ `
      uniform sampler2D map;
      varying float vGlint;
      void main() {
        float a = texture2D(map, gl_PointCoord).a;
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.94) * 1.6, a * vGlint);
      }
    `,
    {},
    THREE.AdditiveBlending,
  )
  return <points geometry={geometry} material={material} />
}

// ───────── 땅 안개 ─────────

/** 땅 위에 낮게 깔려 천천히 흘러가는 안개 (여러 겹의 반투명 판) */
function GroundMist({ color, amount }: { color: string; amount: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { time: { value: 0 }, color: { value: new THREE.Color(color) }, amount: { value: amount }, layer: { value: 0 } },
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
          varying vec2 vWorld;
          // 값 노이즈: 부드럽게 이어지는 무작위 무늬
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
            vec2 p = vWorld * 0.09 + vec2(time * 0.025, time * 0.012);
            float cloud = smoothstep(0.35, 0.85, fbm(p));
            // 마을 가운데는 옅게, 바깥쪽(숲)으로 갈수록 진하게
            float edge = smoothstep(6.0, 22.0, length(vWorld));
            gl_FragColor = vec4(color, cloud * (0.12 + 0.3 * edge) * amount);
            #include <colorspace_fragment>
          }
        `,
      }),
    [color, amount],
  )
  useFrame(({ clock }) => {
    material.uniforms.time.value = clock.elapsedTime
  })
  return (
    <group>
      {[0.25, 0.75, 1.4].map((y, i) => (
        <mesh key={y} position={[i * 7, y, i * -5]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
          <circleGeometry args={[70, 48]} />
        </mesh>
      ))}
    </group>
  )
}

// ───────── 떠다니는 빛 알갱이 ─────────

/** 노을빛 속에 반딧불처럼 천천히 떠오르는 금빛 알갱이 */
function Motes() {
  const geometry = useMemo(() => {
    const rand = seeded(33)
    const count = 180
    const positions = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2
      const radius = Math.sqrt(rand()) * 13
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = rand()
      positions[i * 3 + 2] = Math.sin(angle) * radius
      phase[i] = rand()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('phase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [])

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
  )
  return <points geometry={geometry} material={material} />
}

// ───────── 굴뚝 연기 ─────────

const SMOKE_COUNT = 26

/** 굴뚝에서 피어오르는 연기. amount: 진하기, color: 연기 색 (노을빛을 받으면 따뜻한 회색) */
export function Smoke({ position, amount, color }: { position: [number, number, number]; amount: number; color: string }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(SMOKE_COUNT * 3)
    const phase = new Float32Array(SMOKE_COUNT)
    for (let i = 0; i < SMOKE_COUNT; i++) phase[i] = i / SMOKE_COUNT
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('phase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [])

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
  )
  // frustumCulled={false}: 모든 알갱이가 한 점에서 시작해서, 화면 밖이라고 잘못 판단해 숨기지 않게 합니다
  return <points position={position} geometry={geometry} material={material} frustumCulled={false} />
}

// ───────── 전체 묶음 ─────────

/** 분위기에 맞는 하늘·빛·날씨를 한꺼번에 깔아 줍니다 */
export function Atmosphere({ mood, fogColor }: { mood: Mood; fogColor: string }) {
  return (
    <>
      <GradientSky sky={mood.sky} />
      <Lighting mood={mood} />
      <Snowfall count={mood.snowfall} />
      {mood.sparkle && <Sparkle />}
      {mood.mist > 0 && <GroundMist color={fogColor} amount={mood.mist} />}
      {mood.motes && <Motes />}
    </>
  )
}
