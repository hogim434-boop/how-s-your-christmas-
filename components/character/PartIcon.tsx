// 꾸미기 창의 부위 탭에 쓰는 작은 선 그림(아이콘)입니다. 상의·하의·장갑·목도리·신발.
// 💡 글자만 있는 탭보다 그림이 있으면 한눈에 구분되고, 언어가 달라도 같은 모양으로 보입니다.

import type { PartKey } from "@/lib/character/parts";

/** 부위별 그림의 선 (24×24 칸 기준) */
const PATHS: Record<PartKey, string[]> = {
  // 상의: 양팔을 벌린 스웨터
  top: ["M8.5 3.5 3 7l2 3.5 2-1V20h10V9.5l2 1L21 7l-5.5-3.5c-.8 1.9-6.2 1.9-7 0Z"],
  // 하의: 바지
  bottom: ["M7 3.5h10l1 17h-4.6L12 9.5l-1.4 11H6l1-17Z", "M7 7h10"],
  // 장갑: 벙어리장갑과 손목단
  gloves: ["M8 20.5v-6.2c-1.6-1-2.1-2.9-1.5-4.6l1.2-3.4a2.1 2.1 0 0 1 4 1.2l-.4 2h3.2a2.5 2.5 0 0 1 2.5 2.5v8.5H8Z", "M8 17h9"],
  // 목도리: 목에 두른 고리와 늘어진 자락
  scarf: ["M5.5 7.5c0-2 2.9-3.5 6.5-3.5s6.5 1.500 6.500 3.500-2.900 3.500-6.500 3.500-6.500-1.500-6.500-3.500Z", "M13.500 11v9.500h4.500V9.800", "M13.500 17.500h4.500"],
  // 신발: 발목까지 오는 부츠
  shoes: ["M8 3.500h5.500v8l5.300 2.300a2 2 0 0 1 1.200 1.800V19.500H8v-16Z", "M8 16.500h12"],
};

export function PartIcon({ part, className }: { part: PartKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[part].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
