// 다른 주민 캐릭터 "여러 명을 한 번에" 그리기 위한 재료를 만드는 곳입니다. (Task 026)
//
// 💡 왜 필요한가요?
//    예전 방식(RemotePlayersClassic.tsx)은 주민 한 명마다
//      ① 뼈 41개의 자세를 매 장면 계산하고(CPU) ② 그 결과를 그림으로 그래픽 장치에 올리고 ③ 따로 그리기를 2번 했습니다.
//    사람이 늘면 이 세 가지가 사람 수만큼 곱해져, 휴대폰에서 20명일 때 초당 25~30장면까지 떨어졌습니다.
//
// 💡 어떻게 줄이나요?  "자세를 미리 구워 두고, 모두를 한 번에 그립니다."
//    - 모든 주민은 같은 모델·같은 동작 2개(서 있기, 걷기)만 씁니다.
//      그래서 두 동작의 자세를 1초에 60장씩 미리 계산해 그림 한 장(자세 그림)에 적어 둡니다. (한 줄 = 한 순간의 자세)
//    - 그릴 때는 주민마다 "몇 번째 줄을 볼지"만 알려 주고, 그래픽 장치가 그 줄을 읽어 팔다리를 구부립니다.
//    - three.js의 InstancedMesh(같은 모양을 여러 번 한꺼번에 그리는 도구)로 전원을 그리기 1번에 그립니다.
//    → 사람 수에 비례하던 ①②③이 모두 사라지고, 사람 수만큼 늘어나는 것은 "그릴 점의 수"뿐입니다.
//
// 💡 그려지는 모습은 예전과 같습니다: 같은 모델·같은 재질·같은 동작이고, 자세만 미리 계산해 둔 것을 꺼내 씁니다.
//    - 걷기↔서 있기를 바꾸는 0.25초 동안의 "섞인 자세"는 미리 구울 수 없어서(시작 순간이 사람마다 다름),
//      그 순간에 있는 주민만 예전과 똑같은 방법으로 직접 계산해 작은 그림(섞임 그림)에 적어 넘깁니다.
//      25명이 걸어 다녀도 동작을 바꾸는 중인 사람은 보통 2~3명이라 부담이 작습니다.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PoseClip } from "@/lib/village/remoteWalk";
import { IDLE_CLIP, WALK_CLIP, prepareCharacter } from "./characterModel";

/** 자세를 1초에 몇 장 구울지. 화면이 1초에 60장을 그리므로 60이면 매 장면 딱 맞는 자세가 있습니다 */
export const POSE_FPS = 60;

export type CrowdAssets = {
  /** 몸 + 망토를 합친 모양 (주민마다 다른 값은 instanceMatrix와 aPose 속성으로 넘깁니다) */
  geometry: THREE.BufferGeometry;
  /** 캐릭터 재질의 복사본에 "자세 그림을 읽어 구부리기"를 끼워 넣은 것 */
  material: THREE.Material;
  /** 주민마다 넘기는 값: (읽을 줄 번호, 어느 그림인지 — 0 = 미리 구운 자세 그림, 1 = 섞임 그림) */
  poseAttribute: THREE.InstancedBufferAttribute;
  idle: PoseClip;
  walk: PoseClip;
  /** 자세 굽기를 maxRows줄만큼 더 합니다. 다 구웠으면 true (한 장면에 다 하면 멈칫하므로 조금씩 나눠 굽습니다) */
  bake: (maxRows: number) => boolean;
  /**
   * 동작을 바꾸는 중인 주민의 "섞인 자세"를 계산해 섞임 그림의 slot번째 줄에 적습니다.
   * blend = 걷는 동작이 섞인 정도(0 = 서 있는 동작만, 1 = 걷는 동작만). 적은 뒤에는 commitBlends를 한 번 불러야 반영됩니다.
   */
  writeBlend: (slot: number, idleTime: number, walkTime: number, walkWeight: number) => void;
  /** 이번 장면에 적은 섞임 그림을 그래픽 장치에 올리도록 표시합니다 */
  commitBlends: () => void;
  /** 그래픽 장치에 올려 둔 것을 놓아 줍니다 */
  dispose: () => void;
};

