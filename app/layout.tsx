// 모든 화면을 감싸는 바깥 틀입니다. (html·body 태그, 페이지 제목, 글꼴)

import type { Metadata, Viewport } from "next";
import { Geist, Zen_Maru_Gothic } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { DEFAULT_LOCALE, getMessages } from "@/i18n/messages";

// 영어·숫자용 글꼴.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// 글꼴은 "둥근 고딕" 한 쌍입니다 (11.27 사용자 선택: 후보 C. 그 전에는 M PLUS Rounded 1c + Jua)
//  - 일본어: Zen Maru Gothic  /  한국어: 나눔스퀘어라운드
// 획 끝까지 둥글어서 포근한 인상이고, 둘 다 굵기가 여러 개라 버튼·제목의 굵은 글자가 진짜 굵은 글꼴로 나옵니다.
// (전에 쓰던 Jua는 굵기가 하나뿐이라 굵은 글자를 브라우저가 억지로 두껍게 만들었습니다)

// 일본어용 (Google Fonts). 일본어 글자 조각은 그 글자가 쓰일 때만 내려받습니다.
// 굵기: 400(보통)·500(중간, font-medium)·700(굵게, font-semibold와 font-bold가 이것을 씁니다)
const zenMaru = Zen_Maru_Gothic({
  variable: "--font-ja",
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

// 한국어용. Google Fonts에 없어서 글꼴 파일을 app/fonts 폴더에 직접 넣었습니다 (출처·사용 조건은 app/fonts/README.md).
// 💡 next/font/local: 우리 폴더의 글꼴 파일을 사이트에서 직접 내려 주는 도구입니다.
const nanumSquareRound = localFont({
  variable: "--font-ko",
  src: [
    { path: "./fonts/NanumSquareRoundR.woff2", weight: "400", style: "normal" },
    { path: "./fonts/NanumSquareRoundB.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  // 미리 받지 않습니다. 파일이 굵기마다 약 0.25MB라, 한글이 화면에 실제로 나올 때만 받게 합니다
  preload: false,
  // unicode-range: "이 글꼴은 한글에만 쓴다"는 표시. 일본어 화면에서는 한글 이름이 나오기 전까지 이 파일을 받지 않습니다.
  // (영어·숫자·문장 부호는 두 언어 모두 일본어 글꼴의 것을 써서, 언어를 바꿔도 숫자 모양이 같습니다)
  declarations: [{ prop: "unicode-range", value: "U+1100-11FF, U+3130-318F, U+A960-A97F, U+AC00-D7A3, U+D7B0-D7FF" }],
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
    <html lang={DEFAULT_LOCALE} className={`${geistSans.variable} ${zenMaru.variable} ${nanumSquareRound.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
