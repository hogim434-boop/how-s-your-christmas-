"use client";

// 장식 단계가 올라갈 때 "새로 생긴 장식"이 직접 등장하는 연출을 맡는 도구들입니다. (11.28 사용자 요청)
//
// 왜 이렇게 하나요? 트리 둘레를 도는 이펙트(이전 시안)는 "무엇이 새로 생겼는지"를 알려 주지 못했고,
// 집에 생긴 장식인데 트리에서 이펙트가 나와 어긋났습니다. 그래서 새 장식이 생기는 바로 그 자리에서 연출합니다.
//
//  - PopIn: 새 장식 하나가 "톡" 하고 커지며 나타나고, 그 자리에서 반짝임이 터집니다
//  - useInstancedReveal: 한 번에 그리는 장식(전구 줄·집 장식)이 하나씩 차례로 나타납니다
//  - RevealSparkles: 반짝임을 그리는 곳. 점 한 덩어리로 한 번에 그리고, 터지는 동안에만 그립니다 (진짜 조명 없음)
//
// 💡 처음 마을에 들어왔을 때나 단계가 내려갈 때는 연출하지 않습니다. 단계가 "올라간 그 순간"에 새로 생긴 것만 연출합니다.

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { useNight } from "./nightContext";
import { softDot } from "./particles";

/** 방금 올라간 단계 구간: from 다음 단계부터 to 단계까지가 "새로 생긴 장식"입니다. 올라간 적이 없으면 null */
export type Reveal = { from: number; to: number } | null;
export const RevealContext = createContext<Reveal>(null);

/**
 * 이 장식이 "방금 새로 생긴 것"인지. 처음 그려질 때 한 번만 정합니다.
 * @param stage 이 장식이 생기는 단계 (1~10)
 */
export function useReveal(stage: number): boolean {
  const reveal = useContext(RevealContext);
  const [animate] = useState(() => reveal !== null && stage > reveal.from && stage <= reveal.to);
  return animate;
}

/** 톡 튀어나오는 크기 변화: 0에서 시작해 살짝 넘쳤다가(약 1.1배) 1로 돌아옵니다. t는 0~1 */
export function popScale(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

/** 나타나는 데 걸리는 시간(초) */
const POP_SECONDS = 0.45;
const now = () => performance.now() / 1000;

// ───────── 반짝임 ─────────

/** 반짝임 한 번에 쓰는 점 수 / 동시에 터질 수 있는 최대 횟수 / 한 번의 길이(초) */
const SPARK = { perBurst: 8, maxBursts: 72, seconds: 0.7 };
type Burst = { x: number; y: number; z: number; size: number; start: number };
const bursts: Burst[] = [];

/** 이 자리에서 반짝임을 한 번 터뜨립니다. size: 퍼지는 반지름 */
export function emitSparkle(position: THREE.Vector3, size = 0.9) {
  if (bursts.length >= SPARK.maxBursts) bursts.shift();
  bursts.push({ x: position.x, y: position.y, z: position.z, size, start: now() });
}

const SPARK_VERTEX = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // 멀수록 작게 (화면 세로 크기에 맞춰 어느 기기에서나 같은 크기)
    gl_PointSize = aSize * uScale / -mv.z;
  }
`;
const SPARK_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vAlpha;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * uIntensity, a);
  }
`;

/** 점마다 퍼져 나갈 방향 (고정된 값이라 새로고침해도 같은 모양) */
const SPARK_DIRS = Array.from({ length: SPARK.perBurst }, (_, i) => {
  const a = (i / SPARK.perBurst) * Math.PI * 2 + 0.4;
  const up = 0.25 + 0.5 * ((i * 7) % 5) / 4;
  return new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize();
});

