import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Space_Grotesk } from "next/font/google";
import "./globals.css";

// 라틴 글자·숫자는 Space Grotesk, 한글은 Noto Sans KR (globals.css --font-sans 순서)
const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const notoKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  // 한글 글리프는 용량이 커서 미리 받지 않는다 (필요한 글자 범위만 브라우저가 받음)
  preload: false,
});

export const metadata: Metadata = {
  title: "Tutti",
  description: "합주팀을 위한 실시간 공유 악보",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${grotesk.variable} ${notoKr.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas font-sans text-fg">{children}</body>
    </html>
  );
}
