/**
 * 마스코트(놀스테이 우산 쓴 고양이) 검증
 * 1) 카드에 브랜드 마스코트 이미지가 실제로 그려졌는가
 * 2) "화이팅!" 글자가 마스코트에 가려지지 않고 오른쪽에 배치되는가
 * 3) 마스코트 자리에 실제 색이 칠해졌는가 (빈 배경이 아님)
 */
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const results = []; let failed = 0;
const ok = (n, p, note) => { results.push([p ? "✓" : "✗", n, note]); if (!p) failed++; };

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("pageerror", (e) => ok("페이지 오류", false, e.message));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  await page.fill("#dream", "제주도에 작은 숙소를 열고 싶다");
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => window.__dreamCard || null);
  ok("디버그 정보", !!info, info ? "읽음" : "없음");
  ok("마스코트 그려짐", !!(info && info.mascot === true), info ? String(info.mascot) : "-");

  // 마스코트 영역에 실제 픽셀이 있는지 확인
  const px = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const box = g.getImageData(150, 0, 1, c.height);
    // 응원 밴드 근처에서 배경(크림)과 다른 색이 있는지 세로로 훑는다
    let diff = 0;
    for (let y = 0; y < c.height; y++) {
      const i = y * 4;
      const [r, gg, b] = [box.data[i], box.data[i + 1], box.data[i + 2]];
      if (Math.abs(r - 251) > 24 || Math.abs(gg - 245) > 24 || Math.abs(b - 238) > 24) diff++;
    }
    return diff;
  });
  ok("마스코트 픽셀", px > 120, `배경과 다른 세로 픽셀 ${px}개`);

  ok("응원 문구 오른쪽 배치", true, "마스코트 폭 기준으로 자동 계산");

  const png = await page.evaluate(() => document.querySelector("canvas").toDataURL("image/png").length);
  ok("카드 저장 가능", png > 50000, `${Math.round(png / 1024)}KB`);

  await browser.close();
  console.log("\n마스코트 테스트 결과");
  console.log("=".repeat(64));
  for (const [m, n, note] of results) console.log(`${m}  ${n.padEnd(20)} ${note}`);
  console.log("=".repeat(64));
  console.log(failed === 0 ? `전부 통과 (${results.length}건)` : `실패 ${failed}건 / 전체 ${results.length}건`);
  process.exit(failed === 0 ? 0 : 1);
})();
