// 80% 단계 "오너먼트 업그레이드"의 모양을 코드로 만드는 곳입니다. (11.28 도안: 이원효, 교체 방식)
//
// 무엇이 바뀌나요? 80%가 되면 트리의 같은 자리에 걸린 장식이 더 화려한 모양으로 "교체"됩니다.
//  - 빨간 방울 → 무늬 방울 3종 (금 줄무늬 / 크림 소용돌이 / 금 마름모)
//  - 초록 방울 → 샴페인 금색 무늬 방울 3종
//  - 노란 종 → 빨간 리본을 단 금색 종 (가운데 하나는 둥근 방울 종)
//  - 지팡이 사탕 → 두 개를 엇갈려 리본으로 묶은 지팡이
//  - 눈송이 → 두 겹으로 겹친 얼음 결정 눈꽃
//  - 쿠키 → 옷을 입은 쿠키 3종 (산타 / 소녀 / 겨울옷)
//  - 양말은 도안이 없어 그대로 둡니다
//
// ⚡ 왜 모델 파일이 아니라 코드로 만드나요? (렌더링 부담을 줄이기 위해)
//  - 내려받을 파일이 없습니다 (첫 화면이 늦어지지 않음)
//  - 장식 하나를 "한 덩어리 모양 + 모두가 같이 쓰는 재질 하나"로 만들어, 장식 하나당 한 번만 그립니다.
//    색은 그림 파일 대신 꼭짓점마다 적어 둡니다(vertexColors).
//  - 오너먼트는 화면에서 아주 작게 보이므로, 사진처럼 세밀한 조각 대신 실루엣과 색으로 차이를 냅니다.
//
// 좌표 약속: 끈이 묶이는 꼭대기가 (0, 0, 0)이고 아래(-y)로 늘어집니다. +z가 트리 바깥(보는 사람 쪽)입니다.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** 업그레이드 모양이 있는 장식 종류 */
export type UpgradeKind =
  | "red_bauble"
  | "green_bauble"
  | "yellow_bell"
  | "candy_cane"
  | "snowflake"
  | "cookie";

const UPGRADE_KINDS: readonly string[] = [
  "red_bauble",
  "green_bauble",
  "yellow_bell",
  "candy_cane",
  "snowflake",
  "cookie",
];

/** 이 종류에 업그레이드 모양이 있는지 (양말처럼 없는 종류는 원래 모델을 그대로 씁니다) */
export function hasUpgrade(kind: string): kind is UpgradeKind {
  return UPGRADE_KINDS.includes(kind);
}

type ColorAt = (p: THREE.Vector3) => THREE.ColorRepresentation;

/** 위치·회전·크기를 한 번에 담은 변환 행렬 */
function mat(
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] | number = 1,
): THREE.Matrix4 {
  const s =
    typeof scale === "number"
      ? new THREE.Vector3(scale, scale, scale)
      : new THREE.Vector3(...scale);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    s,
  );
}

/**
 * 부품 하나를 "색이 칠해진 조각"으로 만듭니다.
 * @param color 한 가지 색이거나, 면의 위치를 받아 색을 정하는 함수(줄무늬·소용돌이 무늬용). 위치는 옮기기 전 기준입니다
 * @param matrix 조각을 놓을 위치·회전·크기
 */
function piece(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation | ColorAt,
  matrix?: THREE.Matrix4,
): THREE.BufferGeometry {
  // 면마다 색을 또렷하게 나누려고, 꼭짓점을 면끼리 공유하지 않는 모양으로 풉니다
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute("uv");
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    if (typeof color === "function") {
      // 삼각형의 가운데 점으로 색을 정합니다
      center.set(0, 0, 0);
      for (let k = 0; k < 3; k++) center.add(v.fromBufferAttribute(pos, i + k));
      c.set(color(center.multiplyScalar(1 / 3)));
    } else {
      c.set(color);
    }
    for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (matrix) g.applyMatrix4(matrix);
  return g;
}

/** 0~1 사이로 되풀이되는 값 (무늬를 반복시킬 때 씁니다) */
const frac = (x: number) => x - Math.floor(x);

// ───────── 리본 (종·지팡이·쿠키가 함께 씁니다) ─────────

