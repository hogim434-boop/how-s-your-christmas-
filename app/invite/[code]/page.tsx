// 초대 링크의 입구입니다. 주소: /invite/초대코드 (로드맵 Task 005·008, F012)
//  - 초대 코드로 진짜 마을 이름을 찾아 보여 줍니다 (로그인 전에도 보임)
//  - 그런 마을이 없으면 "사용할 수 없는 초대 링크" 안내
//  - 버튼: 로그인 안 한 사람 → 로그인 화면 / 로그인한 사람 → 바로 입주 주소(/invite/코드/join)
//
// Next.js 16: params(주소의 [code] 부분)와 searchParams(? 뒤 값)는 Promise라서 await로 꺼내고,
// cacheComponents 모드라서 그 부분을 <Suspense>로 감쌉니다. (마을 화면과 같은 방식)

import { Suspense } from "react";
import { InviteLanding } from "@/components/invite/InviteLanding";
import { LocaleProvider } from "@/components/LocaleProvider";
import { safeInviteCode } from "@/lib/auth/next";
import { getCurrentUserId } from "@/lib/auth/session";
import { findInvitedVillage } from "@/lib/village/invited";
import { parseInviteError } from "@/lib/village/join";
import { VILLAGE_COLORS } from "@/lib/village/theme";

async function InviteContent({ params, searchParams }: PageProps<"/invite/[code]">) {
  const code = safeInviteCode((await params).code);
  const query = await searchParams;
  // 초대 코드로 마을을 찾고, 로그인 여부도 함께 확인합니다 (서로 기다릴 필요가 없어 동시에)
  const [village, userId] = await Promise.all([findInvitedVillage(code), getCurrentUserId()]);
  return (
    // 언어 공급은 Suspense 안쪽에 둡니다 (바깥에 두면 서버가 그린 글자와 어긋날 수 있음)
    <LocaleProvider>
      <InviteLanding
        code={code ?? ""}
        villageName={village?.name}
        loggedIn={userId !== null}
        error={parseInviteError(query.error)}
      />
    </LocaleProvider>
  );
}

export default function InvitePage(props: PageProps<"/invite/[code]">) {
  return (
    <main
      className="flex min-h-dvh w-full items-center justify-center p-5"
      style={{ backgroundColor: VILLAGE_COLORS.sky }}
    >
      <Suspense fallback={null}>
        <InviteContent {...props} />
      </Suspense>
    </main>
  );
}
