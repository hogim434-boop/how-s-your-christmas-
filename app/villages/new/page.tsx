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

export default function NewVillagePage({ searchParams }: PageProps<"/villages/new">) {
  return (
    <main
      className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 p-5"
      style={{ backgroundColor: VILLAGE_COLORS.sky }}
    >
      <Suspense fallback={null}>
        <NoticeContent searchParams={searchParams} />
      </Suspense>
      <LocaleProvider>
        <CreateVillageForm />
      </LocaleProvider>
    </main>
  );
}
