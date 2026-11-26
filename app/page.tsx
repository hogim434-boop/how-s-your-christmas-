// 첫 화면 = 로그인 화면입니다. 주소: /  (초대로 왔으면 /?invite=코드)
// (로드맵 Task 005·007. 이미 로그인한 사람은 이 화면을 건너뛰고 알맞은 화면으로 갑니다)
//
// Next.js 16: searchParams(주소의 ? 뒤 값)는 Promise라서 await로 꺼냅니다.
// 이 프로젝트는 cacheComponents 모드라서, 이런 "요청마다 달라지는 값"을 읽는 부분만 <Suspense>로 감쌉니다.
// 값을 읽는 동안에는 초대 표시가 없는 로그인 화면(fallback)이 먼저 보입니다.

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { parseAuthError, parseNotice, resolveAfterLogin, safeInviteCode, safeNextPath } from "@/lib/auth/next";
import { getCurrentUserId, getLastVillageId, getMyVillageIds } from "@/lib/auth/session";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { LocaleProvider } from "@/components/LocaleProvider";
import SceneLoader from "@/components/three/SceneLoader";
import { findInvitedVillage } from "@/lib/village/invited";

/** 주소의 ? 뒤 값은 같은 이름이 여러 번 오면 배열이 됩니다. 그때는 첫 번째만 씁니다 */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// 주소의 ? 뒤 값(초대 코드, 돌아갈 주소, 안내 종류)과 로그인 상태를 읽는 부분
async function LoginContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const query = await searchParams;
  // 주소로 받은 값은 누구나 바꿀 수 있으므로, 안전한 모양인지 확인한 것만 씁니다 (lib/auth/next.ts)
  const inviteCode = safeInviteCode(first(query.invite)) ?? undefined;
  const next = safeNextPath(first(query.next)) ?? undefined;

  // 이미 로그인한 사람은 로그인 화면을 볼 필요가 없습니다 → 알맞은 화면으로
  const userId = await getCurrentUserId();
  if (userId) {
    redirect(
      resolveAfterLogin({
        next,
        inviteCode,
        villageIds: await getMyVillageIds(userId),
        lastVillageId: await getLastVillageId(),
      }),
    );
  }

  // 초대 링크로 왔으면 어느 마을에 초대받았는지 이름을 찾아 보여 줍니다 (없는 코드면 표시하지 않음)
  const invited = inviteCode ? await findInvitedVillage(inviteCode) : null;
  return (
    <LocaleProvider>
      <LoginScreen
        inviteCode={inviteCode}
        inviteVillageName={invited?.name}
        next={next}
        error={parseAuthError(first(query.error))}
        notice={parseNotice(first(query.notice))}
      />
    </LocaleProvider>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    // h-dvh: 휴대폰 주소창 높이까지 고려한 "실제 화면 높이"만큼 채웁니다.
    <main className="relative h-dvh w-full overflow-hidden">
      {/* 배경: 3D 장면이 화면 전체를 차지합니다 */}
      {/* pointer-events-none: 구경만 하는 배경이라 손가락·마우스에 반응하지 않습니다. bg: 3D가 뜨기 전의 밤하늘색 */}
      <div className="pointer-events-none absolute inset-0 bg-[#1c2550]">
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
