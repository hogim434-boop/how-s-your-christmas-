// 마을 만들기 화면입니다. 주소: /villages/new
// (로드맵 Task 005·008. "만들기"를 누르면 마을이 데이터베이스에 저장됩니다 → components/villages/CreateVillageForm.tsx)
//
// 로그인한 사람만 볼 수 있습니다. 로그인하지 않았으면 문지기(proxy.ts)가 로그인 화면으로 보냅니다. (Task 007)
// 💡 저장할 때는 데이터베이스 함수(create_village)가 로그인 여부를 한 번 더 확인합니다.

import { Suspense } from "react";
import { NoticeBanner } from "@/components/auth/NoticeBanner";
import { LocaleProvider } from "@/components/LocaleProvider";
import { CreateVillageForm } from "@/components/villages/CreateVillageForm";
import { parseNotice } from "@/lib/auth/next";
import { getCurrentUserId, getLastVillageId, getMyLoginName, getMyVillageIds } from "@/lib/auth/session";
import { VILLAGE_COLORS } from "@/lib/village/theme";

// 주소의 ?notice= 값을 읽어 안내를 보여 주는 부분.
// cacheComponents 모드라서 "요청마다 달라지는 값"을 읽는 이 부분만 <Suspense>로 감쌉니다.
async function NoticeContent({ searchParams }: Pick<PageProps<"/villages/new">, "searchParams">) {
  const { notice } = await searchParams;
  const parsed = parseNotice(Array.isArray(notice) ? notice[0] : notice);
  if (!parsed) return null;
  return (
    <LocaleProvider>
      <NoticeBanner notice={parsed} />
    </LocaleProvider>
  );
}

// 만들기 양식. 닉네임 입력칸에 로그인 닉네임을 미리 채워 두려고 내 이름을 읽습니다.
// (쿠키를 읽는 "요청마다 달라지는 값"이라 이 부분도 <Suspense> 안에 둡니다)
async function FormContent() {
  const userId = await getCurrentUserId();
  // 이미 들어간 마을이 있으면 "마을로 돌아가기" 링크를 보여 줍니다 (마을 목록에서 들어온 사람, Task 017).
  // 돌아갈 곳: 마지막으로 들어간 마을. 기억이 없거나 이제 주민이 아니면 가장 최근에 입주한 마을
  const [loginName, villageIds, lastVillageId] = userId
    ? await Promise.all([getMyLoginName(userId), getMyVillageIds(userId), getLastVillageId()])
    : ["", [] as string[], null];
  const backId = lastVillageId && villageIds.includes(lastVillageId) ? lastVillageId : villageIds[0];
  return (
    <LocaleProvider>
      <CreateVillageForm defaultNickname={loginName} backHref={backId ? `/village/${backId}` : null} />
    </LocaleProvider>
  );
}

export default function NewVillagePage({ searchParams }: PageProps<"/villages/new">) {
  return (
    <main
      className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 p-5"
      style={{ backgroundColor: VILLAGE_COLORS.sky }}
    >
      <Suspense fallback={null}>
        <NoticeContent searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <FormContent />
      </Suspense>
    </main>
  );
}
