"use client";

// 대왕별이 달리면(10단계) 트리 뒤쪽 하늘에서 계속 터지는 폭죽입니다. (11.26 사용자 요청으로 새로 만듦)
//
// 한 발이 터지는 순서 (약 3~4초)
//   ① 쏘아 올림: 트리 뒤 땅에서 불씨가 살짝 휘며 올라가고, 뒤로 짧은 꼬리가 남습니다
//   ② 번쩍: 꼭대기에서 흰 빛이 한 번 번쩍합니다 (밤에만)
//   ③ 퍼짐: 불꽃이 둥글게 퍼집니다. 처음엔 빠르고 점점 느려지며, 가운데는 희고 끝은 색이 들어갑니다
//   ④ 떨어짐: 아래로 처지며 반짝반짝 깜빡이다 사라집니다
// 모양 3가지(국화·버들·고리)와 색 조합 5가지를 돌려 쓰고, 터질 때마다 자리가 조금씩 달라집니다.
//
// 가볍게 만드는 방법
//   - 모든 폭죽의 모든 불꽃(약 2,300개의 점)을 "한 덩어리"로 묶어 한 번에 그립니다
//   - 불꽃의 움직임은 그래픽 카드가 계산합니다. 우리는 매 장면 "지금 시각" 숫자 하나만 넘겨 줍니다
//     💡 셰이더(shader): 그래픽 카드에서 돌아가는 작은 프로그램. 점 하나하나의 위치·색을 아주 빠르게 계산합니다
//   - 휴대폰에서는 쏘는 자리를 7곳 → 5곳, 불꽃·꼬리 점도 줄여 전체 점을 절반 이하로 그립니다
//   - 진짜 조명은 쓰지 않습니다. 번쩍임도 밝은 점 하나로 표현합니다 (가짜 빛)

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TREE_HEIGHT } from "@/lib/village/layout";
import { useNight } from "./nightContext";

/** 폭죽 모양 */
type ShellShape = "chrysanthemum" | "willow" | "ring";

/** 모양마다의 성질: 불꽃 수, 꼬리 길이, 퍼지는 크기, 처지는 세기, 떠 있는 시간(초) */
const SHAPES: Record<ShellShape, { heads: number; trail: number; radius: number; gravity: number; duration: number }> = {
  // 국화: 둥글게 꽉 찬 기본 모양
  chrysanthemum: { heads: 96, trail: 4, radius: 5.0, gravity: 0.8, duration: 2.1 },
  // 버들: 길게 늘어져 흘러내리는 모양
  willow: { heads: 64, trail: 5, radius: 4.2, gravity: 1.7, duration: 2.8 },
  // 고리: 가운데가 빈 원 + 안쪽의 작은 속불꽃
  ring: { heads: 88, trail: 3, radius: 4.8, gravity: 0.7, duration: 2.0 },
};

/**
 * 폭죽을 쏘는 자리 7곳 (트리 뒤쪽 = z가 음수). x·height는 터지는 위치, delay·period는 박자입니다.
 * 박자를 서로 어긋나게 해서 하늘에 늘 4발쯤 보입니다. (11.26 사용자 선택: 풍성하게)
 * x는 세로로 긴 휴대폰 화면에서도 잘리지 않게 좁게 잡았습니다.
 */
const SHELLS: { shape: ShellShape; x: number; height: number; z: number; delay: number; period: number }[] = [
  { shape: "chrysanthemum", x: -6.2, height: 2.5, z: -5, delay: 0, period: 4.3 },
  { shape: "ring", x: -3.4, height: 7, z: -7, delay: 1.7, period: 4.7 },
  { shape: "willow", x: 0.5, height: 8.5, z: -9, delay: 3.1, period: 5.3 },
  { shape: "chrysanthemum", x: 3.6, height: 6.5, z: -7, delay: 0.9, period: 4.9 },
  { shape: "ring", x: 6.4, height: 3, z: -5, delay: 2.4, period: 5.1 },
  { shape: "willow", x: -5, height: 9.5, z: -10, delay: 3.8, period: 5.9 },
  { shape: "chrysanthemum", x: 5.2, height: 10, z: -10, delay: 2.0, period: 5.6 },
];

/** 색 조합 5가지 [겉 색, 속 색]. 터질 때마다 다음 조합으로 넘어갑니다 */
const PALETTES: [string, string][] = [
  ["#ff5a5f", "#ffd166"], // 빨강 + 금
  ["#5ee08a", "#f4fff0"], // 초록 + 흰
  ["#6cb4ff", "#ff8fc7"], // 파랑 + 분홍
  ["#ffc94d", "#ff8a3d"], // 금 + 주황
  ["#b28dff", "#7ef0ff"], // 보라 + 하늘
];

