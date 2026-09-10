// 휴대폰 홈 화면에 추가하면 앱처럼 독립 실행됩니다.
export default function manifest() {
  return {
    name: "꿈 채움 카드",
    short_name: "꿈 카드",
    description:
      "빈칸에 꿈을 적거나 사진을 올리면 9:16 세로 카드와 오늘의 명언을 만들어 드립니다.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF5EE",
    theme_color: "#FBF5EE",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
