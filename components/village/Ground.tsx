"use client";

// 눈 덮인 땅과 가운데 광장(돌바닥, PlazaFloor.tsx)입니다.
// 땅을 눌렀을 때 그 3D 좌표를 onGroundPointerDown으로 알려 줍니다. (캐릭터 걷기에 사용)
//
// 11.25 사용자 요청: 평평한 바닥 대신 실제 눈이 쌓인 것처럼 울퉁불퉁하게 (A+B안, 렌더링 부담 없이)
//  A. 큰 굴곡: 땅 그물의 높이를 lib/village/terrain.ts로 "처음 한 번만" 계산해 둡니다 (매 장면 다시 계산하지 않음)
//     - 원 모양 그물(가운데는 성기고 바깥으로 촘촘)을 써서 꼭짓점 약 1만 개로 가볍게
//     - 울퉁불퉁한 구역 바깥은 평평한 고리 한 장 (안개에 가려지는 먼 곳이라 굴곡이 필요 없음)
//  B. 작은 결: 눈 표면의 오돌토돌한 "노멀맵"을 코드로 한 번 그려서 바닥에 반복해 입힙니다 (파일 다운로드 없음)
//     💡 노멀맵: 표면이 어느 쪽을 향하는지 적어 둔 그림. 모양은 평평해도 빛이 결을 따라 반사돼 울퉁불퉁해 보입니다.

import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { groundHit } from "@/lib/village/groundHit";
import { PLAZA_RIM, plazaRimHeight, type Terrain } from "@/lib/village/terrain";
import { VILLAGE_COLORS } from "@/lib/village/theme";
import { PlazaFloor } from "./PlazaFloor";
import { useNight } from "./nightContext";

interface GroundProps {
  /** 눈밭 전체 반지름 (먼 곳까지) */
  radius: number;
  /** 울퉁불퉁한 구역의 반지름 (terrain의 edgeRadius와 같아야 이음매가 없음) */
  detailRadius: number;
  /** 높이 계산 */
  terrain: Terrain;
  /** 땅을 눌렀을 때 호출. point = 눌린 곳의 3D 좌표 */
  onGroundPointerDown?: (point: { x: number; y: number; z: number }) => void;
}

/** 울퉁불퉁한 구역 그물 촘촘함: 둘레 방향 칸 수, 반지름 방향 칸 수 */
const SEGMENTS = { around: 160, outward: 64 };
/** 노멀맵 한 장이 땅에서 덮는 크기 (작을수록 결이 잘아짐) */
const NORMAL_TILE = 5;

