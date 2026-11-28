// 진행률 게이지의 장식 그림 10개입니다. (F008)
// 그림 파일을 따로 두지 않고 코드(SVG)로 그립니다. 이모지는 휴대폰마다 모양이 달라서 쓰지 않습니다.
// 💡 SVG: 점·선·도형을 좌표로 적어서 그리는 그림 형식. 아무리 키워도 깨지지 않습니다. 여기서는 32×32 칸 위에 그립니다.

import type { ReactNode } from "react";
import type { DecorKey } from "@/lib/decor/decorTable";

const RED = "#e8504a";
const GREEN = "#3f9d63";
const GOLD = "#f4b93e";
const BLUE = "#6c9be8";
const WHITE = "#ffffff";
const BROWN = "#9a6a43";
const PINE = "#2f7d4f";

/** 다섯 꼭지 별의 꼭짓점들 (가운데 cx·cy, 바깥 반지름 r) */
function starPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ");
}

/** 트리 모양 (전구 줄 단계에서 함께 씀) */
const tree = (
  <>
    <rect x="14.5" y="25" width="3" height="4" rx="0.8" fill={BROWN} />
    <path d="M16 3 L25 26 H7 Z" fill={PINE} />
  </>
);

const ICONS: Record<DecorKey, ReactNode> = {
  // 10% 가로등 전구 줄: 늘어진 줄에 전구 세 개
  string_lights: (
    <>
      <path d="M3 9 Q16 21 29 9" fill="none" stroke="#5b6480" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.5" cy="16" r="3.4" fill={RED} />
      <circle cx="16" cy="19" r="3.4" fill={GOLD} />
      <circle cx="23.5" cy="16" r="3.4" fill={BLUE} />
    </>
  ),
  // 20% 빨간 방울 · 초록 방울
  red_bauble: (
    <>
      <rect x="9.6" y="5" width="3.6" height="3" rx="0.8" fill={GOLD} />
      <circle cx="11.4" cy="16" r="8.4" fill={RED} />
      <circle cx="8.6" cy="13" r="2" fill={WHITE} opacity="0.55" />
      <rect x="21.4" y="13.4" width="2.8" height="2.4" rx="0.6" fill={GOLD} />
      <circle cx="22.8" cy="21.6" r="6" fill={GREEN} />
    </>
  ),
  // 30% 트리 전구 줄: 트리에 알록달록한 점
  tree_lights: (
    <>
      {tree}
      <circle cx="16" cy="10" r="1.6" fill={RED} />
      <circle cx="13" cy="16" r="1.6" fill={GOLD} />
      <circle cx="19" cy="18" r="1.6" fill={BLUE} />
      <circle cx="11.5" cy="22.5" r="1.6" fill={BLUE} />
      <circle cx="16.5" cy="23" r="1.6" fill={RED} />
      <circle cx="21" cy="22.5" r="1.6" fill={GOLD} />
    </>
  ),
  // 40% 산타 양말
  stocking: (
    <>
      <path d="M11 9 H20 V19 L24.5 22.5 A4 4 0 0 1 22 29 H16 A5 5 0 0 1 11 24 Z" fill={RED} />
      <rect x="9.5" y="4" width="12" height="6.5" rx="2.2" fill={WHITE} stroke="#e3e5ee" strokeWidth="1" />
    </>
  ),
  // 50% 집 장식 · 지붕 전구 줄
  house_decor: (
    <>
      <rect x="7" y="15" width="18" height="13" rx="1.5" fill="#c98a5a" />
      <path d="M3.5 16 L16 5 L28.5 16 Z" fill="#8a3b3b" />
      <rect x="13.6" y="20" width="4.8" height="8" rx="1" fill="#6b4226" />
      <circle cx="8" cy="14" r="1.7" fill={GOLD} />
      <circle cx="12" cy="10.6" r="1.7" fill={GREEN} />
      <circle cx="20" cy="10.6" r="1.7" fill={BLUE} />
      <circle cx="24" cy="14" r="1.7" fill={RED} />
    </>
  ),
  // 60% 눈송이: 가지 여섯 개
  snowflake: (
    <g stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" fill="none">
      {[0, 60, 120].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 16 16)`}>
          <path d="M16 4 V28" />
          <path d="M16 8.5 L13 6 M16 8.5 L19 6 M16 23.5 L13 26 M16 23.5 L19 26" />
        </g>
      ))}
    </g>
  ),
  // 70% 루돌프 썰매: 빨간 코 루돌프 얼굴
  santa_rudolph: (
    <>
      <path d="M10 11 L7 4 M8.6 8 L5 7.6 M22 11 L25 4 M23.4 8 L27 7.6" stroke={BROWN} strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="16" cy="18.5" rx="8.4" ry="9.4" fill="#b98052" />
      <circle cx="12.6" cy="16" r="1.4" fill="#2b2118" />
      <circle cx="19.4" cy="16" r="1.4" fill="#2b2118" />
      <circle cx="16" cy="22.6" r="3.4" fill={RED} />
    </>
  ),
  // 80% 오너먼트 업그레이드: 줄무늬 금빛 방울과 반짝임
  ornament_upgrade: (
    <>
      <rect x="12.2" y="5" width="3.6" height="3" rx="0.8" fill="#b9892b" />
      <circle cx="14" cy="18" r="9.4" fill={GOLD} />
      <path d="M5.4 14.6 Q14 19 22.6 14.6 M5.2 21 Q14 25.4 22.8 21" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M25.5 3 L26.7 6.3 L30 7.5 L26.7 8.7 L25.5 12 L24.3 8.7 L21 7.5 L24.3 6.3 Z" fill={GOLD} />
    </>
  ),
  // 90% 금빛 전구 줄: 트리에 금빛 점이 가득
  tree_lights_upgrade: (
    <>
      {tree}
      <g fill="#ffe08a">
        <circle cx="16" cy="9" r="1.5" />
        <circle cx="14" cy="13.5" r="1.5" />
        <circle cx="18" cy="14.5" r="1.5" />
        <circle cx="12.5" cy="18.5" r="1.5" />
        <circle cx="16.4" cy="19" r="1.5" />
        <circle cx="20" cy="19.5" r="1.5" />
        <circle cx="10.5" cy="23.2" r="1.5" />
        <circle cx="14.4" cy="23.6" r="1.5" />
        <circle cx="18.2" cy="23.6" r="1.5" />
        <circle cx="21.8" cy="23.2" r="1.5" />
      </g>
    </>
  ),
  // 100% 대왕별
  star: <polygon points={starPoints(16, 17, 13.5)} fill={GOLD} stroke="#e09a1c" strokeWidth="1" strokeLinejoin="round" />,
};

/** 장식 종류에 맞는 그림 하나 */
export function GaugeIcon({ kind, className }: { kind: DecorKey; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {ICONS[kind]}
    </svg>
  );
}
