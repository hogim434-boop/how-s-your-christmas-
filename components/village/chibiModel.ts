// 꾸미기 캐릭터(2.2등신)를 "한 명 분"으로 만드는 곳입니다. (Task 014)
// 내 캐릭터(Player.tsx), 다른 주민(RemoteChibis.tsx), 꾸미기 창의 미리보기(CharacterPreview.tsx)가 함께 씁니다.
//
// 💡 모델 파일(chibi.glb)에는 여자·남자 머리와 모든 옷 모양이 "조각"으로 들어 있고, 조각마다 꼬리표가 붙어 있습니다.
//    (scripts/blender/make_chibi.py의 --kit이 만듭니다)
//      when  : 이 조각을 쓰는 조건. 예) "base=girl", "top=santa", "scarf=muffler;top=puffer", ""(항상)
//      color : "part:top"(고른 상의 색을 따름) 또는 "#rrggbb"(정해진 색)
//      limb  : 0 = 몸·머리, 1 = 왼팔, 2 = 오른팔, 3 = 왼다리, 4 = 오른다리
//
// 💡 캐릭터 한 명 = 그리기 1번
//    고른 옷에 맞는 조각만 골라, 색을 점마다 칠해서(vertex color) 한 덩어리로 합칩니다.
//    뼈대는 없습니다. 대신 점마다 "어느 팔다리에 속하는지"를 적어 두고,
//    그래픽 장치에서 그 팔다리만 어깨·골반을 축으로 돌립니다 (아래 셰이더 조각).
//    → 걷는 동작에 드는 계산이 숫자 4개(팔다리 각도)를 넘기는 것뿐이라, 주민이 많아도 가볍습니다.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PART_KEYS, colorField, colorHex } from "@/lib/character/parts";
import type { CharacterParts } from "@/types/domain";
import { markShowThrough } from "./showThrough";

/** 캐릭터 모델 파일 (모든 옷 모양이 들어 있는 묶음) */
export const CHIBI_MODEL_URL = "/models/handmade/chibi.glb";
/** 모델을 마을에 세울 때의 크기 배율. 모델 키가 약 0.92라서 마을에서는 키가 약 2.1이 됩니다 */
export const CHIBI_SCALE = 2.3;
/** 이름표를 띄울 높이 (머리 조금 위) */
export const CHIBI_NAME_TAG_HEIGHT = 2.55;

// 팔다리의 회전축 자리 (모델 좌표. make_chibi.py의 SHOULDER·HIP과 같은 값이고, 위쪽이 +Y·앞쪽이 +Z입니다)
const PIVOTS: Record<number, [number, number, number]> = {
  0: [0, 0, 0],
  1: [0.118, 0.425, 0], // 왼쪽 어깨
  2: [-0.118, 0.425, 0], // 오른쪽 어깨
  3: [0.068, 0.215, 0], // 왼쪽 골반
  4: [-0.068, 0.215, 0], // 오른쪽 골반
};

type Piece = {
  geometry: THREE.BufferGeometry;
  /** 이 조각을 쓰는 조건들 [무엇, 값]. 모두 맞아야 씁니다 */
  when: [string, string][];
  color: string;
  limb: number;
  /** 살(얼굴이 그려진 머리·목·손·다리)인지. 마을에서는 살색을 더 진하게 칠합니다 */
  skin: boolean;
};

/** 모델 파일 → 조각 목록. 파일마다 한 번만 읽어 둡니다 */
const pieceCache = new WeakMap<THREE.Object3D, { pieces: Piece[]; map: THREE.Texture | null }>();

function readKit(scene: THREE.Object3D) {
  let kit = pieceCache.get(scene);
  if (kit) return kit;
  const pieces: Piece[] = [];
  let map: THREE.Texture | null = null;
  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const data = mesh.userData as { when?: string; color?: string; limb?: number };
    if (typeof data.color !== "string") return;
    map ??= (mesh.material as THREE.MeshStandardMaterial).map;
    pieces.push({
      // 조각이 놓인 자리를 모양에 미리 반영해 둡니다 (보통은 제자리라 그대로입니다)
      geometry: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
      when: (data.when ?? "")
        .split(";")
        .filter(Boolean)
        .map((pair) => pair.split("=") as [string, string]),
      color: data.color,
      limb: data.limb ?? 0,
      skin: mesh.name.startsWith("HeadSkin") || data.color === MODEL_SKIN,
    });
  });
  kit = { pieces, map };
  pieceCache.set(scene, kit);
  return kit;
}

