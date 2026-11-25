"use client";

// 집 위에 떠 있는 주민 이름표입니다.
//
// 이름표 글자는 3D 안이 아니라 "화면 위 일반 HTML"로 그립니다. (일본어·한국어 글꼴을 그대로 쓰기 위해)
// 두 부분으로 나뉩니다.
//  - NameTagLayer: 글자 상자들(HTML). 3D 바깥(VillageView)에 둡니다.
//  - NameTagProjector: 3D 장면 안에서 매 프레임 "집의 3D 좌표 → 화면 좌표"를 계산해
//    글자 상자를 그 자리로 옮겨 줍니다.

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type NameTagData = {
  id: string;
  label: string;
  /** "내 집"이면 강조 색 */
  isMe: boolean;
  /** 이름표가 떠 있을 3D 좌표 */
  position: [number, number, number];
};

/** 글자 상자의 HTML id. Projector가 이 id로 상자를 찾아 위치를 옮깁니다. */
const tagElementId = (id: string) => `name-tag-${id}`;

interface NameTagLayerProps {
  tags: NameTagData[];
}

/** 이름표 글자 상자 모음 (3D 위에 겹쳐 보이며 터치는 통과시킵니다) */
export function NameTagLayer({ tags }: NameTagLayerProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      {tags.map((tag) => (
        <span
          key={tag.id}
          id={tagElementId(tag.id)}
          // 처음엔 숨겨 두고, 위치가 계산되면 보이게 합니다
          className={
            "absolute left-0 top-0 select-none whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs shadow-sm " +
            (tag.isMe ? "bg-[#232b52] text-[#fff6e5]" : "bg-[#fff6e5]/90 text-[#232b52]")
          }
          style={{ visibility: "hidden" }}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}

interface NameTagProjectorProps {
  tags: NameTagData[];
}

/** 3D 장면 안에서 이름표의 화면 위치를 매 프레임 계산합니다. (화면에는 아무것도 그리지 않음) */
export function NameTagProjector({ tags }: NameTagProjectorProps) {
  const size = useThree((s) => s.size);
  // 계산용 임시 좌표. 매 프레임 새로 만들지 않도록 한 번만 만들어 재사용합니다
  const point = new THREE.Vector3();

  useFrame(({ camera }) => {
    camera.updateMatrixWorld();
    for (const tag of tags) {
      const el = document.getElementById(tagElementId(tag.id));
      if (!el) continue;
      point.set(...tag.position).project(camera); // -1~1 범위의 화면 좌표로 변환
      const x = (point.x * 0.5 + 0.5) * size.width;
      const y = (-point.y * 0.5 + 0.5) * size.height;
      // point.z > 1이면 카메라 뒤쪽이라 보이지 않습니다
      el.style.visibility = point.z > 1 ? "hidden" : "visible";
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  });

  return null;
}
