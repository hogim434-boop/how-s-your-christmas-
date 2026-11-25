// 편지지마다의 "생김새"입니다: 바탕 무늬, 줄 색, 고르기 버튼의 색, 구석 장식.
// 그림 파일을 쓰지 않고 CSS(색 번짐·반복 무늬)로만 그려서 용량이 늘지 않습니다.
// 편지지 이름(키) 목록은 lib/letters/papers.ts에 있습니다.

import type { CSSProperties } from "react";
import type { PaperKey } from "@/lib/letters/papers";

export type PaperLook = {
  /** 편지지 바탕 (색 + 무늬) */
  background: CSSProperties;
  /** 글줄 아래에 그어지는 줄의 색 */
  line: string;
  /** 고르기 버튼에 보이는 대표 색 */
  swatch: string;
  /** 편지지 구석에 옅게 비치는 장식 그림 (이모지) */
  mark: string;
};

export const PAPER_LOOK: Record<PaperKey, PaperLook> = {
  // 기본: 따뜻한 크림색 종이
  plain: {
    background: { backgroundColor: "#fffaf0" },
    line: "#eadfc8",
    swatch: "#f6e7c6",
    mark: "✉️",
  },
  // 눈: 옅은 하늘색 바탕에 흰 눈송이 점
  snow: {
    background: {
      backgroundColor: "#eef4fc",
      backgroundImage:
        "radial-gradient(circle, #ffffff 0 2.5px, transparent 3px), radial-gradient(circle, #ffffff 0 1.5px, transparent 2px)",
      backgroundSize: "56px 56px, 34px 34px",
      backgroundPosition: "8px 12px, 26px 30px",
    },
    line: "#d3e0f2",
    swatch: "#bcd3f2",
    mark: "❄️",
  },
  // 트리: 옅은 초록 바탕에 가는 사선 무늬
  tree: {
    background: {
      backgroundColor: "#f0f7ee",
      backgroundImage: "repeating-linear-gradient(135deg, rgba(47,143,91,0.06) 0 2px, transparent 2px 14px)",
    },
    line: "#d2e5cf",
    swatch: "#a9d3ae",
    mark: "🎄",
  },
  // 지팡이 사탕: 옅은 분홍 바탕, 맨 위에 빨강·흰 줄무늬 띠
  candy: {
    background: {
      backgroundColor: "#fff5f5",
      backgroundImage: "repeating-linear-gradient(135deg, #e0566c 0 10px, #ffffff 10px 20px)",
      backgroundSize: "100% 8px",
      backgroundRepeat: "no-repeat",
    },
    line: "#f3d5d9",
    swatch: "#f0a3ae",
    mark: "🎁",
  },
};