// 살색 진하게 하기 (11.29 피드백: 마을의 밝은 낮 조명에서 얼굴이 흰색처럼 보임 → 사용자 확정: 꾸미기 창은 밝게, 마을은 진하게)
// 💡 모델의 살색은 그대로 두고, 마을에서 캐릭터를 만들 때 살 조각(머리·목·손·다리)의 색에만 아래 값을 곱합니다.
//    머리는 얼굴 그림 × 칠한 색으로 그려지므로, 칠한 색에 곱하면 얼굴과 뒤통수가 똑같이 진해집니다.
/** 모델에 적힌 살색 (scripts/blender/make_chibi.py의 SKIN) */
const MODEL_SKIN = "#fde0cb";
/** 마을에서 살색에 곱하는 값 (#fde0cb가 #f5c4a1처럼 보이게 하는 비율) */
const VILLAGE_SKIN = new THREE.Color(0.93, 0.74, 0.6);

const TINT = new THREE.Color();

/** 고른 옷에 맞는 조각을 골라 색을 칠하고 한 덩어리로 합칩니다 */
function buildGeometry(pieces: Piece[], parts: CharacterParts, deepSkin: boolean): THREE.BufferGeometry {
  const chosen = parts as unknown as Record<string, string>;
  const list: THREE.BufferGeometry[] = [];
  for (const piece of pieces) {
    if (!piece.when.every(([key, value]) => chosen[key] === value)) continue;
    // 색: "part:top"이면 그 부위에 고른 색, 아니면 조각에 정해진 색
    const part = PART_KEYS.find((p) => piece.color === `part:${p}`);
    TINT.set(part ? colorHex(chosen[colorField(part)]) : piece.color);
    if (deepSkin && piece.skin) TINT.multiply(VILLAGE_SKIN);
    const source = piece.geometry;
    const count = source.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const limbs = new Float32Array(count * 4);
    const pivot = PIVOTS[piece.limb] ?? PIVOTS[0];
    for (let i = 0; i < count; i++) {
      colors.set([TINT.r, TINT.g, TINT.b], i * 3);
      limbs.set([pivot[0], pivot[1], pivot[2], piece.limb], i * 4);
    }
    // 자리·방향·그림 좌표는 원본 것을 그대로 함께 쓰고(복사하지 않음), 색과 팔다리 표시만 새로 붙입니다
    const g = new THREE.BufferGeometry();
    g.setIndex(source.index);
    g.setAttribute("position", source.attributes.position);
    g.setAttribute("normal", source.attributes.normal);
    g.setAttribute("uv", source.attributes.uv);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aLimb", new THREE.BufferAttribute(limbs, 4));
    list.push(g);
  }
  return mergeGeometries(list, false) ?? new THREE.BufferGeometry();
}

// 셰이더(그래픽 장치에서 도는 작은 프로그램)에 끼워 넣는 조각들: 팔다리에 속한 점을 회전축 둘레로 앞뒤로 돌립니다
const SWING_PARS = /* glsl */ `
attribute vec4 aLimb;
uniform vec4 uSwing;
`;
const SWING_NORMAL = /* glsl */ `
float chibiAngle = aLimb.w < 0.5 ? 0.0 : aLimb.w < 1.5 ? uSwing.x : aLimb.w < 2.5 ? uSwing.y : aLimb.w < 3.5 ? uSwing.z : uSwing.w;
float chibiCos = cos( chibiAngle );
float chibiSin = sin( chibiAngle );
mat3 chibiTurn = mat3( 1.0, 0.0, 0.0, 0.0, chibiCos, chibiSin, 0.0, - chibiSin, chibiCos );
objectNormal = chibiTurn * objectNormal;
`;
const SWING_POSITION = /* glsl */ `
transformed = chibiTurn * ( transformed - aLimb.xyz ) + aLimb.xyz;
`;

// 밤에 캐릭터가 "자기 색을 스스로 밝히는" 조각 (11.29 피드백: 저녁에 캐릭터가 잘 안 보임)
// 💡 밤에는 푸르고 약한 달빛만 비춰서 옷 색이 어둡게 가라앉습니다.
//    진짜 조명을 더하는 대신, 캐릭터의 원래 색(옷 색·얼굴 그림)을 uGlow 만큼 그대로 더해 줍니다. (트리가 쓰는 방식과 같음)
const GLOW_PARS = /* glsl */ `
uniform float uGlow;
`;
const GLOW_EMISSIVE = /* glsl */ `
// 밤공기에 어울리게 살짝 푸른 기를 섞어 밝힙니다 (원래 색 그대로 밝히면 캐릭터만 붕 떠 보임)
totalEmissiveRadiance += diffuseColor.rgb * vec3( 0.84, 0.9, 1.0 ) * uGlow;
`;
/** 밤에 원래 색을 얼마나 스스로 밝힐지 (0 = 안 밝힘, 1 = 조명과 상관없이 원래 색 그대로) */
export const CHIBI_NIGHT_GLOW = 0.3;

