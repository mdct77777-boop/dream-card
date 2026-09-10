/**
 * 휴대폰에서 바로 여는 길 검증
 *
 * 카카오톡 안 브라우저에서 열렸을 때
 *  1) 크롬(안드로이드)·사파리(아이폰)로 한 번에 넘어가는 버튼이 올바른 주소를 갖는지
 *  2) 주소 복사 버튼이 실제로 주소를 클립보드에 넣는지
 *  3) 주소를 눈으로 보고 직접 입력할 수 있게 표시하는지
 * 그리고 홈 화면에 추가할 수 있도록 앱 정보(매니페스트)와 아이콘이 준비되어 있는지 봅니다.
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const KAKAO_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.5.0";
const KAKAO_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.5.0";

const results = [];
let failed = 0;
const ok = (name, pass, note) => {
  results.push([pass ? "✓" : "✗", name, note]);
  if (!pass) failed++;
};

async function openIn(browser, ua) {
  const context = await browser.newContext({
    userAgent: ua,
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => ok("페이지 오류", false, e.message));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  return { context, page };
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const isFile = BASE.startsWith("file://");

  /* ---- 1) 안드로이드 카톡 → 크롬으로 열기 ---- */
  {
    const { context, page } = await openIn(browser, KAKAO_ANDROID);

    const label = await page.locator("#openbrowser").textContent().catch(() => "");
    ok("안드로이드 · 버튼 문구", label.includes("크롬"), label || "버튼이 없음");

    const href = await page.locator("#openbrowser").getAttribute("href").catch(() => "");
    const good =
      !!href &&
      href.startsWith("intent://") &&
      href.includes("scheme=https") &&
      href.includes("package=com.android.chrome");
    ok("안드로이드 · 크롬 주소", good, href ? href.slice(0, 58) + "…" : "주소가 없음");

    // 주소 복사
    await page.locator("#copyaddr").click();
    await page.waitForTimeout(800);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    ok("주소 복사", !!clip && clip.startsWith(isFile ? "file" : "http"), clip || "복사되지 않음");

    const msg = await page.locator("#status").textContent().catch(() => "");
    ok("복사 안내", msg.includes("주소"), msg.trim() || "안내가 없음");

    const plain = await page.locator("#plainaddr").textContent().catch(() => "");
    ok("주소 직접 표시", !!plain, plain || "표시가 없음");

    await context.close();
  }

  /* ---- 2) 아이폰 카톡 → 사파리로 열기 ---- */
  {
    const { context, page } = await openIn(browser, KAKAO_IOS);
    const label = await page.locator("#openbrowser").textContent().catch(() => "");
    ok("아이폰 · 버튼 문구", label.includes("사파리"), label || "버튼이 없음");

    const href = await page.locator("#openbrowser").getAttribute("href").catch(() => "");
    ok("아이폰 · 사파리 주소", !!href && href.startsWith("x-safari-"), href ? href.slice(0, 46) + "…" : "주소가 없음");
    await context.close();
  }

  /* ---- 3) 홈 화면에 추가 준비 (앱에서만 해당) ---- */
  if (!isFile) {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
    const page = await context.newPage();

    const res = await page.goto(BASE + "/manifest.webmanifest").catch(() => null);
    if (!res || !res.ok()) {
      ok("앱 정보 파일", false, res ? `HTTP ${res.status()}` : "열리지 않음");
    } else {
      const m = await res.json();
      ok("앱 정보 파일", true, `${m.name} · ${m.display}`);
      ok("홈 화면 독립 실행", m.display === "standalone", m.display);
      ok("아이콘 등록", Array.isArray(m.icons) && m.icons.length >= 2, `${(m.icons || []).length}개`);

      for (const icon of ["/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"]) {
        const r = await page.goto(BASE + icon).catch(() => null);
        ok(`아이콘 ${icon.replace("/", "")}`, !!r && r.ok(), r ? `HTTP ${r.status()}` : "없음");
      }
    }
    await context.close();
  }

  /* ---- 4) 일반 크롬에서는 안내가 뜨지 않아야 한다 ---- */
  {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      viewport: { width: 412, height: 915 },
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const notice = await page.locator("#inapp").isVisible().catch(() => false);
    ok("일반 크롬 · 안내 없음", !notice, notice ? "불필요한 안내가 뜸" : "안내 없음 (정상)");
    await context.close();
  }

  await browser.close();

  console.log("\n휴대폰 접속 경로 테스트 결과");
  console.log("=".repeat(72));
  for (const [m, n, note] of results) console.log(`${m}  ${n.padEnd(22)} ${note}`);
  console.log("=".repeat(72));
  console.log(failed === 0 ? `전부 통과 (${results.length}건)` : `실패 ${failed}건 / 전체 ${results.length}건`);
  process.exit(failed === 0 ? 0 : 1);
})();
