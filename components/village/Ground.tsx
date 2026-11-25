"use client";

// 눈 덮인 땅(흰색)과 가운데 광장(베이지 원판)입니다.
// 땅을 눌렀을 때 그 3D 좌표를 onGroundPointerDown으로 알려 줍니다. (나중에 캐릭터 걷기에 사용)

import type { ThreeEvent } from "@react-three/fiber";
import { PLAZA_RADIUS } from "@/lib/village/layout";
import { VILLAGE_COLORS } from "@/lib/village/theme";
import { useNight } from "./nightContext";

interface GroundProps {
  /** 눈밭 반지름 */
  radius: number;
  /** 땅을 눌렀을 때 호출. point = 눌린 곳의 3D 좌표 */
  onGroundPointerDown?: (point: { x: number; y: number; z: number }) => void;
}

export function Ground({ radius, onGroundPointerDown }: GroundProps) {
  // 밤에는 스스로 빛나는 효과(emissive)를 끕니다.
  // 낮에는 눈을 하얗게 보이려고 켜 두지만, 밤에는 이 빛이 "빛 번짐" 효과에 걸려 화면 전체가 뿌옇게 됩니다.
  // (11.25 수정: 캐릭터가 뿌옇게 보이던 원인) 시안의 밤 눈밭도 스스로 빛나지 않습니다.
  const night = useNight();
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    onGroundPointerDown?.({ x: e.point.x, y: e.point.y, z: e.point.z });
  };

  return (
    <group>
      {/* 눈밭: 납작한 원판 */}
      <mesh position={[0, -0.05, 0]} onPointerDown={handlePointerDown}>
        <cylinderGeometry args={[radius, radius, 0.1, 64]} />
        <meshStandardMaterial color={VILLAGE_COLORS.ground} emissive="#ffffff" emissiveIntensity={night ? 0 : 0.8} />
      </mesh>
      {/* 광장: 눈밭보다 아주 조금 위에 얹은 베이지 원판 */}
      <mesh position={[0, 0.02, 0]} onPointerDown={handlePointerDown}>
        <cylinderGeometry args={[PLAZA_RADIUS, PLAZA_RADIUS, 0.04, 64]} />
        <meshStandardMaterial color={VILLAGE_COLORS.plaza} emissive={VILLAGE_COLORS.plaza} emissiveIntensity={night ? 0 : 0.3} />
      </mesh>
    </group>
  );
}