function drawSparkles(geometry: THREE.BufferGeometry): number {
  const t = now();
  // 끝난 반짝임은 목록에서 뺍니다
  while (bursts.length > 0 && t - bursts[0].start > SPARK.seconds) bursts.shift();
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const alpha = geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
  const size = geometry.getAttribute("aSize") as THREE.BufferAttribute;
  let n = 0;
  for (const b of bursts) {
    const p = Math.min(1, Math.max(0, (t - b.start) / SPARK.seconds));
    // 처음엔 빠르게 퍼지다 느려지고, 서서히 사라집니다
    const spread = b.size * (1 - (1 - p) ** 3);
    for (let i = 0; i < SPARK.perBurst; i++) {
      const d = SPARK_DIRS[i];
      pos.setXYZ(n, b.x + d.x * spread, b.y + d.y * spread - p * p * 0.25, b.z + d.z * spread);
      alpha.setX(n, (1 - p) ** 1.5);
      size.setX(n, (0.34 + (i % 3) * 0.1) * (1 - p * 0.5));
      n++;
    }
  }
  pos.needsUpdate = true;
  alpha.needsUpdate = true;
  size.needsUpdate = true;
  geometry.setDrawRange(0, n);
  return n;
}

function setScale(material: THREE.ShaderMaterial, scale: number) {
  material.uniforms.uScale.value = scale;
}

/** 반짝임을 그리는 곳. 장면에 하나만 둡니다. 터지는 것이 없으면 아무것도 그리지 않습니다 */
export function RevealSparkles() {
  const night = useNight();
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const count = SPARK.perBurst * SPARK.maxBursts;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(
    () => ({ uMap: { value: softDot() }, uColor: { value: new THREE.Color("#ffe29a") }, uIntensity: { value: 1 }, uScale: { value: 400 } }),
    [],
  );
  useFrame(({ size, viewport }) => {
    const mesh = points.current;
    if (!mesh) return;
    if (bursts.length === 0) {
      mesh.visible = false;
      return;
    }
    if (material.current) setScale(material.current, (size.height * viewport.dpr) / 2);
    mesh.visible = drawSparkles(geometry) > 0;
  });
  return (
    <points ref={points} geometry={geometry} frustumCulled={false} visible={false}>
      <shaderMaterial
        // 밤/아침이 바뀌면 재질을 새로 만듭니다 (섞는 방식이 달라서)
        key={night ? "night" : "day"}
        ref={material}
        vertexShader={SPARK_VERTEX}
        fragmentShader={SPARK_FRAGMENT}
        uniforms={uniforms}
        // 밤: 1보다 밝은 색 → 빛 번짐 효과가 퍼뜨려 불빛처럼 보입니다 / 아침: 눈밭에 묻히지 않게 진한 금색
        uniforms-uIntensity-value={night ? 2.6 : 1}
        uniforms-uColor-value={night ? "#ffe29a" : "#f2a900"}
        transparent
        depthWrite={false}
        blending={night ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  );
}

// ───────── 깜빡임 (진행률 게이지에서 달성한 단계를 눌렀을 때, F008) ─────────
// 💡 "몇 단계를 언제부터 깜빡이는지"만 적어 두는 작은 저장소입니다. React 상태가 아니라서 화면을 다시 그리지 않고,
//    장식들이 매 장면마다 "내 차례인가?"만 확인합니다. 쉬는 동안의 비용은 그 비교 한 번뿐입니다.

/** 깜빡이는 시간(초) / 커졌다 돌아오는 횟수 / 가장 커졌을 때 늘어나는 비율 */
const BLINK = { seconds: 1.6, pulses: 2, grow: 0.28 };
let blink: { stage: number; start: number } | null = null;

/** 이 단계의 장식을 지금부터 깜빡이게 합니다 */
export function blinkStage(stage: number) {
  blink = { stage, start: now() };
}

/**
 * 지금 이 장식이 깜빡일 차례면 크기 배율(1 ~ 1.28)을, 아니면 null을 돌려줍니다.
 * @param stages 이 장식이 반응하는 단계 (하나 또는 여러 개)
 */
export function blinkScale(stages: number | readonly number[]): number | null {
  if (!blink) return null;
  if (typeof stages === "number" ? stages !== blink.stage : !stages.includes(blink.stage)) return null;
  const p = (now() - blink.start) / BLINK.seconds;
  if (p < 0 || p >= 1) return null;
  return 1 + BLINK.grow * Math.abs(Math.sin(p * Math.PI * BLINK.pulses));
}

// ───────── 하나씩 그리는 장식: 톡 나타나기 ─────────

type PopInProps = Omit<ThreeElements["group"], "scale"> & {
  /** 이 장식이 생기는 단계 (1~10) */
  stage: number;
  /** 단계가 오른 뒤 몇 초 있다가 나타날지 (여러 개가 차례로 나오게 할 때) */
  delay?: number;
  /** 반짝임이 퍼지는 크기. 0이면 반짝임 없음 */
  sparkle?: number;
  /** 반짝임이 터질 높이 (장식의 가운데쯤. 이 그룹의 원점 기준) */
  sparkleY?: number;
  /** 게이지에서 이 단계들을 누르면 깜빡입니다 (없으면 stage 하나) */
  blinkStages?: readonly number[];
  children: ReactNode;
};

const sparkleAt = new THREE.Vector3();

/**
 * 장식 하나를 감싸는 그룹입니다.
 *  - 방금 새로 생긴 장식이면 톡 하고 커지며 나타납니다 (등장 연출)
 *  - 게이지에서 이 장식의 단계를 누르면 살짝 커졌다 돌아오며 깜빡입니다
 * 둘이 겹치지 않게, 등장 연출이 끝난 뒤에만 깜빡임을 받습니다.
 */
export function PopIn({ stage, delay = 0, sparkle = 0.9, sparkleY = 0, blinkStages, children, ...props }: PopInProps) {
  const animate = useReveal(stage);
  const group = useRef<THREE.Group>(null);
  // 등장 연출의 시작 시각 (처음 그려진 장면에서 정함). 끝났거나 연출 대상이 아니면 "done"
  const start = useRef<number | "done" | null>(animate ? null : "done");
  const sparked = useRef(false);
  const blinking = useRef(false);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (start.current !== "done") {
      if (start.current === null) start.current = now() + delay;
      const t = (now() - start.current) / POP_SECONDS;
      if (t > 0 && !sparked.current) {
        sparked.current = true;
        if (sparkle > 0) emitSparkle(g.localToWorld(sparkleAt.set(0, sparkleY, 0)), sparkle);
      }
      g.scale.setScalar(popScale(t));
      if (t >= 1) start.current = "done";
      return;
    }
    const k = blinkScale(blinkStages ?? stage);
    if (k === null) {
      // 깜빡임이 끝났으면 원래 크기로 한 번만 되돌립니다
      if (blinking.current) {
        blinking.current = false;
        g.scale.setScalar(1);
      }
      return;
    }
    if (!blinking.current) {
      blinking.current = true;
      if (sparkle > 0) emitSparkle(g.localToWorld(sparkleAt.set(0, sparkleY, 0)), sparkle);
    }
    g.scale.setScalar(k);
  });
  return (
    <group ref={group} scale={animate ? 0 : 1} {...props}>
      {children}
    </group>
  );
}

