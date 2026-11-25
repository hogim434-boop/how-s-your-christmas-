// 첫 화면입니다. 지금은 빈 3D 장면 위에 서비스 이름만 올려 둡니다.
// (로드맵 Task 002. 로그인·마을 화면 같은 다른 주소는 Task 004·005에서 만듭니다.)

import SceneLoader from "@/components/three/SceneLoader";
import { DEFAULT_LOCALE, getMessages } from "@/i18n/messages";

export default function Home() {
  const t = getMessages(DEFAULT_LOCALE);

  return (
    // h-dvh: 휴대폰 주소창 높이까지 고려한 "실제 화면 높이"만큼 채웁니다.
    <main className="relative h-dvh w-full overflow-hidden">
      {/* 3D 장면이 화면 전체를 차지합니다 */}
      <div className="absolute inset-0">
        <SceneLoader />
      </div>

      {/* 3D 위에 겹쳐 보이는 글자. pointer-events-none: 글자가 3D 조작(드래그)을 막지 않게 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 px-4 pt-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-700">{t.appName}</h1>
        <p className="text-sm text-slate-500">{t.tagline}</p>
      </div>
    </main>
  );
}
