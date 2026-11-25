// 첫 화면 = 로그인 화면입니다. 주소: /  (초대로 왔으면 /?invite=코드)
// (로드맵 Task 005. 지금은 가짜 데이터라서 버튼을 누르면 바로 다음 화면으로 넘어갑니다)
//
// Next.js 16: searchParams(주소의 ? 뒤 값)는 Promise라서 await로 꺼냅니다.
// 이 프로젝트는 cacheComponents 모드라서, 이런 "요청마다 달라지는 값"을 읽는 부분만 <Suspense>로 감쌉니다.
// 값을 읽는 동안에는 초대 표시가 없는 로그인 화면(fallback)이 먼저 보입니다.

import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { LocaleProvider } from "@/components/LocaleProvider";
import SceneLoader from "@/components/three/SceneLoader";
import { DUMMY_VILLAGE_NAME } from "@/lib/dummy/village";

// 주소에서 초대 코드를 읽어 로그인 화면에 넘기는 부분
async function LoginContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { invite } = await searchParams;
  const inviteCode = Array.isArray(invite) ? invite[0] : invite;
  // TODO(Task 008): 초대 코드로 진짜 마을 이름을 찾아옵니다. 지금은 가짜 이름
  return (
    <LocaleProvider>
      <LoginScreen inviteCode={inviteCode} inviteVillageName={inviteCode ? DUMMY_VILLAGE_NAME : undefined} />
    </LocaleProvider>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    // h-dvh: 휴대폰 주소창 높이까지 고려한 "실제 화면 높이"만큼 채웁니다.
    <main className="relative h-dvh w-full overflow-hidden">
      {/* 배경: 3D 장면이 화면 전체를 차지합니다 */}
      <div className="absolute inset-0">
        <SceneLoader />
      </div>

      {/* LocaleProvider(언어 공급)는 Suspense "안쪽"에 둡니다.
          바깥에 두면, 안쪽 내용이 준비되기 전에 언어가 먼저 바뀌어 서버가 그린 글자와 어긋납니다 */}
      <Suspense
        fallback={
          <LocaleProvider>
            <LoginScreen />
          </LocaleProvider>
        }
      >
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
