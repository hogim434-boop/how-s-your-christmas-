// 마을 목록의 칸마다 들어가는 "마을 그림"입니다. (F017, 로드맵 Task 017 — 11.28 사용자 요청: 칸마다 마을 이미지)
//
// 💡 사진이 아니라 코드로 그리는 작은 삽화(SVG)입니다. 마을마다 저장해 둔 사진이 없기 때문에,
//    마을의 "지금 상태"를 읽어 그때그때 그립니다.
//      - 장식 단계(0~10)가 높을수록 트리의 전구가 늘어납니다. 10단계면 꼭대기에 별이 빛납니다
//      - 주민 수만큼 집이 늘어납니다 (그림에는 6채까지)
//      - 커플 마을은 집 2채와 하트로 구분합니다
// 💡 같은 마을은 언제 그려도 같은 그림이어야 하므로, 무작위(Math.random) 대신 마을 번호로 정해지는 숫자를 씁니다.
//
// 꾸밈용 그림이라 화면 읽기 도구는 건너뜁니다 (aria-hidden). 설명은 칸의 글자가 맡습니다.

import { useId } from "react";
import type { VillageKind } from "@/types/domain";
import { VILLAGE_COLORS } from "@/lib/village/theme";

/** 그림의 크기 (가로 2 : 세로 1) */
const W = 320;
const H = 160;
/** 그림에 그리는 집의 최대 수 */
const MAX_HOUSES = 6;
/** 집이 서는 자리 (x, 땅 높이 y, 크기). 트리 양옆으로 번갈아, 가까운 자리부터 채웁니다 */
const HOUSE_SPOTS: [number, number, number][] = [
  [92, 128, 1],
  [228, 128, 1],
  [44, 122, 0.82],
  [276, 122, 0.82],
  [134, 114, 0.6],
  [190, 114, 0.6],
];
/** 전구 색 (마을 화면의 트리 전구와 비슷한 색) */
const BULB_COLORS = ["#ffd66b", "#ff6b6b", "#7fd4ff", "#9be38a", "#ffffff"];
/** 장식 1단계마다 늘어나는 전구 수 */
const BULBS_PER_LEVEL = 3;
/** 트리의 세 층: [꼭짓점 y, 밑변 y, 밑변의 반 너비] */
const TREE_LAYERS: [number, number, number][] = [
  [40, 78, 24],
  [58, 102, 33],
  [80, 128, 42],
];
const TREE_X = W / 2;

/** 글자(마을 번호)를 늘 같은 숫자로 바꿉니다 */
function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 씨앗 숫자에서 0~1 사이의 "정해진 무작위" 값을 차례로 꺼내는 함수를 만듭니다 */
function seededRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

interface VillageThumbProps {
  /** 마을 번호 (그림의 씨앗) */
  id: string;
  kind: VillageKind;
  residentCount: number;
  /** 장식 단계 0~10 */
  level: number;
  className?: string;
}

