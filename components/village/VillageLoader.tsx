"use client";

// 마을 화면을 "브라우저에서만" 불러오는 연결 파일입니다. (SceneLoader와 같은 방식)
// 3D는 서버에서 그릴 수 없어서 ssr: false를 쓰는데, 이 옵션은 "use client" 파일에서만 가능합니다.

import dynamic from "next/dynamic";
import type { Notice } from "@/lib/auth/next";
import type { DummyOptions } from "@/lib/dummy/village";
import type { VillageData } from "@/lib/village/data";
import { VILLAGE_COLORS } from "@/lib/village/theme";

const VillageView = dynamic(() => import("./VillageView"), {
  ssr: false,
  // 불러오는 동안에는 하늘색 바탕만 보여 줍니다.
  loading: () => <div className="h-dvh w-full" style={{ backgroundColor: VILLAGE_COLORS.sky }} />,
});

interface VillageLoaderProps {
  id: string;
  options: DummyOptions;
  /** 데이터베이스에서 읽은 진짜 마을 (연습용 마을이면 없음) */
  village?: VillageData;
  /** 들어오자마자 띄울 안내 (주민이 아닌 마을에서 튕겨 왔을 때) */
  notice?: Notice;
  /** 함께 걷기(같은 마을에 접속한 주민이 서로 보이는 기능)를 켤지. 서버 환경 변수 LIVE_WALK=1 일 때만 true */
  liveWalk?: boolean;
}

export default function VillageLoader({ id, options, village, notice, liveWalk }: VillageLoaderProps) {
  return <VillageView id={id} options={options} village={village} notice={notice} liveWalk={liveWalk} />;
}
