"use client";

// 집 한 채의 부품 21개를 "2덩어리"로 미리 합쳐 두는 파일입니다. (11.25 성능 개선)
//
// 예전: 벽·창문·기둥·지붕 부품을 하나씩 따로 그림 → 집 한 채에 그리기 명령 21번
// 지금: 벽 덩어리(집마다 색을 입히는 부분) + 나머지 덩어리(지붕·기둥) → 집 한 채에 2번
// 합친 모양은 모든 집이 함께 쓰고(한 번만 만듦), 보이는 모습은 예전과 똑같습니다.

import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { modelUrl } from "./Kit";

const HALF = Math.PI / 2;

type Piece = {
  name: string;
  x: number;
  z: number;
  y?: number;
  /** 돌리는 각도(라디안) */
  rot?: number;
  /** 좌우 뒤집기 */
  flip?: boolean;
  /** 앞뒤 길이 배율 (지붕이 겹치지 않게 살짝 줄임) */
  depth?: number;
  /** true면 집마다 정해진 벽 색을 입힙니다 (지붕·기둥은 그대로) */
  wall?: boolean;
};

// 부품 하나는 가로세로 1칸이고, 벽은 그 칸의 앞쪽 가장자리에 붙어 있습니다.
// 그래서 부품을 돌리면(rot) 왼쪽·오른쪽·뒤쪽 벽이 됩니다.
const PIECES: Piece[] = [
  // 앞면(+z 쪽): 문 + 창문
  { name: "cabin-door-rotate", x: -0.5, z: 0.5, wall: true },
  { name: "cabin-window-a", x: 0.5, z: 0.5, wall: true },
  // 뒷면
  { name: "cabin-wall", x: -0.5, z: -0.5, rot: Math.PI, wall: true },
  { name: "cabin-window-b", x: 0.5, z: -0.5, rot: Math.PI, wall: true },
  // 왼쪽 면
  { name: "cabin-wall-wreath", x: -0.5, z: 0.5, rot: -HALF, wall: true },
  { name: "cabin-wall", x: -0.5, z: -0.5, rot: -HALF, wall: true },
  // 오른쪽 면
  { name: "cabin-window-b", x: 0.5, z: 0.5, rot: HALF, wall: true },
  { name: "cabin-wall-wreath", x: 0.5, z: -0.5, rot: HALF, wall: true },
  // 네 모서리 통나무 기둥
  { name: "cabin-corner-logs", x: -0.5, z: 0.5 },
  { name: "cabin-corner-logs", x: 0.5, z: 0.5, rot: HALF },
  { name: "cabin-corner-logs", x: 0.5, z: -0.5, rot: Math.PI },
  { name: "cabin-corner-logs", x: -0.5, z: -0.5, rot: -HALF },
  // 지붕 아래 세모난 벽 (앞, 뒤)
  { name: "cabin-wall-roof", x: 0.5, z: 0.5, y: 1, wall: true },
  { name: "cabin-wall-roof", x: -0.5, z: 0.5, y: 1, flip: true, wall: true },
  { name: "cabin-wall-roof", x: -0.5, z: -0.5, y: 1, rot: Math.PI, wall: true },
  { name: "cabin-wall-roof", x: 0.5, z: -0.5, y: 1, rot: Math.PI, flip: true, wall: true },
  // 눈 쌓인 지붕 (오른쪽 2장, 왼쪽 2장)
  { name: "cabin-roof-snow", x: 0.5, z: 0.6, y: 1, depth: 0.857 },
  { name: "cabin-roof-snow-chimney", x: 0.5, z: -0.6, y: 1, depth: 0.857 },
  { name: "cabin-roof-snow", x: -0.5, z: 0.6, y: 1, rot: Math.PI, depth: 0.857 },
  { name: "cabin-roof-snow", x: -0.5, z: -0.6, y: 1, rot: Math.PI, depth: 0.857 },
];

/** 집에 쓰는 모델 이름들 (중복 없이) */
const NAMES = [...new Set(PIECES.map((p) => p.name))];
const URLS = NAMES.map((name) => modelUrl("kenney", name));

export type HouseParts = {
  /** 벽 덩어리 (집마다 색을 입힘) */
  wall: THREE.BufferGeometry;
  /** 지붕·기둥 덩어리 */
  other: THREE.BufferGeometry;
  /** 원본 재질 (Kenney 모델은 모두 같은 색 그림 한 장을 씁니다) */
  material: THREE.MeshStandardMaterial;
};

let cache: HouseParts | null = null;

/** 부품 하나의 모양을 집 안의 제자리로 옮긴 사본을 만듭니다 */
function placePiece(scene: THREE.Object3D, piece: Piece): THREE.BufferGeometry[] {
  const pieceMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(piece.x, piece.y ?? 0, piece.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), piece.rot ?? 0),
    new THREE.Vector3(piece.flip ? -1 : 1, 1, piece.depth ?? 1),
  );
  const list: THREE.BufferGeometry[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone();
    // 합치려면 모든 부품이 같은 종류의 정보만 가져야 해서, 쓰지 않는 정보(tangent)는 뺍니다
    for (const key of Object.keys(g.attributes)) {
      if (key !== "position" && key !== "normal" && key !== "uv") g.deleteAttribute(key);
    }
    const matrix = pieceMatrix.clone().multiply(mesh.matrixWorld);
    g.applyMatrix4(matrix);
    // 좌우로 뒤집으면 면의 앞뒤가 바뀌므로, 삼각형 꼭짓점 순서를 다시 뒤집어 앞면이 바깥을 보게 합니다
    if (matrix.determinant() < 0 && g.index) {
      const index = g.index;
      for (let i = 0; i < index.count; i += 3) {
        const b = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, b);
      }
    }
    list.push(g);
  });
  return list;
}

/** 부품들을 합쳐 집 모양을 만듭니다. 처음 한 번만 만들고 다음부터는 만들어 둔 것을 돌려줍니다 */
function buildHouseParts(scenes: THREE.Object3D[]): HouseParts {
  if (cache) return cache;
  const walls: THREE.BufferGeometry[] = [];
  const others: THREE.BufferGeometry[] = [];
  let material: THREE.MeshStandardMaterial | null = null;
  for (const piece of PIECES) {
    const scene = scenes[NAMES.indexOf(piece.name)];
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && !material) material = mesh.material as THREE.MeshStandardMaterial;
    });
    (piece.wall ? walls : others).push(...placePiece(scene, piece));
  }
  cache = { wall: mergeGeometries(walls), other: mergeGeometries(others), material: material! };
  // 합치기 전 사본은 더 쓰지 않으므로 정리합니다
  [...walls, ...others].forEach((g) => g.dispose());
  return cache;
}

/** 합쳐 둔 집 모양을 돌려줍니다. 모든 집이 같이 씁니다 */
export function useHouseParts(): HouseParts {
  const gltfs = useGLTF(URLS);
  return buildHouseParts(gltfs.map((g) => g.scene));
}
