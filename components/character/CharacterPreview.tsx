"use client";

// 꾸미기 창 위쪽의 "무대"입니다. (F016)
// 지금 고르는 중인 옷을 입은 캐릭터를 크게 보여 줍니다.
//  - 처음에는 좌우로 천천히 몸을 돌려 옆모습도 보여 줍니다
//  - 손가락(마우스)으로 좌우로 끌면 그만큼 돌려 볼 수 있습니다 (끈 뒤에는 그 방향에 멈춰 있습니다)
// 💡 마을 화면과는 다른, 이 창만의 작은 3D 화면입니다. 캐릭터 한 명만 그리므로 가볍고, 창을 닫으면 사라집니다.

import { Suspense, useEffect, useMemo, useRef, type PointerEvent, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type * as THREE from "three";
import { CHIBI_MODEL_URL, CHIBI_SCALE, animateChibi, createChibi, disposeChibi } from "@/components/village/chibiModel";
import type { CharacterParts } from "@/types/domain";

/** 저절로 좌우로 몸을 돌리는 폭(라디안)과 빠르기 */
const TURN_ANGLE = 0.55;
const TURN_RATE = 0.7;
/** 손가락을 1픽셀 끌 때 도는 각도(라디안) */
const DRAG_TURN = 0.012;
/** 캐릭터 키의 절반 (화면 가운데에 오도록 그만큼 내려 놓습니다) */
const HALF_HEIGHT = 0.46 * CHIBI_SCALE;

/** 끌어서 돌리기 상태. 화면을 다시 그리지 않도록 React 상태가 아니라 ref에 담아 3D가 매 장면 읽습니다 */
type Spin = { angle: number; touched: boolean; lastX: number | null };

function PreviewCharacter({ parts, spin }: { parts: CharacterParts; spin: RefObject<Spin> }) {
  const { scene } = useGLTF(CHIBI_MODEL_URL);
  // 옷을 바꿀 때마다 그 옷을 입은 캐릭터를 새로 만들고, 전에 쓰던 것은 놓아 줍니다
  const chibi = useMemo(() => createChibi(scene, parts), [scene, parts]);
  useEffect(() => () => disposeChibi(chibi), [chibi]);
  const group = useRef<THREE.Group>(null);
  const time = useRef(0);
  // 저절로 도는 정도 (1 = 다 돎, 0 = 멈춤). 손으로 끌기 시작하면 서서히 0이 되어, 끈 방향에 부드럽게 멈춥니다
  const sway = useRef(1);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    time.current += dt;
    animateChibi(chibi, delta, false);
    const { touched, angle } = spin.current;
    if (touched) sway.current = Math.max(0, sway.current - dt * 3);
    if (group.current) group.current.rotation.y = angle + Math.sin(time.current * TURN_RATE) * TURN_ANGLE * sway.current;
  });

  return (
    <group ref={group} position={[0, -HALF_HEIGHT, 0]}>
      <primitive object={chibi.mesh} />
    </group>
  );
}

interface CharacterPreviewProps {
  parts: CharacterParts;
  /** 화면 읽기 도구용 설명 */
  label: string;
  /** 무대 위에 겹쳐 놓을 것 (캐릭터 고르기 버튼 등) */
  children?: ReactNode;
}

export function CharacterPreview({ parts, label, children }: CharacterPreviewProps) {
  const spin = useRef<Spin>({ angle: 0, touched: false, lastX: null });

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    spin.current.lastX = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = spin.current;
    if (s.lastX === null) return;
    s.angle += (e.clientX - s.lastX) * DRAG_TURN;
    s.lastX = e.clientX;
    s.touched = true;
  };
  const onUp = () => {
    spin.current.lastX = null;
  };

  return (
    <div
      className="relative h-60 w-full overflow-hidden rounded-[28px]"
      // 무대 바탕: 위는 옅은 하늘빛, 아래는 따뜻한 크림색
      style={{ background: "linear-gradient(180deg, #e9eefb 0%, #f3efe9 58%, #f8ecd9 100%)" }}
    >
      {/* 발밑의 둥근 그림자 (무대 바닥 느낌) */}
      <span
        aria-hidden="true"
        className="absolute bottom-7 left-1/2 h-4 w-28 -translate-x-1/2 rounded-[50%]"
        style={{ background: "radial-gradient(closest-side, rgba(35,43,82,0.22), rgba(35,43,82,0))" }}
      />
      {/* touch-pan-y: 위아래로 미는 것은 창 스크롤, 좌우로 끄는 것은 캐릭터 돌리기 */}
      <div
        role="img"
        aria-label={label}
        className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* flat: 색을 눌러 보정하지 않고 고른 색 그대로 / dpr: 화면 배율은 2까지만 / stencil: 캐릭터 재질이 쓰는 "도장 찍기 판" */}
        <Canvas flat dpr={[1, 2]} camera={{ fov: 30, position: [0, 0.1, 5.0] }} gl={{ stencil: true, alpha: true }}>
          <ambientLight intensity={2.35} />
          <directionalLight position={[2.5, 4, 5]} intensity={1.4} />
          <Suspense fallback={null}>
            <PreviewCharacter parts={parts} spin={spin} />
          </Suspense>
        </Canvas>
      </div>
      {children}
    </div>
  );
}