// ───────── 한 번에 그리는 장식(InstancedMesh): 차례로 나타나기 ─────────

const tmpMatrix = new THREE.Matrix4();
const tmpPoint = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

interface InstancedRevealOptions {
  /** 이 장식이 생기는 단계 */
  stage: number;
  /** i번째 조각이 몇 초 뒤에 나타날지 */
  delayOf: (index: number) => number;
  /** 조각 하나가 커지는 데 걸리는 시간(초). 전구처럼 "켜지는" 느낌이면 짧게 */
  seconds?: number;
  /** 조각이 나타날 때 반짝임을 터뜨릴지와 그 크기 (0이면 없음) */
  sparkle?: number;
  /** 게이지에서 이 단계들을 누르면 깜빡입니다 (없으면 stage 하나) */
  blinkStages?: readonly number[];
}

type RevealState = { start: number; base: THREE.Matrix4[]; sparked: boolean[] };

/** 조각들의 제자리 값(행렬)을 기억해 둡니다 */
function captureBase(mesh: THREE.InstancedMesh): RevealState {
  const base: THREE.Matrix4[] = [];
  for (let i = 0; i < mesh.count; i++) {
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(i, matrix);
    base.push(matrix);
  }
  return { start: now(), base, sparked: base.map(() => false) };
}