// 셰이더(그래픽 장치에서 도는 작은 프로그램)에 끼워 넣는 조각들.
// three.js의 뼈대 처리 조각(skinning_*)과 같은 계산이고, 뼈 정보를 "주민마다 따로 올린 그림" 대신 "미리 구운 자세 그림"에서 읽는 것만 다릅니다.
const PARS = /* glsl */ `
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute vec2 aPose;
uniform highp sampler2D uPoseTex;
uniform highp sampler2D uBlendTex;
mat4 crowdBone( const in float bone, const in int row ) {
	int x = int( bone ) * 4;
	if ( aPose.y > 0.5 ) {
		// 동작을 바꾸는 중인 주민: 방금 계산해 둔 "섞인 자세"를 읽습니다
		return mat4(
			texelFetch( uBlendTex, ivec2( x, row ), 0 ),
			texelFetch( uBlendTex, ivec2( x + 1, row ), 0 ),
			texelFetch( uBlendTex, ivec2( x + 2, row ), 0 ),
			texelFetch( uBlendTex, ivec2( x + 3, row ), 0 )
		);
	}
	return mat4(
		texelFetch( uPoseTex, ivec2( x, row ), 0 ),
		texelFetch( uPoseTex, ivec2( x + 1, row ), 0 ),
		texelFetch( uPoseTex, ivec2( x + 2, row ), 0 ),
		texelFetch( uPoseTex, ivec2( x + 3, row ), 0 )
	);
}
mat4 crowdPose( const in int row ) {
	return skinWeight.x * crowdBone( skinIndex.x, row )
		+ skinWeight.y * crowdBone( skinIndex.y, row )
		+ skinWeight.z * crowdBone( skinIndex.z, row )
		+ skinWeight.w * crowdBone( skinIndex.w, row );
}
`;
const BASE = /* glsl */ `
mat4 crowdSkin = crowdPose( int( aPose.x + 0.5 ) );
`;
const NORMAL = /* glsl */ `
objectNormal = vec4( crowdSkin * vec4( objectNormal, 0.0 ) ).xyz;
#ifdef USE_TANGENT
	objectTangent = vec4( crowdSkin * vec4( objectTangent, 0.0 ) ).xyz;
#endif
`;
const POSITION = /* glsl */ `
transformed = ( crowdSkin * vec4( transformed, 1.0 ) ).xyz;
`;
const INJECTIONS: [string, string][] = [
  ["#include <skinning_pars_vertex>", PARS],
  ["#include <skinbase_vertex>", BASE],
  ["#include <skinnormal_vertex>", NORMAL],
  ["#include <skinning_vertex>", POSITION],
];

/**
 * 받아 온 캐릭터 모델에서 "여러 명 한 번에 그리기" 재료를 만듭니다.
 * 모델이 예상과 다르게 생겼으면(다른 모델로 바뀐 경우 등) null을 돌려주고, 그때는 예전 방식으로 그립니다.
 * - capacity: 한 번에 그릴 수 있는 최대 인원
 */
