import "./globals.css";

export const metadata = {
  title: "꿈 채움 카드 | 놀스테이",
  description:
    "빈칸에 꿈을 적거나 사진을 올리면 9:16 세로 카드로 다시 그려주고, 어울리는 오늘의 명언 한 문장과 화이팅 응원을 함께 담아 드립니다.",
  openGraph: {
    title: "꿈 채움 카드",
    description: "꿈은 적는 순간, 방향이 됩니다.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#FBF5EE",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