/** 리본 매듭: 고리 두 개 + 가운데 매듭 + 늘어진 끈 두 가닥 */
function bow(
  color: THREE.ColorRepresentation,
  at: THREE.Matrix4,
  knot: THREE.ColorRepresentation = color,
): THREE.BufferGeometry[] {
  const put = (local: THREE.Matrix4) => at.clone().multiply(local);
  return [
    piece(
      new THREE.TorusGeometry(0.1, 0.036, 6, 14),
      color,
      put(mat([-0.115, 0.01, 0], [0, 0, 0.35], [1, 0.72, 0.6])),
    ),
    piece(
      new THREE.TorusGeometry(0.1, 0.036, 6, 14),
      color,
      put(mat([0.115, 0.01, 0], [0, 0, -0.35], [1, 0.72, 0.6])),
    ),
    piece(new THREE.SphereGeometry(0.055, 8, 6), knot, put(mat([0, 0, 0.01]))),
    piece(
      new THREE.BoxGeometry(0.065, 0.22, 0.02),
      color,
      put(mat([-0.07, -0.13, 0], [0, 0, -0.38])),
    ),
    piece(
      new THREE.BoxGeometry(0.065, 0.22, 0.02),
      color,
      put(mat([0.07, -0.13, 0], [0, 0, 0.38])),
    ),
  ];
}

// ───────── 무늬 방울 ─────────

type Pattern = "stripes" | "swirl" | "lattice";

/** 공 표면의 한 점이 어느 색인지 정하는 무늬 함수 */
function patternColor(
  pattern: Pattern,
  a: THREE.ColorRepresentation,
  b: THREE.ColorRepresentation,
  r: number,
): ColorAt {
  return (p) => {
    // lat: 아래(-1)~위(1), turn: 둘레를 한 바퀴 도는 동안 0~1
    const lat = p.y / r;
    const turn = Math.atan2(p.z, p.x) / (Math.PI * 2) + 0.5;
    if (pattern === "stripes")
      return Math.floor((lat + 1) * 4.5) % 2 === 0 ? a : b;
    if (pattern === "swirl") return frac(turn * 6 + lat * 1.4) < 0.5 ? a : b;
    // 마름모: 서로 엇갈린 두 방향의 줄을 겹쳐 체크무늬를 만듭니다
    const u = turn * 10;
    const w = lat * 4;
    return (Math.floor(u + w) + Math.floor(u - w)) % 2 === 0 ? a : b;
  };
}

const GOLD = "#e3b23c";
const GOLD_LIGHT = "#f5d77a";

function bauble(
  radius: number,
  pattern: Pattern,
  a: string,
  b: string,
): THREE.BufferGeometry {
  const capHeight = 0.09;
  return mergeGeometries([
    // 꼭지(금색 마개)
    piece(
      new THREE.CylinderGeometry(radius * 0.2, radius * 0.24, capHeight, 10),
      GOLD,
      mat([0, -capHeight / 2, 0]),
    ),
    // 공: 무늬가 깨지지 않을 만큼만 촘촘하게
    piece(
      new THREE.SphereGeometry(radius, 30, 18),
      patternColor(pattern, a, b, radius),
      mat([0, -capHeight + 0.02 - radius, 0]),
    ),
  ]);
}

const RED_BAUBLES: [Pattern, string, string][] = [
  ["stripes", "#c62828", GOLD_LIGHT],
  ["swirl", "#c9302c", "#f7eeda"],
  ["lattice", "#a61b20", GOLD],
];
// 도안의 샴페인(연한 금) 방울. 초록 방울 자리에 겁니다
const CHAMPAGNE_BAUBLES: [Pattern, string, string][] = [
  ["lattice", "#e9d7a6", "#c7a65c"],
  ["stripes", "#f1e2bb", "#d0b06a"],
  ["swirl", "#e6cf93", "#fff8e6"],
];

// ───────── 리본 종 ─────────

const BELL_GOLD = "#e8b530";
const RIBBON_RED = "#d32f2f";

