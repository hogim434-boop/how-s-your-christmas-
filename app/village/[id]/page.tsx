// 마을 화면 주소입니다. 예: /village/demo?n=6&level=0
// (로드맵 Task 004·007·008)
//  - /village/demo : 연습용 마을. 가짜 데이터로 그리고, 개발 중에는 로그인 없이 열립니다.
//                    배포된 서비스(운영)에서는 닫혀 있어서 처음 화면으로 보냅니다 (Task 010)
//  - 그 밖의 마을 : 로그인한 그 마을 주민만 볼 수 있고(lib/auth/session.ts의 requireResident),
//                   마을 이름·주민·장식 단계를 데이터베이스에서 읽어 그립니다 (lib/village/load.ts)
//
// Next.js 16: params(주소의 [id] 부분)와 searchParams(?뒤 값)는 Promise라서 await로 꺼냅니다.
// 이 프로젝트는 cacheComponents 모드라서, 이런 "요청마다 달라지는 값"을 읽는 부분은
// <Suspense>로 감싸야 합니다. (감싸지 않으면 빌드·실행 때 오류가 납니다)

import { Suspense } from "react";
import VillageLoader from "@/components/village/VillageLoader";
import { DEMO_VILLAGE_ID, devToolsEnabled, parseNotice } from "@/lib/auth/next";
import { redirect } from "next/navigation";
import { requireResident } from "@/lib/auth/session";
import { parseDummyOptions, withoutDevOptions } from "@/lib/dummy/village";
import { loadVillage } from "@/lib/village/load";
import { VILLAGE_COLORS } from "@/lib/village/theme";

// params·searchParams를 읽어서 3D 화면에 넘기는 부분
async function VillageContent({ params, searchParams }: PageProps<"/village/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const options = parseDummyOptions(query);
  // 다른 마을에서 튕겨 왔으면(?notice=not_resident) 안내를 띄웁니다
  const notice = parseNotice(Array.isArray(query.notice) ? query.notice[0] : query.notice);
  // 연습용 마을: 화면 쪽에서 가짜 데이터를 만들어 그립니다. 운영에서는 닫혀 있습니다
  if (id === DEMO_VILLAGE_ID) {
    if (!devToolsEnabled()) redirect("/");
    return <VillageLoader id={id} options={options} notice={notice} />;
  }

  // 진짜 마을: 주민이 아니면 여기서 다른 화면으로 보내집니다
  const userId = await requireResident(id);
  const village = await loadVillage(id, userId);
  // 주민 확인과 읽기 사이에 마을이 사라진 드문 경우: 처음 화면이 알맞은 곳으로 다시 보내 줍니다
  if (!village) redirect("/");
  // 진짜 마을에서는 개발용 옵션(?dev = 장식 단계 슬라이더, ?ghosts = 가짜 주민, ?fps = 장면 수 표시)을 운영에서 무시합니다.
  // 켜 두면 누구나 주소에 ?dev를 붙여 아직 못 채운 장식을 미리 볼 수 있기 때문입니다
  const realOptions = devToolsEnabled() ? options : withoutDevOptions(options);
  // 함께 걷기(Task 025): 서버 환경 변수 LIVE_WALK=1 일 때만 켭니다. 없으면 꺼져 있어 실시간 연결을 열지 않습니다.
  // 💡 NEXT_PUBLIC_ 으로 시작하지 않는 값이라 브라우저로 나가지 않고, 서버가 요청을 받을 때마다 읽습니다.
  //    그래서 화면에는 "켜짐/꺼짐"(true/false)만 내려보냅니다. 문제가 생기면 이 값을 지우고 다시 배포하면 꺼집니다.
  const liveWalk = process.env.LIVE_WALK === "1";
  return <VillageLoader id={id} options={realOptions} village={village} notice={notice} liveWalk={liveWalk} />;
}

export default function VillagePage(props: PageProps<"/village/[id]">) {
  return (
    // 값을 읽는 동안에는 하늘색 바탕을 보여 줍니다
    <Suspense fallback={<div className="h-dvh w-full" style={{ backgroundColor: VILLAGE_COLORS.sky }} />}>
      <VillageContent {...props} />
    </Suspense>
  );
}
