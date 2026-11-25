// 모든 화면을 감싸는 바깥 틀입니다. (html·body 태그, 페이지 제목, 글꼴)

import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { DEFAULT_LOCALE, getMessages } from "@/i18n/messages";

// 영어·숫자용 글꼴. 일본어·한국어는 휴대폰 기본 글꼴로 보입니다.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const t = getMessages(DEFAULT_LOCALE);

// 브라우저 탭과 링크 미리보기에 보이는 정보
export const metadata: Metadata = {
  title: t.appName,
  description: t.tagline,
};

// 휴대폰에서 화면 폭에 맞춰 보이게 하는 설정
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eaf3fc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang: 화면 언어. 기본 언어(지금은 일본어)를 따릅니다.
    <html lang={DEFAULT_LOCALE} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