/**
 * 지금 시각에 맞춰 조각마다 크기를 넣습니다. 모두 다 나타났으면 true.
 * (three.js 물체를 직접 고치는 일이라, React 규칙 검사와 부딪히지 않게 컴포넌트 밖 함수로 둡니다)
 */
function stepReveal(mesh: THREE.InstancedMesh, s: RevealState, delayOf: (i: number) => number, seconds: number, sparkle: number): boolean {
  const elapsed = now() - s.start;
  let finished = true;
  for (let i = 0; i < s.base.length; i++) {
    const t = (elapsed - delayOf(i)) / seconds;
    if (t < 1) finished = false;
    if (t > 0 && !s.sparked[i]) {
      s.sparked[i] = true;
      if (sparkle > 0) {
        tmpPoint.setFromMatrixPosition(s.base[i]).applyMatrix4(mesh.matrixWorld);
        tmpPoint.y += 0.6;
        emitSparkle(tmpPoint, sparkle);
      }
    }
    const k = popScale(t);
    mesh.setMatrixAt(i, tmpMatrix.copy(s.base[i]).scale(tmpScale.set(k, k, k)));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = true;
  return finished;
}

/** 모든 조각을 "제자리 값 × 크기"로 넣습니다 (깜빡임용) */
function applyScale(mesh: THREE.InstancedMesh, base: THREE.Matrix4[], k: number) {
  for (let i = 0; i < base.length; i++) mesh.setMatrixAt(i, tmpMatrix.copy(base[i]).scale(tmpScale.set(k, k, k)));
  mesh.instanceMatrix.needsUpdate = true;
}

function hide(object: THREE.Object3D) {
  object.visible = false;
}

/** 전구처럼 작은 조각은 조금 커져서는 티가 나지 않아, 깜빡일 때 더 크게 키웁니다 */
const INSTANCED_BLINK_BOOST = 2.4;

/**
 * 한 번에 그리는 장식의 조각들을 차례로 나타나게 하고, 게이지에서 누르면 깜빡이게 합니다.
 * 💡 조각의 "제자리 값(행렬)"을 기억해 두고, 연출 동안에만 크기를 바꿔 넣습니다. 끝나면 제자리 값으로 돌려놓습니다.
 */
export function useInstancedReveal(
  mesh: RefObject<THREE.InstancedMesh | null>,
  { stage, delayOf, seconds = POP_SECONDS, sparkle = 0, blinkStages }: InstancedRevealOptions,
) {
  const animate = useReveal(stage);
  const state = useRef<RevealState | "done" | null>(animate ? null : "done");
  // 깜빡이는 동안에만 들어 있는 제자리 값
  const blinkBase = useRef<THREE.Matrix4[] | null>(null);
  const delayRef = useRef(delayOf);
  useEffect(() => {
    delayRef.current = delayOf;
  }, [delayOf]);
  // 첫 장면이 그려지기 전에는 숨겨 둡니다 (다 나타난 모습이 한순간 보였다가 사라지는 깜빡임 방지)
  useLayoutEffect(() => {
    if (animate && mesh.current && state.current === null) hide(mesh.current);
  }, [animate, mesh]);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    if (state.current !== "done") {
      if (state.current === null) state.current = captureBase(m);
      if (stepReveal(m, state.current, delayRef.current, seconds, sparkle)) state.current = "done";
      return;
    }
    const k = blinkScale(blinkStages ?? stage);
    if (k === null) {
      // 깜빡임이 끝났으면 제자리 값으로 한 번만 되돌립니다
      if (blinkBase.current) {
        applyScale(m, blinkBase.current, 1);
        blinkBase.current = null;
      }
      return;
    }
    if (!blinkBase.current) blinkBase.current = captureBase(m).base;
    applyScale(m, blinkBase.current, 1 + (k - 1) * INSTANCED_BLINK_BOOST);
  });
}
