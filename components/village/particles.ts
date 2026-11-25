"use client";

// 눈송이·연기·빛 알갱이처럼 "수많은 작은 점"을 그릴 때 함께 쓰는 도구입니다.
// (지금은 굴뚝 연기 ChimneySmoke.tsx가 씁니다)

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";


/** 가운데는 진하고 가장자리로 갈수록 투명해지는 동그란 점 그림 (눈송이·연기·빛 알갱이 모양) */
let softDotTexture: THREE.CanvasTexture | null = null;
export function softDot() {
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

/**
 * 셰이더에 넘기는 값(uniform)을 바꿉니다.
 * three.js 재질은 React 상태가 아니라서 매 장면마다 직접 고칩니다. (컴포넌트 밖 함수로 두어 React 규칙 검사와 충돌하지 않게)
 */
export function setUniform(material: THREE.ShaderMaterial, name: string, value: number) {
  material.uniforms[name].value = value;
}

/** 알갱이 재질을 만들고, 매 장면마다 시간과 화면 높이를 알려 줍니다 */
export function useParticleMaterial(
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
export const POINT_SIZE = /* glsl */ `
  uniform float viewportH;
  float worldSize(float size, vec4 mv) {
    return size * projectionMatrix[1][1] * 0.5 * viewportH / -mv.z;
  }
`;