/** 캐릭터 한 명을 움직이는 데 필요한 것들 */
export type Chibi = {
  /** 장면에 올리는 물체 (크기 배율이 이미 들어 있습니다) */
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  /** 팔다리 각도 (왼팔, 오른팔, 왼다리, 오른다리). 그래픽 장치가 매 장면 읽습니다 */
  swing: THREE.Vector4;
  /** 스스로 밝히는 정도. 그래픽 장치가 매 장면 읽습니다 (setChibiNight로 바꿉니다) */
  glow: { value: number };
  /** 걷는 동작이 얼마나 켜져 있는지 (0 = 서 있음, 1 = 걷는 중). 서서히 바뀝니다 */
  blend: number;
  /** 걸음 박자 */
  stride: number;
  /** 서 있을 때 숨 쉬듯 흔들리는 박자 */
  breath: number;
};

/**
 * 받아 온 모델 파일에서 캐릭터 한 명을 만듭니다.
 * - deepSkin: 살색을 더 진하게 칠할지 (마을 = true, 꾸미기 창 = false: 모델의 밝은 살색 그대로)
 * - offset: 서 있을 때의 흔들림이 사람마다 어긋나도록 주는 시작 박자 (모두가 똑같이 움직이지 않게)
 */
export function createChibi(scene: THREE.Object3D, parts: CharacterParts, offset = 0, deepSkin = true): Chibi {
  const kit = readKit(scene);
  const swing = new THREE.Vector4();
  const glow = { value: 0 };
  // 색은 점마다 칠한 색 × 얼굴 그림 (옷 조각은 그림의 흰 칸을 쓰므로 칠한 색 그대로 나옵니다)
  const material = new THREE.MeshStandardMaterial({ map: kit.map, vertexColors: true, roughness: 0.85, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSwing = { value: swing };
    shader.uniforms.uGlow = glow;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + GLOW_PARS)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + GLOW_EMISSIVE);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + SWING_PARS)
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n" + SWING_NORMAL)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + SWING_POSITION);
  };
  // 캐릭터마다 재질은 따로지만(각도 값이 달라서) 프로그램은 하나를 함께 씁니다
  material.customProgramCacheKey = () => "chibi-swing";
  const mesh = new THREE.Mesh(buildGeometry(kit.pieces, parts, deepSkin), material);
  mesh.scale.setScalar(CHIBI_SCALE);
  // 반투명해진 집 뒤에 있어도 캐릭터는 또렷하게 보이게 합니다 (showThrough.ts)
  markShowThrough(mesh);
  return { mesh, swing, glow, blend: 0, stride: 0, breath: offset };
}

/** 낮·밤에 맞춰 캐릭터가 스스로 밝히는 정도를 정합니다 (밤에만 밝힙니다) */
export function setChibiNight(chibi: Chibi, night: boolean) {
  chibi.glow.value = night ? CHIBI_NIGHT_GLOW : 0;
}

/** 캐릭터가 화면에서 사라질 때: 그래픽 장치에 올려 둔 것을 놓아 줍니다 (얼굴 그림은 모두가 함께 쓰므로 지우지 않음) */
export function disposeChibi(chibi: Chibi) {
  chibi.mesh.geometry.dispose();
  chibi.mesh.material.dispose();
}

/** 걸음 빠르기(1초에 도는 각도, 라디안)와 팔다리를 흔드는 폭 */
const STRIDE_RATE = 11;
const LEG_SWING = 0.62;
const ARM_SWING = 0.5;
/** 걷기 ↔ 서 있기를 바꾸는 빠르기 (클수록 빨리 바뀜. 약 0.25초) */
const BLEND_RATE = 12;

/**
 * 한 장면만큼 팔다리를 움직입니다.
 * - 걷는 중: 팔과 다리를 서로 엇갈려 앞뒤로 흔들고, 걸음마다 몸이 살짝 통통 튑니다
 * - 서 있는 중: 숨 쉬듯 팔을 아주 조금 흔듭니다
 */
export function animateChibi(chibi: Chibi, delta: number, walking: boolean) {
  const dt = Math.min(delta, 0.1);
  chibi.blend += ((walking ? 1 : 0) - chibi.blend) * Math.min(1, dt * BLEND_RATE);
  if (chibi.blend < 0.001) {
    chibi.blend = 0;
    chibi.stride = 0; // 다음에 걸을 때는 첫걸음부터
  } else {
    chibi.stride += dt * STRIDE_RATE;
  }
  chibi.breath += dt;
  const step = Math.sin(chibi.stride) * chibi.blend;
  const sway = Math.sin(chibi.breath * 1.7) * 0.045 * (1 - chibi.blend);
  chibi.swing.set(-step * ARM_SWING + sway, step * ARM_SWING + sway, step * LEG_SWING, -step * LEG_SWING);
  // 걸음마다 통통: 발이 엇갈리는 순간에 가장 높습니다
  chibi.mesh.position.y = Math.abs(Math.cos(chibi.stride)) * 0.05 * chibi.blend;
}
