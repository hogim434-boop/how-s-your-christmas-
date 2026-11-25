"use client";

// 아무것도 없는 빈 3D 장면입니다. (로드맵 Task 002: 3D가 휴대폰에서 뜨는지 확인용)
// 나중에 Task 004에서 이 자리에 광장·대왕 트리·집이 들어갑니다.
//
// "use client": 3D는 브라우저(휴대폰 화면)에서만 그릴 수 있어서,
// 이 파일은 서버가 아니라 브라우저에서 실행된다고 Next.js에 알려 줍니다.

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

/** 하늘색 (미니어처 낮 그림체 기준) */
const SKY_COLOR = "#eaf3fc";
/** 눈 덮인 땅 색 */
const SNOW_COLOR = "#ffffff";

export default function EmptyScene() {
  return (
    <Canvas
      // dpr: 화면 해상도 배율. 최신 휴대폰은 3배까지 올라가는데,
      // 2배로 제한해서 배터리와 속도를 아낍니다.
      dpr={[1, 2]}
      // 카메라 위치: 위쪽 뒤에서 마을 가운데를 내려다봅니다.
      camera={{ position: [0, 6, 12], fov: 45 }}
    >
      {/* 배경(하늘) 색 */}
      <color attach="background" args={[SKY_COLOR]} />

      {/* 조명 2개: 하늘·땅에서 은은하게 비추는 빛 + 해처럼 한쪽에서 비추는 빛 */}
      <hemisphereLight args={["#ffffff", "#c9d8ea", 1.2]} />
      <directionalLight position={[5, 10, 5]} intensity={1.0} />

      {/* 눈밭: 납작한 원기둥(원판). 나중에 마을이 이 위에 올라갑니다. */}
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[8, 8, 0.5, 64]} />
        <meshStandardMaterial color={SNOW_COLOR} />
      </mesh>

      {/* 손가락으로 끌면 화면을 돌려 볼 수 있게 해 줍니다 (확인용) */}
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={25}
        maxPolarAngle={Math.PI / 2.2} // 땅 밑으로 카메라가 내려가지 않게
      />
    </Canvas>
  );
}