/** 이음매 없이 반복되는 눈 표면 노멀맵을 한 번만 만듭니다 */
let snowNormalTexture: THREE.DataTexture | null = null;
function snowNormalMap(): THREE.DataTexture {
  if (snowNormalTexture) return snowNormalTexture;
  const size = 128;
  const period = 16; // 무늬가 그림 가장자리에서 이어지도록 격자를 이 칸 수로 되풀이
  const hash = (ix: number, iz: number) => {
    const s = Math.sin(((ix + period) % period) * 127.1 + ((iz + period) % period) * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x: number, z: number) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uz = fz * fz * (3 - 2 * fz);
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  };
  // 높이 그림 (큰 결 + 잔결)
  const h = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i / size) * period;
      const z = (j / size) * period;
      h[j * size + i] = noise(x, z) * 0.7 + noise((x * 2) % period, (z * 2) % period) * 0.3;
    }
  }
  // 높이 차이로 표면 방향(노멀)을 계산해 색(RGB)으로 저장
  const data = new Uint8Array(size * size * 4);
  const strength = 2.2;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const l = h[j * size + ((i - 1 + size) % size)];
      const r = h[j * size + ((i + 1) % size)];
      const u = h[((j - 1 + size) % size) * size + i];
      const d = h[((j + 1) % size) * size + i];
      const nx = (l - r) * strength;
      const ny = (u - d) * strength;
      const len = Math.hypot(nx, ny, 1);
      const k = (j * size + i) * 4;
      data[k] = ((nx / len) * 0.5 + 0.5) * 255;
      data[k + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[k + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[k + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  snowNormalTexture = texture;
  return texture;
}

export function Ground({ radius, detailRadius, terrain, onGroundPointerDown }: GroundProps) {
  // 밤에는 스스로 빛나는 효과(emissive)를 끕니다.
  // 낮에는 눈을 하얗게 보이려고 켜 두지만, 밤에는 이 빛이 "빛 번짐" 효과에 걸려 화면 전체가 뿌옇게 됩니다.
  // (11.25 수정: 캐릭터가 뿌옇게 보이던 원인) 시안의 밤 눈밭도 스스로 빛나지 않습니다.
  const night = useNight();
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    onGroundPointerDown?.({ x: e.point.x, y: e.point.y, z: e.point.z });
  };

  // 눌림 검사: 땅 그물의 삼각형 2만 개를 하나씩 검사하지 않고, 높이 계산식으로 눌린 자리를 바로 찾습니다.
  // (11.26 성능: 탭 한 번에 세 번 하던 검사가 휴대폰에서 약 12ms → 거의 0. 찾는 자리는 같습니다 → lib/village/groundHit.ts)
  // 💡 three.js는 물체마다 raycast라는 "눌림 검사 함수"를 부릅니다. 그 함수를 우리 것으로 바꿔 끼웁니다.
  const hitTest = useMemo(
    () =>
      function (this: THREE.Object3D, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
        const hit = groundHit(raycaster.ray.origin, raycaster.ray.direction, terrain.heightAt, radius);
        if (!hit || hit.distance < raycaster.near || hit.distance > raycaster.far) return;
        intersects.push({ distance: hit.distance, point: new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z), object: this });
      },
    [terrain, radius],
  );

  // A. 울퉁불퉁한 땅 그물: 처음 한 번만 높이를 계산합니다
  const detailGeometry = useMemo(() => {
    const g = new THREE.RingGeometry(0.01, detailRadius, SEGMENTS.around, SEGMENTS.outward);
    // 그물은 세워진 판(x, y)으로 만들어지고, 아래 mesh에서 눕힙니다(x축 -90도) → 판의 y가 땅의 -z, 판의 z가 높이
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = -pos.getY(i);
      pos.setZ(i, terrain.baseHeightAt(x, z));
    }
    // 노멀맵이 땅 위에서 NORMAL_TILE 크기마다 반복되도록 무늬 좌표를 실제 거리 기준으로
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, pos.getX(i) / NORMAL_TILE, pos.getY(i) / NORMAL_TILE);
    }
    g.computeVertexNormals();
    return g;
  }, [detailRadius, terrain]);

  // 울퉁불퉁한 구역 바깥의 평평한 먼 눈밭 (고리 한 장)
  const outerGeometry = useMemo(() => {
    const g = new THREE.RingGeometry(detailRadius, radius, SEGMENTS.around, 1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / NORMAL_TILE, pos.getY(i) / NORMAL_TILE);
    return g;
  }, [detailRadius, radius]);

  // 광장 테두리의 눈 둔덕: 좁은 띠라서 촘촘한 그물을 따로 씁니다 (광장의 칼같이 끊긴 가장자리를 덮어 줌)
  const rimGeometry = useMemo(() => {
    const g = new THREE.RingGeometry(PLAZA_RIM.inner, PLAZA_RIM.outer, 128, 8);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = -pos.getY(i);
      // 아래 눈밭 높이 위에 둔덕을 얹습니다
      pos.setZ(i, terrain.baseHeightAt(x, z) + plazaRimHeight(x, z));
      uv.setXY(i, pos.getX(i) / NORMAL_TILE, pos.getY(i) / NORMAL_TILE);
    }
    g.computeVertexNormals();
    return g;
  }, [terrain]);
  useEffect(() => () => rimGeometry.dispose(), [rimGeometry]);

  // 다른 마을로 바뀌어 그물을 새로 만들면, 이전 그물은 정리해 메모리를 아낍니다
  useEffect(() => () => detailGeometry.dispose(), [detailGeometry]);
  useEffect(() => () => outerGeometry.dispose(), [outerGeometry]);

  const normalMap = snowNormalMap();
  const snowMaterial = (
    <meshStandardMaterial
      color={VILLAGE_COLORS.ground}
      normalMap={normalMap}
      normalScale={new THREE.Vector2(0.8, 0.8)}
      roughness={0.95}
      emissive="#ffffff"
      // 낮: 굴곡의 그늘이 보이도록 스스로 빛나는 정도를 예전(0.8)보다 줄였습니다
      emissiveIntensity={night ? 0 : 0.3}
    />
  );

  return (
    <group>
      {/* 울퉁불퉁한 눈밭 (마을과 그 둘레) */}
      <mesh geometry={detailGeometry} rotation={[-Math.PI / 2, 0, 0]}>
        {snowMaterial}
      </mesh>
      {/* 먼 곳의 평평한 눈밭 */}
      <mesh geometry={outerGeometry} rotation={[-Math.PI / 2, 0, 0]}>
        {snowMaterial}
      </mesh>
      {/* 광장: 조약돌을 동심원으로 깐 돌바닥 */}
      <PlazaFloor />
      {/* 광장 테두리의 눈 둔덕 (눈밭보다 살짝 위에 얹어 겹쳐 떨리지 않게) */}
      <mesh geometry={rimGeometry} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {snowMaterial}
      </mesh>
      {/* 눌림만 받는 보이지 않는 물체: 땅 전체(눈밭·광장·둔덕)의 눌림을 이 하나가 맡습니다 */}
      <object3D raycast={hitTest} onPointerDown={handlePointerDown} />
    </group>
  );
}
