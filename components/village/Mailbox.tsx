"use client";

// 집 앞 우체통입니다. 눌렀을 때의 동작·"보냄" 불빛은 이 파일에, 겉모양은 MailboxModel 한 곳에 있습니다.
// 편지를 이미 보낸 주민이면 위쪽에 노란 불이 켜집니다.
// ⚡ 불은 진짜 불빛(pointLight) 대신 "빛 번짐 그림"으로 표현합니다. 진짜 불빛은 개수만큼 화면 전체 계산이 늘어나서,
//    편지를 많이 보낼수록 느려지기 때문입니다 (11.25 성능 개선)

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { markShowThrough } from "./showThrough";
import { InstancedKit, placement } from "./InstancedKit";
import { softDot } from "./particles";
import type { HouseSlot } from "@/lib/village/layout";
import { VILLAGE_COLORS } from "@/lib/village/theme";

/** 우체통 색 (KayKit Holiday Bits 그림체에 맞춘 부드러운 색) */
const MAILBOX_PALETTE = {
  post: "#7b4a2a",
  body: "#b8283b",
  roof: "#f4ead2",
  slot: "#3a2230",
};

/**
 * 우체통 겉모양: 통통한 오두막 모양 (모서리가 둥근 상자 + 눈 쌓인 맞배지붕). 앞면은 +z 방향입니다.
 * 모양을 바꾸고 싶으면 아래 PARTS 표만 고치면 됩니다.
 *
 * ⚡ 11.25 성능 개선: 상자 5개를 따로 그리지 않고 "한 덩어리"로 합쳐 둡니다.
 *    부품마다 색이 달라서, 색은 꼭짓점마다 적어 둡니다(vertexColors). 모든 우체통이 이 모양·재질을 같이 씁니다.
 */
const PARTS: { size: [number, number, number]; radius: number; position: [number, number, number]; tilt?: number; color: string }[] = [
  // 기둥
  { size: [0.2, 0.8, 0.2], radius: 0.05, position: [0, 0.4, 0], color: MAILBOX_PALETTE.post },
  // 몸통
  { size: [0.7, 0.5, 0.7], radius: 0.08, position: [0, 1.05, 0], color: MAILBOX_PALETTE.body },
  // 맞배지붕: 눈 쌓인 두꺼운 판 두 장을 기울여 붙임
  { size: [0.5, 0.12, 0.86], radius: 0.05, position: [-0.2, 1.42, 0], tilt: 0.62, color: MAILBOX_PALETTE.roof },
  { size: [0.5, 0.12, 0.86], radius: 0.05, position: [0.2, 1.42, 0], tilt: -0.62, color: MAILBOX_PALETTE.roof },
  // 편지 구멍
  { size: [0.4, 0.06, 0.04], radius: 0.02, position: [0, 1.0, 0.36], color: MAILBOX_PALETTE.slot },
];

let mailboxModel: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } | null = null;
function getMailboxModel() {
  if (mailboxModel) return mailboxModel;
  const color = new THREE.Color();
  const pieces = PARTS.map((part) => {
    const g = new RoundedBoxGeometry(...part.size, 3, part.radius);
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...part.position),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), part.tilt ?? 0),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    // 이 부품의 모든 꼭짓점에 같은 색을 적어 둡니다
    color.set(part.color);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const geometry = mergeGeometries(pieces);
  pieces.forEach((g) => g.dispose());
  mailboxModel = { geometry, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }) };
  return mailboxModel;
}

/** 우체통 크기 배율 (집 크기에 맞춰 조금 키움. 손가락으로 누르기 쉽게) */
const MAILBOX_SCALE = 1.5;
/** 몸통 앞에 건 리스의 자리 (우체통 안쪽 좌표) */
const WREATH_LOCAL = placement([0, 1.15, 0.4], 0, 0.22);

/** 모든 우체통의 리스를 한 번에 그립니다 (KayKit wreath). 우체통처럼 반투명한 집 뒤에서도 또렷하게 보입니다 */
export function MailboxWreaths({ slots }: { slots: HouseSlot[] }) {
  const matrices = useMemo(
    () => slots.map((s) => placement([s.mailbox.x, 0, s.mailbox.z], s.rotation, MAILBOX_SCALE).multiply(WREATH_LOCAL)),
    [slots],
  );
  return <InstancedKit pack="kaykit" name="wreath" matrices={matrices} showThrough />;
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
  const model = getMailboxModel();
  // 반투명해진 집 뒤에 있어도 우체통은 흐려지지 않고 또렷하게 보이게 합니다 (11.25 사용자 요청)
  useEffect(() => {
    if (group.current) markShowThrough(group.current);
  }, [sent]);

  return (
    <group
      ref={group}
      position={position}
      rotation={[0, rotation, 0]}
      scale={MAILBOX_SCALE}
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

      <mesh geometry={model.geometry} material={model.material} />

      {/* "보냄" 표시: 노란 불. meshBasicMaterial은 조명과 상관없이 밝게 보입니다 */}
      {sent && (
        <>
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshBasicMaterial color={VILLAGE_COLORS.sentLight} />
          </mesh>
          {/* 불 둘레로 퍼지는 빛 (항상 카메라를 보는 그림 한 장) */}
          <sprite position={[0, 1.55, 0]} scale={0.75}>
            <spriteMaterial
              map={softDot()}
              color={VILLAGE_COLORS.sentLight}
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        </>
      )}
    </group>
  );
}
