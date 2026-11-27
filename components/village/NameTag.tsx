"use client";

// 집 위에 떠 있는 주민 이름표입니다.
//
// 이름표 글자는 3D 안이 아니라 "화면 위 일반 HTML"로 그립니다. (일본어·한국어 글꼴을 그대로 쓰기 위해)
// 두 부분으로 나뉩니다.
//  - NameTagLayer: 글자 상자들(HTML). 3D 바깥(VillageView)에 둡니다.
//  - NameTagProjector: 3D 장면 안에서 매 프레임 "집의 3D 좌표 → 화면 좌표"를 계산해
//    글자 상자를 그 자리로 옮겨 줍니다.
//
// 함께 걷기(Task 025-2): 다른 주민 캐릭터의 머리 위 이름표도 같은 방식입니다.
//  - RemoteNameTagLayer: 다른 주민의 글자 상자들(HTML)
//  - placeRemoteNameTag: 캐릭터가 움직일 때마다 RemotePlayers.tsx가 불러서 글자 상자를 옮깁니다

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useOnlineIds, type OnlineStore } from "@/lib/village/onlineStore";
import { useRemoteIds, type RemoteStore } from "@/lib/village/remoteStore";

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
  /** 함께 걷기: 접속 중인 주민 목록. 주면 그 주민의 집 이름표에 초록 점을 붙입니다 (Task 025-6) */
  onlineStore?: OnlineStore;
}

/** 이름표 글자 상자 모음 (3D 위에 겹쳐 보이며 터치는 통과시킵니다) */
export function NameTagLayer({ tags, onlineStore }: NameTagLayerProps) {
  // 누가 들어오거나 나갈 때만 바뀌는 목록 (걸어 다니는 것으로는 다시 그려지지 않습니다)
  const onlineIds = useOnlineIds(onlineStore);
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
          {/* 접속 중 표시: 지금 이 마을에 들어와 있는 주민의 집에 작은 초록 점 (3D가 아니라 글자 상자 안의 CSS 동그라미) */}
          {!tag.isMe && onlineIds.includes(tag.id) && (
            <span
              data-online-dot
              className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500 align-middle ring-1 ring-white/80"
            />
          )}
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

// ── 다른 주민 캐릭터의 머리 위 이름표 (Task 025-2) ──

/** 다른 주민 이름표의 HTML id */
const remoteTagElementId = (id: string) => `remote-name-tag-${id}`;

interface RemoteNameTagLayerProps {
  store: RemoteStore;
  /** 주민 id → 이름. 여기에 없는 주민은 이름표를 띄우지 않습니다 */
  names: Record<string, string>;
}

/** 다른 주민 이름표의 글자 상자 모음. 주민이 들어오거나 나갈 때만 다시 그려집니다 */
export function RemoteNameTagLayer({ store, names }: RemoteNameTagLayerProps) {
  const ids = useRemoteIds(store);
  if (ids.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      {ids.map((id) =>
        names[id] ? (
          <span
            key={id}
            id={remoteTagElementId(id)}
            // 집 이름표보다 조금 작고 진하게: "집"이 아니라 "사람"의 이름표임을 구분합니다
            className="absolute left-0 top-0 select-none whitespace-nowrap rounded-full bg-[#232b52]/80 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
            style={{ visibility: "hidden" }}
          >
            {names[id]}
          </span>
        ) : null,
      )}
    </div>
  );
}

/**
 * 이름표 글자 상자와, 마지막으로 적어 둔 값. (Task 026)
 * ⚡ 매 장면 주민 수만큼 "글자 상자 찾기 + 자리 적기"를 하면 브라우저가 그만큼 화면 배치를 다시 계산합니다.
 *    찾은 상자를 기억해 두고, 값이 지난번과 같으면(서 있고 카메라도 그대로면) 적지 않습니다. 보이는 모습은 같습니다.
 */
const remoteTagCache = new Map<string, { el: HTMLElement; transform: string; visible: boolean }>();

function remoteTag(id: string) {
  let tag = remoteTagCache.get(id);
  // 상자가 화면에서 빠졌으면(주민이 나갔다 다시 들어온 경우 등) 새로 찾습니다
  if (tag && !tag.el.isConnected) {
    remoteTagCache.delete(id);
    tag = undefined;
  }
  if (!tag) {
    const el = document.getElementById(remoteTagElementId(id));
    if (!el) return null;
    // 처음 상태는 "숨김" (RemoteNameTagLayer가 그렇게 그립니다)
    tag = { el, transform: "", visible: false };
    remoteTagCache.set(id, tag);
  }
  return tag;
}

/**
 * 다른 주민 한 명의 이름표를 화면 위 알맞은 자리로 옮깁니다. (3D 장면의 useFrame 안에서 부릅니다)
 * - point: 이름표가 떠 있을 3D 좌표. ⚠️ 계산 과정에서 이 값을 고쳐 씁니다 (임시 좌표를 넘기세요)
 */
export function placeRemoteNameTag(
  id: string,
  point: THREE.Vector3,
  camera: THREE.Camera,
  size: { width: number; height: number },
) {
  const tag = remoteTag(id);
  if (!tag) return;
  point.project(camera); // -1~1 범위의 화면 좌표로 변환
  // 카메라 뒤쪽이거나 화면 밖이면 숨깁니다
  if (point.z > 1 || Math.abs(point.x) > 1.2 || Math.abs(point.y) > 1.2) {
    if (tag.visible) {
      tag.visible = false;
      tag.el.style.visibility = "hidden";
    }
    return;
  }
  const x = (point.x * 0.5 + 0.5) * size.width;
  const y = (-point.y * 0.5 + 0.5) * size.height;
  const transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  if (transform !== tag.transform) {
    tag.transform = transform;
    tag.el.style.transform = transform;
  }
  if (!tag.visible) {
    tag.visible = true;
    tag.el.style.visibility = "visible";
  }
}
