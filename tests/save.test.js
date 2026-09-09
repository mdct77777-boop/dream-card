/**
 * 저장 동작 검증
 * - "이미지 저장"을 누르면 실제 PNG 파일이 내려받아지는지
 * - 내려받은 파일이 손상 없이 열리는 PNG 인지 (머리글 + 크기 확인)
 * - 다운로드가 막힌 환경을 위한 안내 이미지가 뜨는지
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "downloads");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1200 } });
  const page = await ctx.newPage();
  const results = [];
  let failed = 0;

  const ok = (name, pass, note) => {
    results.push([pass ? "✓" : "✗", name, note]);
    if (!pass) failed++;
  };

  page.on("pageerror", (e) => ok("페이지 오류", false, e.message));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 사진까지 넣은 상태에서 저장해 본다
  await page.setInputFiles("input[type=file]", path.join(__dirname, "fixtures", "9x16-vertical.png"));
  await page.waitForTimeout(800);

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
    page.locator("#download").click(),
  ]);

  if (download) {
    const file = path.join(OUT, download.suggestedFilename());
    await download.saveAs(file);
    const buf = fs.readFileSync(file);
    const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    ok("다운로드 시작", true, `파일명 ${download.suggestedFilename()}`);
    ok("PNG 형식", isPng, isPng ? `정상 PNG · ${Math.round(buf.length / 1024)}KB` : "PNG 머리글 아님");
    ok("9:16 크기", w === 1080 && h === 1920, `${w}×${h}`);
    ok("파일 이름", /^dream-card-\d{4}-\d{2}-\d{2}\.png$/.test(download.suggestedFilename()), download.suggestedFilename());
  } else {
    ok("다운로드 시작", false, "다운로드 이벤트가 발생하지 않음");
  }

  // 다운로드가 막힌 경우를 위한 안내 이미지
  await page.waitForTimeout(600);
  const box = page.locator("#saveout");
  const shown = await box.isVisible();
  ok("저장 안내 표시", shown, shown ? "길게 눌러 저장할 수 있는 이미지 노출" : "안내가 보이지 않음");

  if (shown) {
    const src = await page.locator("#saveimg").getAttribute("src");
    ok("안내 이미지 내용", !!src && src.startsWith("data:image/png;base64,"), src ? `${Math.round(src.length / 1024)}KB PNG` : "비어 있음");
    const dl = await page.locator("#savelink").getAttribute("download");
    ok("직접 저장 링크", /\.png$/.test(dl || ""), dl || "없음");
  }

  // 사진 없이도 저장되는지 (텍스트만 있는 카드)
  await page.locator(".thumbrow button").click();
  await page.waitForTimeout(400);
  const [d2] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
    page.locator("#download").click(),
  ]);
  ok("사진 없이 저장", !!d2, d2 ? "텍스트만 있는 카드도 저장됨" : "다운로드되지 않음");

  await browser.close();

  console.log("\n저장 기능 테스트 결과");
  console.log("=".repeat(62));
  for (const [m, n, note] of results) console.log(`${m}  ${n.padEnd(16)} ${note}`);
  console.log("=".repeat(62));
  console.log(failed === 0 ? `전부 통과 (${results.length}건)` : `실패 ${failed}건 / 전체 ${results.length}건`);
  process.exit(failed === 0 ? 0 : 1);
})();