/** 쏘아 올리는 불씨의 꼬리 점 개수 */
const ROCKET_POINTS = 8;
/** 점 종류 번호 (셰이더와 약속한 값) */
const KIND = { rocket: 0, spark: 1, flash: 2 } as const;

/** 항상 같은 순서의 "무작위" 숫자를 만드는 도구 (매번 같은 폭죽 모양이 나오게) */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** 휴대폰용 가벼운 폭죽: 쏘는 자리 수, 불꽃 수 비율, 꼬리에서 빼는 점 수 */
const LITE = { shells: 5, heads: 0.7, trailCut: 1 };

/**
 * 모든 폭죽의 점 정보를 한 덩어리(geometry)로 만듭니다. 한 번만 계산합니다.
 * lite = true면 휴대폰용으로 점을 절반 이하로 줄입니다.
 * 💡 휴대폰 그래픽 칩은 "반투명한 점을 여러 겹 겹쳐 칠하는 일"에 약합니다. 점 수를 줄이면 칠하는 양이 그만큼 줄어듭니다.
 */
function buildGeometry(lite: boolean): THREE.BufferGeometry {
  const dir: number[] = []; // 퍼지는 방향 (position 자리에 넣음)
  const shell: number[] = []; // [폭죽 번호, 시작 어긋남, 주기, 점 종류]
  const burst: number[] = []; // 터지는 위치
  const origin: number[] = []; // 쏘아 올리는 땅 위치
  const param: number[] = []; // [꼬리 순번, 무작위 값, 점 크기, 속 색 여부]
  const phys: number[] = []; // [퍼지는 크기, 처지는 세기, 떠 있는 시간]
  const random = seededRandom(1225);

  const shells = lite ? SHELLS.slice(0, LITE.shells) : SHELLS;
  shells.forEach((s, index) => {
    const full = SHAPES[s.shape];
    const shape = lite
      ? { ...full, heads: Math.round(full.heads * LITE.heads), trail: Math.max(2, full.trail - LITE.trailCut) }
      : full;
    const burstAt = [s.x, TREE_HEIGHT + s.height, s.z];
    // 땅에서는 터지는 자리보다 조금 안쪽에서 출발 → 바깥으로 살짝 기울어 올라갑니다
    const originAt = [s.x * 0.7, 0.5, s.z];
    const add = (d: [number, number, number], kind: number, lag: number, size: number, inner: number) => {
      dir.push(...d);
      shell.push(index, s.delay, s.period, kind);
      burst.push(...burstAt);
      origin.push(...originAt);
      param.push(lag, random(), size, inner);
      phys.push(shape.radius, shape.gravity, shape.duration);
    };

    // ① 쏘아 올리는 불씨 + 꼬리
    for (let i = 0; i < ROCKET_POINTS; i++) add([0, 0, 0], KIND.rocket, i, 0.6, 0);
    // ② 번쩍임 (큰 점 하나)
    add([0, 0, 0], KIND.flash, 0, 9, 0);

    // ③ 퍼지는 불꽃. 고리 모양은 바깥 약 3분의 2는 기울어진 원 위에, 나머지 안쪽은 작은 공 모양으로
    const ringCount = s.shape === "ring" ? Math.round(shape.heads * 0.64) : 0;
    // 고리가 기울어진 정도 (정면에서 봤을 때 타원으로 보이게)
    const tilt = 0.9;
    for (let i = 0; i < shape.heads; i++) {
      let d: [number, number, number];
      let inner = 0;
      if (i < ringCount) {
        const a = (i / ringCount) * Math.PI * 2;
        d = [Math.cos(a), Math.sin(a) * Math.cos(tilt), Math.sin(a) * Math.sin(tilt)];
      } else {
        // 황금각으로 공 표면에 고르게 퍼뜨리기 + 속도를 조금씩 다르게 (자연스러운 흩어짐)
        const n = shape.heads - ringCount;
        const k = i - ringCount;
        const y = 1 - (k / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const phi = k * 2.399963;
        const speed = s.shape === "ring" ? 0.42 : 0.82 + random() * 0.18;
        d = [Math.cos(phi) * r * speed, y * speed, Math.sin(phi) * r * speed];
        inner = s.shape === "ring" ? 1 : k % 3 === 0 ? 1 : 0;
      }
      // 불꽃마다 꼬리 점 몇 개가 조금 늦게 따라옵니다
      for (let lag = 0; lag < shape.trail; lag++) add(d, KIND.spark, lag, 0.8, inner);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(dir, 3));
  geometry.setAttribute("aShell", new THREE.Float32BufferAttribute(shell, 4));
  geometry.setAttribute("aBurst", new THREE.Float32BufferAttribute(burst, 3));
  geometry.setAttribute("aOrigin", new THREE.Float32BufferAttribute(origin, 3));
  geometry.setAttribute("aParam", new THREE.Float32BufferAttribute(param, 4));
  geometry.setAttribute("aPhys", new THREE.Float32BufferAttribute(phys, 3));
  return geometry;
}

// 점 하나하나의 위치·색·크기를 정하는 프로그램 (그래픽 카드에서 실행)
const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;      // 지금 시각(초)
  uniform float uScale;     // 화면 높이에 맞춘 점 크기 배율
  uniform float uIntensity; // 밝기 (밤에는 크게 → 빛 번짐 효과가 퍼뜨려 줌)
  uniform float uDay;       // 아침이면 1 (밝은 하늘에서 보이도록 흰빛 대신 진한 색)
  uniform vec3 uPalA[5];    // 겉 색 5가지
  uniform vec3 uPalB[5];    // 속 색 5가지
  attribute vec4 aShell;
  attribute vec3 aBurst;
  attribute vec3 aOrigin;
  attribute vec4 aParam;
  attribute vec3 aPhys;
  varying vec3 vColor;
  varying float vAlpha;

  const float LAUNCH = 0.9; // 쏘아 올리는 데 걸리는 시간(초)

  // 숫자 하나로 0~1 사이의 "무작위처럼 보이는" 값을 만듭니다
  float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

  void main() {
    float kind = aShell.w;
    float local = uTime - aShell.y;
    float cycle = floor(local / aShell.z); // 이 자리에서 몇 번째로 터지는 폭죽인지
    float t = local - cycle * aShell.z;    // 이번 폭죽이 시작된 뒤 지난 시간
    float lag = aParam.x;
    float seed = aParam.y;

    // 터질 때마다 자리와 색 조합을 조금씩 바꿉니다
    float key = aShell.x * 13.0 + cycle;
    vec3 burst = aBurst + vec3((hash(key) - 0.5) * 3.0, (hash(key + 7.0) - 0.5) * 2.4, (hash(key + 3.0) - 0.5) * 1.5);
    int pal = int(mod(aShell.x + cycle, 5.0));
    vec3 colA = uPalA[pal];
    vec3 colB = uPalB[pal];

    vec3 pos = vec3(0.0);
    vec3 col = colA;
    float alpha = 0.0;
    float size = aParam.z;

    if (local > 0.0) {
      if (kind < 0.5) {
        // ① 쏘아 올림: 처음엔 빠르고 꼭대기에서 느려집니다. 꼬리 점은 조금씩 늦게 따라옵니다
        float tt = (t - lag * 0.035) / LAUNCH;
        if (tt > 0.0 && tt < 1.0) {
          float e = 1.0 - (1.0 - tt) * (1.0 - tt);
          pos = mix(aOrigin, burst, e);
          pos.x += sin(tt * 3.14159) * (hash(key + 1.0) - 0.5); // 살짝 휘어지게
          alpha = (1.0 - lag * 0.115) * smoothstep(0.0, 0.08, tt) * (1.0 - smoothstep(0.82, 1.0, tt));
          col = mix(mix(vec3(1.0, 0.9, 0.7), colA, 0.3), colA, uDay);
          size *= 1.0 - lag * 0.08;
        }
      } else if (kind < 1.5) {
        // ③④ 퍼짐과 떨어짐
        float tb = t - LAUNCH - lag * 0.06;
        float life = tb / aPhys.z; // 0(막 터짐) ~ 1(사라짐)
        if (tb > 0.0 && life < 1.0) {
          float spread = aPhys.x * (1.0 - exp(-tb * 2.6)); // 처음엔 빠르게, 점점 느리게
          pos = burst + position * spread;
          pos.y -= aPhys.y * tb * tb;                      // 중력처럼 아래로 처짐
          // 사라지기 전에 불꽃마다 다른 박자로 깜빡입니다
          float twinkle = mix(1.0, 0.45 + 0.55 * sin(uTime * 26.0 + seed * 80.0), smoothstep(0.45, 0.8, life));
          // 아침에는 밝은 하늘에 묻히지 않게 더 오래 진하게 남깁니다
          alpha = pow(1.0 - life, mix(1.4, 0.7, uDay)) * twinkle * (1.0 - lag * 0.22);
          // 아침에는 막 터진 순간(점들이 한곳에 뭉쳐 덩어리로 보이는 때)을 살짝 가립니다
          alpha *= mix(1.0, smoothstep(0.1, 0.32, tb), uDay);
          vec3 base = mix(colA, colB, aParam.w);
          // 아침: 색을 더 짙고 선명하게 (회색기를 빼고 어둡게)
          float gray = dot(base, vec3(0.3, 0.59, 0.11));
          base = mix(base, (gray + (base - gray) * 1.6) * 0.78, uDay);
          // 막 터졌을 땐 흰빛, 곧 제 색으로 (아침에는 처음부터 제 색)
          col = mix(mix(vec3(1.0), base, smoothstep(0.0, 0.18, life)), base, uDay);
          size *= (1.0 - lag * 0.18) * mix(1.3, 0.7, life);
          // 막 터진 순간에는 점들이 한곳에 겹쳐 있으니 작게 시작해 퍼지면서 커집니다 (겹쳐 칠하는 양 줄이기)
          size *= 0.4 + 0.6 * smoothstep(0.0, 0.25, tb);
        }
      } else {
        // ② 번쩍: 아주 짧게 밝았다가 꺼집니다
        float tb = t - LAUNCH;
        if (tb > 0.0 && tb < 0.35) {
          pos = burst;
          alpha = exp(-tb * 9.0) * mix(0.9, 0.0, uDay); // 아침에는 번쩍임을 뺍니다 (밝은 하늘에선 얼룩처럼 보여서)
          col = mix(vec3(1.0), colA, mix(0.3, 0.8, uDay));
        }
      }
    }

    vColor = col * uIntensity;
    vAlpha = alpha;
    if (alpha <= 0.0) {
      // 지금 보이지 않는 점은 화면 밖으로 보내 아예 그리지 않게 합니다
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
    } else {
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = size * 0.8 * uScale / -mv.z; // 멀수록 작게
    }
  }
`;

// 점 하나를 "가운데가 밝고 둘레가 부드럽게 사라지는 동그라미"로 칠하는 프로그램
const FRAGMENT_SHADER = /* glsl */ `
  uniform float uDay;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0; // 점 가운데에서의 거리 (0 ~ 1)
    float soft = smoothstep(1.0, 0.0, d);
    float core = smoothstep(0.4, 0.0, d);
    // 밤: 가운데가 더 밝은 부드러운 빛 / 아침: 가장자리까지 색이 찬 또렷한 점
    // 점의 네모 칸을 꽉 채워 쓰도록 빛이 가장자리 가까이까지 차게 했습니다
    // (같은 크기로 보이면서 칠하는 네모는 더 작아짐 → 가벼움)
    float shape = mix(pow(soft, 1.3), smoothstep(1.0, 0.55, d), uDay);
    gl_FragColor = vec4(vColor * (1.0 + core * 0.8 * (1.0 - uDay)), shape * vAlpha);
    #include <colorspace_fragment>
  }
`;

/** 재질의 "지금 시각"과 "점 크기 배율"을 새로 넣습니다 (매 장면 호출) */
function updateUniforms(material: THREE.ShaderMaterial, time: number, scale: number) {
  material.uniforms.uTime.value = time;
  material.uniforms.uScale.value = scale;
}

export function Fireworks() {
  const night = useNight();
  const material = useRef<THREE.ShaderMaterial>(null);
  // 손가락으로 쓰는 기기(휴대폰·태블릿)면 가벼운 폭죽을 만듭니다
  const geometry = useMemo(() => buildGeometry(window.matchMedia("(pointer: coarse)").matches), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScale: { value: 400 },
      uIntensity: { value: 1 },
      uDay: { value: 0 },
      uPalA: { value: PALETTES.map(([a]) => new THREE.Color(a)) },
      uPalB: { value: PALETTES.map(([, b]) => new THREE.Color(b)) },
    }),
    [],
  );

  useFrame(({ clock, size, viewport }) => {
    // 점 크기는 "화면 세로 픽셀 수"에 비례해야 어느 기기에서나 같은 크기로 보입니다
    if (material.current) updateUniforms(material.current, clock.elapsedTime, (size.height * viewport.dpr) / 2);
  });

  return (
    // frustumCulled={false}: 점 위치를 그래픽 카드가 정하기 때문에 "화면 밖이라 생략"하는 판단을 끕니다
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        // 밤/아침이 바뀌면 재질을 새로 만듭니다 (섞는 방식이 달라서)
        key={night ? "night" : "day"}
        ref={material}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        uniforms-uIntensity-value={night ? 2.4 : 1}
        uniforms-uDay-value={night ? 0 : 1}
        transparent
        depthWrite={false}
        // 밤: 빛을 더해서 겹칠수록 밝게(불빛 느낌) / 아침: 밝은 하늘에 묻히지 않게 색을 그대로 얹기
        blending={night ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  );
}