export function VillageThumb({ id, kind, residentCount, level, className }: VillageThumbProps) {
  // 한 화면에 그림이 여러 개 있어도 색 번짐(gradient) 이름이 겹치지 않게 그림마다 고유한 이름을 붙입니다
  const uid = useId();
  const sky = `${uid}-sky`;
  const glow = `${uid}-glow`;
  const random = seededRandom(seedOf(id));

  // 밤하늘의 별
  const stars = Array.from({ length: 16 }, () => ({ x: random() * W, y: random() * 70, r: 0.5 + random() * 0.9, o: 0.35 + random() * 0.5 }));

  // 집: 커플 마을은 2채, 친구 마을은 주민 수만큼 (최대 6채)
  const houseCount = Math.max(0, Math.min(MAX_HOUSES, kind === "couple" ? Math.min(2, residentCount) : residentCount));
  const wallShift = Math.floor(random() * VILLAGE_COLORS.walls.length);
  const houses = HOUSE_SPOTS.slice(0, houseCount).map(([x, y, s], i) => ({
    x,
    y,
    s,
    wall: VILLAGE_COLORS.walls[(i + wallShift) % VILLAGE_COLORS.walls.length],
  }));

  // 전구: 단계마다 3개씩. 단계가 올라가도 먼저 달린 전구의 자리는 그대로이도록, 늘 30개 자리를 정한 뒤 앞에서부터 씁니다
  const clamped = Math.max(0, Math.min(10, Math.floor(level)));
  const bulbs = Array.from({ length: 10 * BULBS_PER_LEVEL }, (_, i) => {
    const [top, bottom, half] = TREE_LAYERS[i % TREE_LAYERS.length];
    // t: 층 안에서의 높이 (0 = 꼭짓점, 1 = 밑변). 꼭짓점 가까이는 좁아서 조금 아래부터 씁니다
    const t = 0.35 + random() * 0.6;
    return {
      x: TREE_X + (random() * 2 - 1) * half * t * 0.85,
      y: top + (bottom - top) * t,
      color: BULB_COLORS[Math.floor(random() * BULB_COLORS.length)],
    };
  }).slice(0, clamped * BULBS_PER_LEVEL);
  const hasStar = clamped >= 10;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1330" />
          <stop offset="0.7" stopColor="#2a3566" />
          <stop offset="1" stopColor="#4a4f86" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${sky})`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.o} />
      ))}
      {/* 멀리 있는 눈 언덕과 가까운 눈밭 */}
      <ellipse cx={70} cy={150} rx={150} ry={46} fill="#c9d6ee" />
      <ellipse cx={270} cy={152} rx={140} ry={44} fill="#d6e0f3" />
      <ellipse cx={W / 2} cy={170} rx={230} ry={52} fill="#f4f7fd" />

      {/* 집: 뒤쪽(작은 집)부터 그려야 앞의 집이 가리지 않습니다 */}
      {[...houses].reverse().map((h) => (
        <g key={`${h.x}`} transform={`translate(${h.x} ${h.y}) scale(${h.s})`}>
          <rect x={-15} y={-20} width={30} height={20} rx={2} fill={h.wall} />
          {/* 눈 쌓인 지붕 */}
          <path d="M-20 -19 L0 -37 L20 -19 Z" fill="#8a4a43" />
          <path d="M-20 -19 L0 -37 L20 -19 L15 -21 L0 -33 L-15 -21 Z" fill="#ffffff" />
          {/* 불 켜진 창문 */}
          <rect x={-5} y={-14} width={10} height={9} rx={1.5} fill="#ffd98a" />
        </g>
      ))}

      {/* 트리: 100%면 꼭대기 별 둘레에 빛이 번집니다 */}
      {hasStar && <circle cx={TREE_X} cy={36} r={30} fill={`url(#${glow})`} />}
      <rect x={TREE_X - 4} y={124} width={8} height={12} fill={VILLAGE_COLORS.trunk} />
      {TREE_LAYERS.map(([top, bottom, half], i) => (
        <path key={i} d={`M${TREE_X} ${top} L${TREE_X + half} ${bottom} L${TREE_X - half} ${bottom} Z`} fill={i === 0 ? "#2f7d57" : i === 1 ? "#2a704e" : "#256546"} />
      ))}
      {bulbs.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={2.3} fill={b.color} />
      ))}
      {hasStar && <path d={starPath(TREE_X, 36, 9, 4)} fill="#ffe08a" />}

      {/* 커플 마을 표시: 트리 옆에 떠 있는 하트 */}
      {kind === "couple" && (
        <path
          transform={`translate(${TREE_X + 46} 52)`}
          d="M0 4 C-7 -3 -12 3 -7 9 L0 16 L7 9 C12 3 7 -3 0 4 Z"
          fill="#ff8fa3"
        />
      )}
    </svg>
  );
}

/** 뾰족한 끝이 5개인 별 모양의 선을 만듭니다 (바깥 반지름 outer, 안쪽 반지름 inner) */
function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  });
  return `M${points.join(" L")} Z`;
}
