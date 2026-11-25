"use client";

// 3D 장면을 "브라우저에서만, 필요할 때" 불러오는 작은 연결 파일입니다.
//
// 왜 필요한가요?
// - 3D 도구(three.js)는 용량이 커서, 첫 화면 글자보다 늦게 불러와도 됩니다.
// - 3D는 서버에서 미리 그릴 수 없습니다. 그래서 ssr: false(서버에서 그리지 않기)를 씁니다.
// - Next.js 16 공식 문서에 따르면 ssr: false는 "use client" 파일 안에서만 쓸 수 있어서,
//   page.tsx(서버 쪽 파일)가 아니라 이 파일에 둡니다.

import dynamic from "next/dynamic";

const EmptyScene = dynamic(() => import("./EmptyScene"), {
  ssr: false,
  // 불러오는 동안에는 하늘색 바탕만 보여 줍니다.
  loading: () => <div className="h-full w-full bg-[#eaf3fc]" />,
});

export default function SceneLoader() {
  return <EmptyScene />;
}
