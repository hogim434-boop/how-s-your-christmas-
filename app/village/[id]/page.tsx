// 마을 화면 주소입니다. 예: /village/demo?n=6&level=0
// (로드맵 Task 004. 지금은 가짜 데이터로 그립니다)
//
// Next.js 16: params(주소의 [id] 부분)와 searchParams(?뒤 값)는 Promise라서 await로 꺼냅니다.
// 이 프로젝트는 cacheComponents 모드라서, 이런 "요청마다 달라지는 값"을 읽는 부분은
// <Suspense>로 감싸야 합니다. (감싸지 않으면 빌드·실행 때 오류가 납니다)

import { Suspense } from "react";
import VillageLoader from "@/components/village/VillageLoader";
import { parseDummyOptions } from "@/lib/dummy/village";
import { VILLAGE_COLORS } from "@/lib/village/theme";

// params·searchParams를 읽어서 3D 화면에 넘기는 부분
async function VillageContent({ params, searchParams }: PageProps<"/village/[id]">) {
  const { id } = await params;
  const options = parseDummyOptions(await searchParams);
  return <VillageLoader id={id} options={options} />;
}

export default function VillagePage(props: PageProps<"/village/[id]">) {
  return (
    // 값을 읽는 동안에는 하늘색 바탕을 보여 줍니다
    <Suspense fallback={<div className="h-dvh w-full" style={{ backgroundColor: VILLAGE_COLORS.sky }} />}>
      <VillageContent {...props} />
    </Suspense>
  );
}