export function buildCrowdAssets(
  scene: THREE.Object3D,
  animations: THREE.AnimationClip[],
  capacity: number,
): CrowdAssets | null {
  const idleClip = THREE.AnimationClip.findByName(animations, IDLE_CLIP);
  const walkClip = THREE.AnimationClip.findByName(animations, WALK_CLIP);
  if (!idleClip || !walkClip) return null;

  // 자세를 구울 때 쓸 캐릭터 한 명 (화면에는 올리지 않습니다)
  const rig = prepareCharacter(scene);
  rig.updateMatrixWorld(true);
  const skinned: THREE.SkinnedMesh[] = [];
  const attached: THREE.Mesh[] = [];
  rig.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (!mesh.isMesh || !mesh.visible) return;
    if (mesh.isSkinnedMesh) skinned.push(mesh);
    else attached.push(mesh);
  });
  // 몸은 한 덩어리로 합쳐져 있어야 합니다 (characterModel.ts의 mergeBodyParts가 성공했을 때)
  const body = skinned[0];
  if (skinned.length !== 1 || !body || Array.isArray(body.material)) return null;
  if (!body.bindMatrix.equals(IDENTITY)) return null;
  const { bones, boneInverses } = body.skeleton;

  // 뼈에 그냥 붙어 있는 조각(망토)을 "그 뼈 하나만 따라가는 몸의 일부"로 바꿔 몸과 합칩니다
  const parts: THREE.BufferGeometry[] = [body.geometry];
  const indexAttr = body.geometry.getAttribute("skinIndex") as THREE.BufferAttribute | undefined;
  const weightAttr = body.geometry.getAttribute("skinWeight") as THREE.BufferAttribute | undefined;
  if (!indexAttr || !weightAttr) return null;
  const made: THREE.BufferGeometry[] = [];
  for (const mesh of attached) {
    const bone = bones.indexOf(mesh.parent as THREE.Bone);
    if (bone < 0 || mesh.material !== body.material) return disposeAll(made);
    const part = mesh.geometry.clone();
    made.push(part);
    // 뼈가 "기본 자세"일 때의 자리로 옮겨 둡니다 (그래야 뼈를 따라 움직였을 때 원래 붙어 있던 자리에 옵니다)
    part.applyMatrix4(new THREE.Matrix4().copy(boneInverses[bone]).invert().multiply(mesh.matrix));
    const count = part.getAttribute("position").count;
    const indices = new (indexAttr.array.constructor as Uint16ArrayConstructor)(count * 4);
    const weights = new (weightAttr.array.constructor as Float32ArrayConstructor)(count * 4);
    // 가중치가 정수로 저장된 모델이면 "전부"를 뜻하는 값이 1이 아니라 그 정수형의 최댓값입니다
    const full = weightAttr.normalized ? 2 ** (8 * weights.BYTES_PER_ELEMENT) - 1 : 1;
    for (let i = 0; i < count; i++) {
      indices[i * 4] = bone;
      weights[i * 4] = full;
    }
    part.setAttribute("skinIndex", new THREE.BufferAttribute(indices, 4, indexAttr.normalized));
    part.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4, weightAttr.normalized));
    parts.push(part);
  }
  const geometry = parts.length > 1 ? mergeGeometries(parts, false) : body.geometry.clone();
  disposeAll(made);
  if (!geometry) return null;
  const poseAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
  poseAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aPose", poseAttribute);

  // 자세 그림: 가로 = 뼈 수 × 4칸(4×4 행렬 하나), 세로 = 구운 순간의 수
  const idle: PoseClip = { start: 0, count: Math.max(1, Math.round(idleClip.duration * POSE_FPS)), duration: idleClip.duration };
  const walk: PoseClip = { start: idle.count, count: Math.max(1, Math.round(walkClip.duration * POSE_FPS)), duration: walkClip.duration };
  const width = bones.length * 4;
  const rows = idle.count + walk.count;
  const data = new Float32Array(width * rows * 4);
  const poseTexture = new THREE.DataTexture(data, width, rows, THREE.RGBAFormat, THREE.FloatType);
  poseTexture.minFilter = poseTexture.magFilter = THREE.NearestFilter;
  poseTexture.generateMipmaps = false;
  // 섞임 그림: 동작을 바꾸는 중인 주민의 자세를 매 장면 적는 작은 그림 (한 줄 = 한 명)
  const blendData = new Float32Array(width * capacity * 4);
  const blendTexture = new THREE.DataTexture(blendData, width, capacity, THREE.RGBAFormat, THREE.FloatType);
  blendTexture.minFilter = blendTexture.magFilter = THREE.NearestFilter;
  blendTexture.generateMipmaps = false;
  blendTexture.needsUpdate = true;

  const material = body.material.clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPoseTex = { value: poseTexture };
    shader.uniforms.uBlendTex = { value: blendTexture };
    for (const [include, code] of INJECTIONS) {
      if (!shader.vertexShader.includes(include)) console.warn("[crowd] 셰이더에 끼워 넣을 자리가 없습니다:", include);
      shader.vertexShader = shader.vertexShader.replace(include, code);
    }
  };
  // three.js가 "끼워 넣기 전의 같은 재질"과 프로그램을 헷갈려 함께 쓰지 않게 하는 이름표
  material.customProgramCacheKey = () => "hyc-crowd-2";

  // 자세 계산기: 캐릭터 한 명(rig)에 두 동작을 걸어 두고, "각 동작의 시점과 섞는 비율"을 넣어 뼈 자세를 얻습니다.
  // 예전 방식(주민마다 있던 동작 재생기)과 똑같은 three.js 계산이라 결과도 같습니다.
  const mixer = new THREE.AnimationMixer(rig);
  const idleAction = mixer.clipAction(idleClip);
  const walkAction = mixer.clipAction(walkClip);
  idleAction.play();
  walkAction.play();
  const rootInverse = new THREE.Matrix4().copy(rig.matrixWorld).invert();
  const m = new THREE.Matrix4();
  /** 자세를 계산해 target의 offset 위치부터 뼈 수 × 16칸에 적습니다 */
  const writePose = (target: Float32Array, offset: number, idleTime: number, walkTime: number, walkWeight: number) => {
    idleAction.time = idleTime;
    walkAction.time = walkTime;
    idleAction.setEffectiveWeight(1 - walkWeight);
    walkAction.setEffectiveWeight(walkWeight);
    mixer.update(0);
    rig.updateMatrixWorld(true);
    for (let b = 0; b < bones.length; b++) {
      // 모델의 기준점에서 본 "이 뼈가 점들을 얼마나 옮기는지"
      m.multiplyMatrices(rootInverse, bones[b].matrixWorld).multiply(boneInverses[b]);
      m.toArray(target, offset + b * 16);
    }
  };

  // 굽기: 동작을 1/60초씩 넘겨 가며 그 순간의 뼈 자세를 자세 그림에 적습니다
  let baked = 0;
  const bake = (maxRows: number) => {
    if (baked >= rows) return true;
    const until = Math.min(rows, baked + maxRows);
    for (; baked < until; baked++) {
      if (baked < idle.count) writePose(data, baked * width * 4, baked / POSE_FPS, 0, 0);
      else writePose(data, baked * width * 4, 0, (baked - idle.count) / POSE_FPS, 1);
    }
    if (baked < rows) return false;
    poseTexture.needsUpdate = true;
    return true;
  };

  return {
    geometry,
    material,
    poseAttribute,
    idle,
    walk,
    bake,
    writeBlend: (slot, idleTime, walkTime, walkWeight) => {
      if (slot >= 0 && slot < capacity) writePose(blendData, slot * width * 4, idleTime, walkTime, walkWeight);
    },
    commitBlends: () => {
      blendTexture.needsUpdate = true;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      poseTexture.dispose();
      blendTexture.dispose();
      body.skeleton.dispose();
    },
  };
}

const IDENTITY = new THREE.Matrix4();

function disposeAll(list: THREE.BufferGeometry[]): null {
  list.forEach((g) => g.dispose());
  return null;
}