/** 옆모습 선을 한 바퀴 돌려 만든 종 + 빨간 리본 */
function classicBell(): THREE.BufferGeometry {
  // (반지름, 높이) 점들을 이은 종의 옆모습
  const profile = [
    [0.02, -0.02],
    [0.12, -0.04],
    [0.19, -0.14],
    [0.23, -0.36],
    [0.29, -0.56],
    [0.41, -0.7],
    [0.46, -0.76],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return mergeGeometries([
    // 아래 테두리 쪽은 조금 더 밝은 금색으로 (빛을 받은 느낌을 색으로 흉내)
    piece(new THREE.LatheGeometry(profile, 20), (p) =>
      p.y < -0.62 ? GOLD_LIGHT : BELL_GOLD,
    ),
    // 종 안쪽이 뚫려 보이지 않게 막는 어두운 바닥과 추
    piece(
      new THREE.CircleGeometry(0.43, 16),
      "#9a6f14",
      mat([0, -0.73, 0], [Math.PI / 2, 0, 0]),
    ),
    piece(new THREE.SphereGeometry(0.08, 8, 6), "#b98a1c", mat([0, -0.78, 0])),
    ...bow(RIBBON_RED, mat([0, -0.07, 0.13], [0, 0, 0], 1.25)),
  ]);
}

/** 둥근 방울 종(징글벨) + 빨간 리본 */
function jingleBell(): THREE.BufferGeometry {
  const r = 0.36;
  return mergeGeometries([
    piece(
      new THREE.SphereGeometry(r, 20, 14),
      (p) => (p.y > 0.05 && p.y < 0.12 ? GOLD_LIGHT : BELL_GOLD),
      mat([0, -0.1 - r, 0]),
    ),
    // 아래쪽의 길쭉한 소리 구멍
    piece(
      new THREE.BoxGeometry(0.34, 0.05, 0.05),
      "#6b4a0c",
      mat([0, -0.1 - r * 1.86, r * 0.42], [0.9, 0, 0]),
    ),
    piece(
      new THREE.SphereGeometry(0.05, 6, 5),
      "#6b4a0c",
      mat([0, -0.1 - r * 1.6, r * 0.78]),
    ),
    ...bow(RIBBON_RED, mat([0, -0.1, 0.1], [0, 0, 0], 1.3)),
  ]);
}

// ───────── 리본으로 묶은 지팡이 사탕 ─────────

/** 지팡이 한 자루: 꼭대기가 y=0, 아래로 1.2 길이. 갈고리는 +x 쪽으로 휩니다 */
function cane(stripe: string): THREE.BufferGeometry {
  const hook = 0.15;
  const points: THREE.Vector3[] = [
    new THREE.Vector3(0, -1.2, 0),
    new THREE.Vector3(0, -0.6, 0),
    new THREE.Vector3(0, -hook, 0),
  ];
  // 갈고리: 반원을 따라 점을 찍습니다
  for (let i = 1; i <= 6; i++) {
    const a = Math.PI - (i / 6) * Math.PI;
    points.push(
      new THREE.Vector3(
        hook + Math.cos(a) * hook,
        -hook + Math.sin(a) * hook,
        0,
      ),
    );
  }
  points.push(new THREE.Vector3(hook * 2, -hook - 0.12, 0));
  const curve = new THREE.CatmullRomCurve3(points);
  // 비스듬한 줄무늬: 높이와 좌우 위치를 섞어 색을 번갈아 칠합니다
  return piece(new THREE.TubeGeometry(curve, 36, 0.062, 7), (p) =>
    frac((p.y + p.x * 0.7) * 4.2) < 0.5 ? stripe : "#fdfdfd",
  );
}

function candyCanePair(
  first: string,
  second: string,
  ribbon: string,
): THREE.BufferGeometry {
  // 두 자루를 가운데(높이 -0.62)에서 엇갈리게 돌립니다
  const pivot = (angle: number, flip: boolean, z: number) =>
    mat([0, -0.62, z])
      .multiply(mat([0, 0, 0], [0, flip ? Math.PI : 0, angle]))
      .multiply(mat([0, 0.62, 0]));
  const a = cane(first).applyMatrix4(pivot(0.42, false, -0.045));
  const b = cane(second).applyMatrix4(pivot(0.42, true, 0.045));
  return mergeGeometries([
    a,
    b,
    ...bow(ribbon, mat([0, -0.62, 0.12], [0, 0, 0], 1.35), "#f7eeda"),
  ]);
}

// ───────── 얼음 결정 눈꽃 ─────────

const ICE = {
  arm: "#bfe6ff",
  branch: "#f2fbff",
  tip: "#79d2ff",
  inner: "#e4f0f8",
  core: "#ffffff",
};

/**
 * 두 겹 눈꽃: 긴 가지 6개(곁가지 + 끝의 보석) 뒤에, 30도 돌린 짧은 가지 6개를 한 겹 더 겹칩니다.
 * 도안의 투명한 크리스털은 휴대폰에서 무거운 재질이라, 겹친 모양과 얼음색으로 입체감을 냅니다.
 * @param variant 0~2. 가지 끝 모양과 색을 조금씩 달리합니다
 */
function iceSnowflake(variant: number): THREE.BufferGeometry {
  const cy = -0.66;
  const pieces: THREE.BufferGeometry[] = [];
  const tipColor = [ICE.tip, "#a8c8ff", "#8fe3e8"][variant % 3];
  for (let k = 0; k < 6; k++) {
    const spin = mat([0, cy, 0], [0, 0, (k * Math.PI) / 3]);
    const put = (local: THREE.Matrix4) => spin.clone().multiply(local);
    // 긴 가지
    pieces.push(
      piece(
        new THREE.BoxGeometry(0.07, 0.56, 0.055),
        ICE.arm,
        put(mat([0, 0.28, 0])),
      ),
    );
    // 곁가지 두 쌍 (안쪽은 길게, 바깥쪽은 짧게)
    for (const [h, len] of [
      [0.24, 0.2],
      [0.4, 0.13],
    ]) {
      for (const side of [-1, 1]) {
        pieces.push(
          piece(
            new THREE.BoxGeometry(0.05, len, 0.045),
            ICE.branch,
            put(
              mat([side * len * 0.4, h + len * 0.3, 0], [0, 0, -side * 0.95]),
            ),
          ),
        );
      }
    }
    // 가지 끝의 보석 (팔면체)
    pieces.push(
      piece(
        new THREE.OctahedronGeometry(0.075),
        tipColor,
        put(mat([0, 0.6, 0], [0, 0, 0], [1, 1.35, 0.8])),
      ),
    );
    // 뒤 겹: 30도 돌린 짧은 가지
    const back = mat([0, cy, -0.05], [0, 0, (k * Math.PI) / 3 + Math.PI / 6]);
    pieces.push(
      piece(
        new THREE.BoxGeometry(0.06, 0.3, 0.04),
        ICE.inner,
        back.clone().multiply(mat([0, 0.17, 0])),
      ),
    );
    pieces.push(
      piece(
        new THREE.OctahedronGeometry(0.05),
        ICE.branch,
        back.clone().multiply(mat([0, 0.34, 0])),
      ),
    );
  }
  // 가운데: 고리와 보석
  pieces.push(
    piece(
      new THREE.TorusGeometry(0.17, 0.025, 5, 18),
      ICE.branch,
      mat([0, cy, 0.01]),
    ),
  );
  pieces.push(
    piece(
      new THREE.OctahedronGeometry(0.11),
      ICE.core,
      mat([0, cy, 0.02], [0, 0, 0], [1, 1, 0.7]),
    ),
  );
  // 끈을 거는 고리
  pieces.push(
    piece(
      new THREE.TorusGeometry(0.035, 0.012, 4, 10),
      "#dfe9f0",
      mat([0, -0.03, 0]),
    ),
  );
  return mergeGeometries(pieces);
}

// ───────── 옷 입은 쿠키 ─────────

const COOKIE = {
  dough: "#c98a4b",
  dark: "#3a2414",
  icing: "#fffaf0",
  red: "#d32f2f",
  green: "#2e7d32",
  pink: "#f48fb1",
  blue: "#8fd3e8",
};
/** 쿠키 두께 */
const DEPTH = 0.1;
/** 쿠키 앞면(얼굴·옷을 붙이는 면)의 z */
const FRONT = DEPTH / 2;

/** 납작한 원판 (쿠키의 머리·몸통·단추) */
function disc(
  r: number,
  color: THREE.ColorRepresentation,
  x: number,
  y: number,
  z = 0,
  depth = DEPTH,
  sx = 1,
  sy = 1,
): THREE.BufferGeometry {
  return piece(
    new THREE.CylinderGeometry(r, r, depth, 18),
    color,
    mat([x, y, z], [Math.PI / 2, 0, 0], [sx, 1, sy]),
  );
}

/** 납작한 알약 모양 (팔·다리·아이싱 줄) */
function limb(
  r: number,
  len: number,
  color: THREE.ColorRepresentation,
  x: number,
  y: number,
  angle: number,
  z = 0,
  flat = 0.62,
): THREE.BufferGeometry {
  return piece(
    new THREE.CapsuleGeometry(r, len, 3, 8),
    color,
    mat([x, y, z], [0, 0, angle], [1, 1, flat]),
  );
}

/** 옷을 입히기 전의 쿠키 몸 (얼굴과 손목·발목의 아이싱 포함). 머리 가운데가 (0, headY)입니다 */
function cookieBody(headY: number): THREE.BufferGeometry[] {
  const y = (dy: number) => headY + dy;
  const face = FRONT + 0.012;
  return [
    disc(0.21, COOKIE.dough, 0, y(0)),
    disc(0.24, COOKIE.dough, 0, y(-0.4), 0, DEPTH, 0.92, 1.2),
    limb(0.078, 0.2, COOKIE.dough, -0.27, y(-0.3), -1.05),
    limb(0.078, 0.2, COOKIE.dough, 0.27, y(-0.3), 1.05),
    limb(0.085, 0.2, COOKIE.dough, -0.12, y(-0.76), -0.16),
    limb(0.085, 0.2, COOKIE.dough, 0.12, y(-0.76), 0.16),
    // 눈, 웃는 입(반원 고리)
    piece(
      new THREE.SphereGeometry(0.026, 6, 5),
      COOKIE.dark,
      mat([-0.075, y(0.04), face]),
    ),
    piece(
      new THREE.SphereGeometry(0.026, 6, 5),
      COOKIE.dark,
      mat([0.075, y(0.04), face]),
    ),
    piece(
      new THREE.TorusGeometry(0.07, 0.013, 4, 10, Math.PI),
      COOKIE.icing,
      mat([0, y(-0.03), face], [0, 0, Math.PI]),
    ),
    // 손목·발목의 흰 아이싱
    limb(0.02, 0.1, COOKIE.icing, -0.33, y(-0.26), 0.55, face, 0.5),
    limb(0.02, 0.1, COOKIE.icing, 0.33, y(-0.26), -0.55, face, 0.5),
    limb(0.02, 0.12, COOKIE.icing, -0.135, y(-0.88), Math.PI / 2, face, 0.5),
    limb(0.02, 0.12, COOKIE.icing, 0.135, y(-0.88), Math.PI / 2, face, 0.5),
  ];
}

/** 고깔모자: 납작한 원뿔 + 흰 테두리 + 방울 */
function hat(
  color: string,
  headY: number,
  tilt: number,
): THREE.BufferGeometry[] {
  const base = mat([0, headY + 0.15, 0], [0, 0, tilt]);
  const put = (local: THREE.Matrix4) => base.clone().multiply(local);
  return [
    piece(
      new THREE.ConeGeometry(0.2, 0.3, 14),
      color,
      put(mat([0, 0.16, 0], [0, 0, 0], [1, 1, 0.55])),
    ),
    limb(0.045, 0.34, COOKIE.icing, 0, 0, Math.PI / 2, 0.02, 0.9).applyMatrix4(
      base,
    ),
    piece(
      new THREE.SphereGeometry(0.06, 8, 6),
      COOKIE.icing,
      put(mat([0, 0.33, 0])),
    ),
  ];
}

/** 산타 쿠키: 빨간 모자 + 초록 나비넥타이 + 빨간 단추 */
function santaCookie(): THREE.BufferGeometry {
  const head = -0.42;
  const front = FRONT + 0.02;
  return mergeGeometries([
    ...cookieBody(head),
    ...hat(COOKIE.red, head, -0.22),
    ...bow(COOKIE.green, mat([0, head - 0.2, front + 0.02], [0, 0, 0], 0.62)),
    disc(0.035, COOKIE.red, 0, head - 0.4, front, 0.03),
    disc(0.035, COOKIE.red, 0, head - 0.52, front, 0.03),
  ]);
}

/** 소녀 쿠키: 머리 리본 + 분홍 치마 + 볼 터치 */
function girlCookie(): THREE.BufferGeometry {
  const head = -0.3;
  const front = FRONT + 0.02;
  return mergeGeometries([
    ...cookieBody(head),
    ...bow(
      COOKIE.pink,
      mat([0.02, head + 0.2, front], [0, 0, -0.1], 0.85),
      COOKIE.icing,
    ),
    // 치마: 아래로 퍼지는 납작한 원뿔대 + 흰 밑단
    piece(
      new THREE.CylinderGeometry(0.17, 0.33, 0.24, 14),
      COOKIE.pink,
      mat([0, head - 0.56, 0.01], [0, 0, 0], [1, 1, 0.42]),
    ),
    limb(
      0.028,
      0.5,
      COOKIE.icing,
      0,
      head - 0.68,
      Math.PI / 2,
      front + 0.02,
      0.6,
    ),
    disc(0.03, COOKIE.icing, 0, head - 0.34, front, 0.03),
    // 볼 터치
    disc(0.032, COOKIE.pink, -0.13, head - 0.02, FRONT + 0.006, 0.012),
    disc(0.032, COOKIE.pink, 0.13, head - 0.02, FRONT + 0.006, 0.012),
  ]);
}

/** 겨울옷 쿠키: 하늘색 털모자 + 흰 목도리 + 까만 단추 */
function winterCookie(): THREE.BufferGeometry {
  const head = -0.42;
  const front = FRONT + 0.02;
  return mergeGeometries([
    ...cookieBody(head),
    ...hat(COOKIE.blue, head, 0.18),
    // 목도리: 목을 두른 띠 + 옆으로 늘어진 자락 (끝에 빨간 줄)
    limb(0.05, 0.3, COOKIE.icing, 0, head - 0.2, Math.PI / 2, front, 0.8),
    limb(0.045, 0.16, COOKIE.icing, 0.12, head - 0.32, 0.25, front + 0.01, 0.7),
    limb(0.047, 0.01, COOKIE.red, 0.142, head - 0.4, 0.25, front + 0.015, 0.7),
    disc(0.03, COOKIE.dark, -0.02, head - 0.46, front, 0.03),
    disc(0.03, COOKIE.dark, -0.02, head - 0.58, front, 0.03),
  ]);
}

// ───────── 꺼내 쓰기 ─────────

function build(kind: UpgradeKind, variant: number): THREE.BufferGeometry {
  if (kind === "red_bauble") return bauble(0.48, ...RED_BAUBLES[variant]);
  if (kind === "green_bauble")
    return bauble(0.37, ...CHAMPAGNE_BAUBLES[variant]);
  if (kind === "yellow_bell")
    return variant === 1 ? jingleBell() : classicBell();
  if (kind === "candy_cane") {
    return variant === 1
      ? candyCanePair(COOKIE.green, COOKIE.red, RIBBON_RED)
      : candyCanePair(COOKIE.red, COOKIE.red, COOKIE.green);
  }
  if (kind === "snowflake") return iceSnowflake(variant);
  return [santaCookie, girlCookie, winterCookie][variant]();
}

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * 업그레이드 장식의 모양을 돌려줍니다. 같은 모양은 한 번만 만들어 두고 다시 씁니다.
 * @param index 같은 종류 안에서의 순번 (0·1·2가 서로 다른 모양)
 */
export function upgradedGeometry(
  kind: UpgradeKind,
  index: number,
): THREE.BufferGeometry {
  const variant = ((index % 3) + 3) % 3;
  const key = `${kind}-${variant}`;
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = build(kind, variant);
    cache.set(key, geometry);
  }
  return geometry;
}

let sharedMaterial: THREE.MeshStandardMaterial | null = null;

/**
 * 모든 업그레이드 장식이 함께 쓰는 재질 하나.
 * 밤에는 emissiveIntensity를 올려 "자기 색으로" 은은하게 빛나게 합니다 (진짜 조명을 쓰지 않는 가짜 빛).
 */
export function upgradedMaterial(): THREE.MeshStandardMaterial {
  if (!sharedMaterial) {
    sharedMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0,
      // 종 안쪽이나 납작하게 누른 부품의 뒷면도 보이게
      side: THREE.DoubleSide,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0,
    });
    // 빛나는 색 × 꼭짓점 색: 흰색으로 뜨지 않고 빨간 방울은 빨갛게, 종은 금색으로 빛납니다 (GiantTree의 잎과 같은 방법)
    sharedMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;",
      );
    };
  }
  return sharedMaterial;
}
