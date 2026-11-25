"use client";

// 대왕 트리가 서 있는 광장 바닥입니다. (11.25 사용자 요청: 밋밋한 단색 원판 → 느낌 있는 돌바닥)
//
// 모습: 트리를 중심으로 조약돌을 동심원으로 깐 유럽 크리스마스 마켓풍 광장.
//       돌 사이에는 눈이 끼어 있고, 가장자리로 갈수록 눈에 덮여 눈밭과 자연스럽게 이어집니다.
//
// ⚡ 부담 없이: 그림 파일을 받지 않고, 무늬를 코드로 "한 번만" 그려서 입힙니다.
//    - 색 그림(map): 돌 색과 눈
//    - 높낮이 그림(bumpMap): 돌은 볼록, 돌 사이는 오목 → 빛이 돌 모양을 따라 비칩니다 (밤 가로등 아래에서 잘 보임)

import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { PLAZA_RADIUS } from "@/lib/village/layout";
import { useNight } from "./nightContext";

/** 그림 한 변의 점 개수 */
const SIZE = 1024;
/** 돌 한 줄(고리)의 폭과 돌 하나의 길이 (마을 좌표 기준) */
const STONE = { ring: 0.62, length: 0.85, gap: 0.07 };
/** 돌 색들 (따뜻한 회색·베이지) */
const STONE_COLORS = ["#a3968a", "#8f8477", "#b3a798", "#877d72", "#9d8f80", "#a89d90"];
/** 돌 사이에 낀 눈 색 */
const SNOW = "#f3f6fa";

/** 같은 씨앗이면 항상 같은 숫자를 내는 무작위 (새로고침해도 돌 배치가 그대로) */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 돌바닥을 그립니다. kind가 "color"면 색 그림, "height"면 높낮이 그림(밝을수록 높음).
 * 두 그림이 똑같은 돌 배치를 쓰도록 같은 씨앗으로 그립니다.
 */
function drawPlaza(kind: "color" | "height"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const rand = seededRandom(1224);
  const c = SIZE / 2;
  const px = SIZE / 2 / PLAZA_RADIUS; // 마을 좌표 1칸 = 그림의 몇 점인지

  // 바탕: 돌 사이에 낀 눈 (높낮이 그림에서는 낮은 곳)
  ctx.fillStyle = kind === "color" ? SNOW : "#5a5a5a";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 돌: 가운데부터 고리 모양으로 한 줄씩
  ctx.lineJoin = "round";
  for (let inner = 0.35; inner < PLAZA_RADIUS; inner += STONE.ring) {
    const outer = inner + STONE.ring;
    const mid = (inner + outer) / 2;
    const count = Math.max(6, Math.round((2 * Math.PI * mid) / STONE.length));
    const offset = rand() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      // 돌마다 길이를 조금씩 다르게 해서 손으로 깐 느낌을 냅니다
      const a0 = offset + ((i + 0.08 * (rand() - 0.5)) / count) * Math.PI * 2;
      const a1 = offset + ((i + 1) / count) * Math.PI * 2;
      const gapAngle = STONE.gap / mid;
      const r0 = (inner + STONE.gap) * px;
      const r1 = (outer - STONE.gap) * px;
      const shade = rand();
      ctx.beginPath();
      ctx.arc(c, c, r1, a0 + gapAngle, a1 - gapAngle);
      ctx.arc(c, c, r0, a1 - gapAngle, a0 + gapAngle, true);
      ctx.closePath();
      if (kind === "color") {
        ctx.fillStyle = ctx.strokeStyle = STONE_COLORS[Math.floor(shade * STONE_COLORS.length)];
      } else {
        // 돌마다 높이를 살짝 다르게 (울퉁불퉁한 옛 돌길)
        const h = Math.round(185 + shade * 45);
        ctx.fillStyle = ctx.strokeStyle = `rgb(${h},${h},${h})`;
      }
      // 같은 색 테두리를 둥글게 덧그려서 돌 모서리를 둥글립니다
      ctx.lineWidth = 5;
      ctx.fill();
      ctx.stroke();
    }
  }

  // 돌 위에 흩뿌려진 눈: 가장자리로 갈수록 많이
  for (let i = 0; i < 420; i++) {
    const r = Math.sqrt(rand()) * PLAZA_RADIUS;
    const angle = rand() * Math.PI * 2;
    const edge = r / PLAZA_RADIUS; // 0 = 가운데, 1 = 가장자리
    if (rand() > 0.15 + edge * edge * 0.85) continue;
    const size = (0.25 + rand() * 0.7) * px;
    const x = c + Math.cos(angle) * r * px;
    const y = c + Math.sin(angle) * r * px;
    const alpha = 0.35 + rand() * 0.45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    const tone = kind === "color" ? "243,246,250" : "215,215,215";
    g.addColorStop(0, `rgba(${tone},${alpha})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
  }

  // 가장자리는 눈에 덮여 눈밭과 이어지게
  const fade = ctx.createRadialGradient(c, c, c * 0.86, c, c, c);
  const tone = kind === "color" ? "243,246,250" : "200,200,200";
  fade.addColorStop(0, `rgba(${tone},0)`);
  fade.addColorStop(1, `rgba(${tone},1)`);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, SIZE, SIZE);
  return canvas;
}

/** 돌바닥 그림 두 장을 한 번만 만들어 둡니다 */
let plazaTextures: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
function getPlazaTextures() {
  if (plazaTextures) return plazaTextures;
  const map = new THREE.CanvasTexture(drawPlaza("color"));
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(drawPlaza("height"));
  // 비스듬히 볼 때도 돌 무늬가 뭉개지지 않게
  map.anisotropy = bumpMap.anisotropy = 4;
  plazaTextures = { map, bumpMap };
  return plazaTextures;
}

interface PlazaFloorProps {
  /** 바닥을 눌렀을 때 (캐릭터 걷기) */
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}

export function PlazaFloor({ onPointerDown }: PlazaFloorProps) {
  const night = useNight();
  const { map, bumpMap } = getPlazaTextures();
  return (
    // 눈밭보다 아주 조금 위에 얹은 원판 (광장은 평평)
    <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onPointerDown}>
      <circleGeometry args={[PLAZA_RADIUS, 64]} />
      <meshStandardMaterial
        map={map}
        bumpMap={bumpMap}
        bumpScale={2.5}
        roughness={0.9}
        // 낮: 눈밭처럼 살짝 스스로 밝혀서 흰 눈밭 옆에서 어둡게 가라앉지 않게. 밤에는 끕니다(빛 번짐에 걸려 뿌예짐)
        emissive="#ffffff"
        emissiveMap={map}
        emissiveIntensity={night ? 0 : 0.12}
      />
    </mesh>
  );
}
