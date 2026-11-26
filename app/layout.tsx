// 모든 화면을 감싸는 바깥 틀입니다. (html·body 태그, 페이지 제목, 글꼴)

import type { Metadata, Viewport } from "next";
import { Geist, Jua, M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";
import { DEFAULT_LOCALE, getMessages } from "@/i18n/messages";

// 영어·숫자용 글꼴.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// 한국어용 둥근 글꼴 (Jua). 한글 조각은 글자가 쓰일 때만 내려받습니다.
const jua = Jua({
  variable: "--font-ko",
  weight: "400",
  display: "swap",
  preload: false,
});

// 일본어용 둥근 글꼴 (M PLUS Rounded 1c). 일본어 글자도 Jua처럼 둥글둥글하게 맞춥니다.
const mPlusRounded = M_PLUS_Rounded_1c({
  variable: "--font-ja",
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

const t = getMessages(DEFAULT_LOCALE);

// 브라우저 탭과 링크 미리보기에 보이는 정보
// 💡 링크 미리보기(Open Graph)란? LINE·카카오톡에 주소를 붙여 넣으면 뜨는 제목·설명·그림 상자입니다.
//    - 그림: app/opengraph-image.jpg (1200×630, 첫 화면을 찍은 것). 이 이름으로 app 폴더에 두면 Next.js가 알아서 연결합니다.
//      (다시 만들 때: 첫 화면을 1200×630으로 열고 버튼과 소개 문구를 가린 뒤 찍습니다)
//    - 그림의 전체 주소: Vercel에 배포하면 배포 주소가 자동으로 붙습니다 (따로 넣을 설정 없음)
export const metadata: Metadata = {
  title: t.appName,
  description: t.tagline,
  openGraph: {
    type: "website",
    siteName: t.appName,
    title: t.appName,
    description: t.tagline,
  },
  // 큰 그림으로 보여 달라는 표시 (X·일부 메신저가 참고합니다)
  twitter: { card: "summary_large_image", title: t.appName, description: t.tagline },
};

// 휴대폰에서 화면 폭에 맞춰 보이게 하는 설정
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 아이폰 노치·아래 막대까지 화면을 쓰고, HUD가 env(safe-area-inset-*)로 피해 갑니다
  viewportFit: "cover",
  themeColor: "#eaf3fc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang: 화면 언어. 기본 언어(지금은 일본어)를 따릅니다.
    <html lang={DEFAULT_LOCALE} className={`${geistSans.variable} ${jua.variable} ${mPlusRounded.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
