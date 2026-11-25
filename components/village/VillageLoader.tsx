"use client";

// 마을 화면을 "브라우저에서만" 불러오는 연결 파일입니다. (SceneLoader와 같은 방식)
// 3D는 서버에서 그릴 수 없어서 ssr: false를 쓰는데, 이 옵션은 "use client" 파일에서만 가능합니다.

import dynamic from "next/dynamic";
import type { DummyOptions } from "@/lib/dummy/village";
import { VILLAGE_COLORS } from "@/lib/village/theme";

const VillageView = dynamic(() => import("./VillageView"), {
  ssr: false,
  // 불러오는 동안에는 하늘색 바탕만 보여 줍니다.
  loading: () => <div className="h-dvh w-full" style={{ backgroundColor: VILLAGE_COLORS.sky }} />,
});

interface VillageLoaderProps {
  id: string;
  options: DummyOptions;
}

export default function VillageLoader({ id, options }: VillageLoaderProps) {
  return <VillageView id={id} options={options} />;
}
