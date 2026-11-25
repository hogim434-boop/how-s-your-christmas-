"use client";

// 우체통 위에 떠오르는 "편지 쓰기" 말풍선 버튼입니다. (11.25 사용자 요청: A안)
// 캐릭터가 우체통 가까이 가면 나타나고, 멀어지면 사라집니다.
// (게임에서 흔한 "가까이 가면 뜨는 버튼", 예: Roblox의 ProximityPrompt 방식)
//
// 이름표(NameTag.tsx)와 같은 구조로 두 부분입니다.
//  - MailboxPromptProjector: 3D 장면 안. 매 프레임 가장 가까운 우체통을 찾고, 버튼을 그 우체통 위로 옮깁니다.
//  - MailboxPromptLayer: 3D 바깥의 HTML 버튼. (일본어·한국어 글꼴과 터치를 그대로 쓰기 위해)

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mail } from "lucide-react";
import * as THREE from "three";
import { PLAYER_OBJECT_NAME } from "./FollowCamera";
import { nearestSpot, type Spot } from "@/lib/village/proximity";

/** 버튼 HTML id. Projector가 이 id로 버튼을 찾아 위치를 옮깁니다 */
const PROMPT_ELEMENT_ID = "mailbox-prompt";
/** 말풍선이 떠 있을 높이 (우체통 지붕보다 조금 위) */
const PROMPT_HEIGHT = 3.1;

interface ProjectorProps {
  /** 우체통 자리 목록 (id = 주민 id) */
  spots: Spot[];
  /** 가장 가까운 우체통이 바뀌었을 때 (없으면 null). 바뀔 때만 불립니다 */
  onNearChange: (residentId: string | null) => void;
}

export function MailboxPromptProjector({ spots, onNearChange }: ProjectorProps) {
  const size = useThree((s) => s.size);
  // 계산용 임시 좌표. 매 프레임 새로 만들지 않도록 재사용합니다
  const point = useMemo(() => new THREE.Vector3(), []);
  // 지난 프레임에 가까웠던 우체통. 같은 값이면 React에 알리지 않아 화면을 쓸데없이 다시 그리지 않습니다
  const nearRef = useRef<string | null>(null);

  useFrame(({ camera, scene }) => {
    const player = scene.getObjectByName(PLAYER_OBJECT_NAME);
    if (!player) return;
    const near = nearestSpot({ x: player.position.x, z: player.position.z }, spots);
    const nearId = near?.id ?? null;
    if (nearId !== nearRef.current) {
      nearRef.current = nearId;
      onNearChange(nearId);
    }

    const el = document.getElementById(PROMPT_ELEMENT_ID);
    if (!el || !near) return;
    camera.updateMatrixWorld();
    point.set(near.x, PROMPT_HEIGHT, near.z).project(camera); // -1~1 범위의 화면 좌표로 변환
    const x = (point.x * 0.5 + 0.5) * size.width;
    const y = (-point.y * 0.5 + 0.5) * size.height;
    el.style.visibility = point.z > 1 ? "hidden" : "visible";
    // 말풍선 꼬리 끝이 우체통 위를 가리키도록 버튼을 위쪽으로 올려 놓습니다
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  });

  return null;
}

interface LayerProps {
  /** 버튼에 쓸 글자. null이면 버튼을 숨깁니다 */
  label: string | null;
  /** 이미 편지를 보낸 친구면 작은 "보냄" 표시 */
  sentLabel?: string;
  onPress: () => void;
}

export function MailboxPromptLayer({ label, sentLabel, onPress }: LayerProps) {
  if (!label) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div
        id={PROMPT_ELEMENT_ID}
        className="absolute left-0 top-0"
        // 위치가 계산되기 전(첫 프레임)에는 숨겨 둡니다
        style={{ visibility: "hidden" }}
      >
        {/* 안쪽만 "톡" 튀어나오는 움직임. 동작 줄이기 설정을 켠 사람에게는 움직이지 않습니다 */}
        <div className="flex origin-bottom flex-col items-center motion-safe:animate-[prompt-pop_220ms_ease-out]">
          <button
            type="button"
            onClick={onPress}
            className="pointer-events-auto flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#232b52]/10 bg-white px-4 py-2 text-sm font-semibold text-[#232b52] shadow-[0_6px_20px_rgba(20,26,54,0.22)] active:scale-95"
          >
            <Mail className="size-4 text-[#b8283b]" aria-hidden="true" />
            {label}
            {sentLabel && (
              <span className="ml-1 rounded-full bg-[#232b52]/10 px-1.5 py-0.5 text-[10px]">{sentLabel}</span>
            )}
          </button>
          {/* 말풍선 꼬리 */}
          <span
            aria-hidden="true"
            className="-mt-px size-0 border-x-8 border-t-8 border-x-transparent border-t-white"
          />
        </div>
      </div>
    </div>
  );
}
