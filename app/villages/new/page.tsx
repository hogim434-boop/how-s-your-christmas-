// 마을 만들기 화면입니다. 주소: /villages/new
// (로드맵 Task 005. 지금은 가짜 데이터로 눌러 볼 수 있는 틀이고, 진짜 저장은 Task 008에서 합니다)
// 이 화면은 주소에서 읽는 값이 없어서 <Suspense>가 필요 없습니다.

import { LocaleProvider } from "@/components/LocaleProvider";
import { CreateVillageForm } from "@/components/villages/CreateVillageForm";
import { VILLAGE_COLORS } from "@/lib/village/theme";

export default function NewVillagePage() {
  return (
    <main
      className="flex min-h-dvh w-full items-center justify-center p-5"
      style={{ backgroundColor: VILLAGE_COLORS.sky }}
    >
      <LocaleProvider>
        <CreateVillageForm />
      </LocaleProvider>
    </main>
  );
}
