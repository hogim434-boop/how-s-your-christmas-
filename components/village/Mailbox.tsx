"use client";

// 집 앞 우체통입니다. 눌렀을 때의 동작·"보냄" 불빛은 이 파일에, 겉모양은 MailboxModel 한 곳에 있습니다.
// 편지를 이미 보낸 주민이면 위쪽에 노란 불이 켜집니다.

import { useEffect, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import type * as THREE from "three";
import { markShowThrough } from "./showThrough";
import { Kit } from "./Kit";
import { VILLAGE_COLORS } from "@/lib/village/theme";

/** 우체통 색 (KayKit Holiday Bits 그림체에 맞춘 부드러운 색) */
const MAILBOX_PALETTE = {
  post: "#7b4a2a",
  body: "#b8283b",
  roof: "#f4ead2",
  slot: "#3a2230",
};

/**
 * 우체통 겉모양: 통통한 오두막 모양 (모서리가 둥근 상자 + 눈 쌓인 맞배지붕 + 현관 리스).
 * 모양을 바꾸고 싶으면 이 함수 안쪽만 고치면 됩니다. 앞면은 +z 방향입니다.
 */
function MailboxModel() {
  return (
    <group>
      {/* 기둥 */}
      <RoundedBox args={[0.2, 0.8, 0.2]} radius={0.05} smoothness={3} position={[0, 0.4, 0]}>
        <meshStandardMaterial color={MAILBOX_PALETTE.post} roughness={0.8} />
      </RoundedBox>
      {/* 몸통 */}
      <RoundedBox args={[0.7, 0.5, 0.7]} radius={0.08} smoothness={3} position={[0, 1.05, 0]}>
        <meshStandardMaterial color={MAILBOX_PALETTE.body} roughness={0.7} />
      </RoundedBox>
      {/* 맞배지붕: 눈 쌓인 두꺼운 판 두 장을 기울여 붙임 */}
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[0.5, 0.12, 0.86]}
          radius={0.05}
          smoothness={3}
          position={[side * 0.2, 1.42, 0]}
          rotation={[0, 0, -side * 0.62]}
        >
          <meshStandardMaterial color={MAILBOX_PALETTE.roof} roughness={0.85} />
        </RoundedBox>
      ))}
      {/* 편지 구멍 */}
      <RoundedBox args={[0.4, 0.06, 0.04]} radius={0.02} smoothness={2} position={[0, 1.0, 0.36]}>
        <meshStandardMaterial color={MAILBOX_PALETTE.slot} roughness={0.9} />
      </RoundedBox>
      {/* 몸통 앞에 건 리스 (KayKit) */}
      <Kit pack="kaykit" name="wreath" scale={0.22} position={[0, 1.15, 0.4]} />
    </group>
  );
}

interface MailboxProps {
  residentId: string;
  /** 접근성용 이름 (화면 읽기 도구가 읽는 글자) */
  label: string;
  position: [number, number, number];
  /** 우체통이 바라볼 방향(y축 회전). 집과 같은 값을 주면 편지 구멍이 광장 쪽을 봅니다. */
  rotation: number;
  /** 편지를 이미 보냈는지 */
  sent: boolean;
  /** 우체통을 눌렀을 때 */
  onSelect: (residentId: string) => void;
}

export function Mailbox({ residentId, label, position, rotation, sent, onSelect }: MailboxProps) {
  const group = useRef<THREE.Group>(null);
  // 반투명해진 집 뒤에 있어도 우체통은 흐려지지 않고 또렷하게 보이게 합니다 (11.25 사용자 요청)
  useEffect(() => {
    if (group.current) markShowThrough(group.current);
  }, [sent]);

  return (
    <group
      ref={group}
      position={position}
      rotation={[0, rotation, 0]}
      // 집 크기에 맞춰 조금 키웁니다 (손가락으로 누르기 쉽게)
      scale={1.5}
      name={label}
      // 누르는 순간(pointerdown)도 막아야 뒤의 땅이 "걸어가기"로 받아들이지 않습니다
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        // 뒤에 있는 땅이 같이 눌리지 않게 막습니다 (땅을 누르면 걸어가기 때문)
        e.stopPropagation();
        onSelect(residentId);
      }}
      // 마우스를 올리면 손가락 모양 커서 (휴대폰에서는 영향 없음)
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      {/* 눌러 보기 쉽게 보이지 않는 큰 상자를 씌웁니다 (손가락으로 누를 영역 넓히기) */}
      <mesh position={[0, 0.7, 0]} visible={false}>
        <boxGeometry args={[1.1, 1.6, 1.1]} />
      </mesh>

      <MailboxModel />

      {/* "보냄" 표시: 노란 불. meshBasicMaterial은 조명과 상관없이 밝게 보입니다 */}
      {sent && (
        <>
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshBasicMaterial color={VILLAGE_COLORS.sentLight} />
          </mesh>
          <pointLight position={[0, 1.6, 0]} color={VILLAGE_COLORS.sentLight} intensity={2} distance={3} />
        </>
      )}
    </group>
  );
}
