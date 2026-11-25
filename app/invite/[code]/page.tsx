// 초대 링크의 입구입니다. 주소: /invite/초대코드
// (로드맵 Task 005. 지금은 가짜 데이터라서 어떤 코드든 같은 가짜 마을 이름을 보여 줍니다)
//
// Next.js 16: params(주소의 [code] 부분)는 Promise라서 await로 꺼내고,
// cacheComponents 모드라서 그 부분을 <Suspense>로 감쌉니다. (마을 화면과 같은 방식)

import { Suspense } from "react";
import { InviteLanding } from "@/components/invite/InviteLanding";
import { LocaleProvider } from "@/components/LocaleProvider";
import { DUMMY_VILLAGE_NAME } from "@/lib/dummy/village";
import { VILLAGE_COLORS } from "@/lib/village/theme";

async function InviteContent({ params }: Pick<PageProps<"/invite/[code]">, "params">) {
  const { code } = await params;
  // TODO(Task 008): 초대 코드로 진짜 마을을 찾고, 없는 코드면 안내를 보여 줍니다
  return (
    // 언어 공급은 Suspense 안쪽에 둡니다 (바깥에 두면 서버가 그린 글자와 어긋날 수 있음)
    <LocaleProvider>
      <InviteLanding code={code} villageName={DUMMY_VILLAGE_NAME} />
    </LocaleProvider>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[code]">) {
  return (
    <main
      className="flex min-h-dvh w-full items-center justify-center p-5"
      style={{ backgroundColor: VILLAGE_COLORS.sky }}
    >
      <Suspense fallback={null}>
        <InviteContent params={params} />
      </Suspense>
    </main>
  );
}
