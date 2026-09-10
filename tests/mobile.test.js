/**
 * 휴대폰 환경 검증
 *
 * 실제로 대표님이 겪으신 상황(카카오톡 안 브라우저)을 포함해 세 가지 환경을 흉내내어,
 * "공유하기" 버튼이 항상 보이는지, 그리고 각 환경에서 눌렀을 때 쓸 수 있는 결과가 나오는지 봅니다.
 *
 *  1) 카카오톡 안 브라우저 — 공유 기능 없음. 버튼은 보여야 하고, 누르면 길게 눌러 저장 안내가 나와야 함.
 *  2) 일반 휴대폰 브라우저 — 파일 공유 지원. 누르면 이미지 파일이 공유창으로 넘어가야 함.
 *  3) 파일은 안 되고 주소만 되는 브라우저 — 주소 공유 후 안내가 나와야 함.
 */
const path = require("path");
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const KAKAO_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.5.0";
const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

const results = [];
let failed = 0;
const ok = (name, pass, note) => {
  results.push([pass ? "✓" : "✗", name, note]);
  if (!pass) failed++;
};

/** 공유 기능을 상황별로 갈아 끼웁니다. mode: none | files | urlonly */
function shareStub(mode) {
  return `(() => {
    window.__shared = null;
    if ("${mode}" === "none") {
      delete navigator.share;
      delete navigator.canShare;
      return;
    }
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (d) => ("${mode}" === "files" ? !!(d && d.files && d.files.length) : !(d && d.files)),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d) => {
        if (d && d.files && "${mode}" !== "files") throw new TypeError("files not supported");
        window.__shared = {
          files: d && d.files ? d.files.map((f) => ({ name: f.name, type: f.type, size: f.size })) : null,
          url: (d && d.url) || null,
        };
      },
    });
  })()`;
}

async function scenario(browser, label, ua, mode, checks) {
  const context = await browser.newContext({
    ...devices["Galaxy S24"] || {},
    userAgent: ua,
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(shareStub(mode));
  page.on("pageerror", (e) => ok(`${label} · 페이지 오류`, false, e.message));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 카드에 사진을 하나 넣어 실제 사용 상태로 만든다
  await page.setInputFiles("input[type=file]", path.join(__dirname, "fixtures", "9x16-vertical.png"));
  await page.waitForTimeout(800);

  await checks(page, label);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  /* ---- 1) 카카오톡 안 브라우저 ---- */
  await scenario(browser, "카톡 인앱", KAKAO_UA, "none", async (page, label) => {
    const shareVisible = await page.locator("#share").isVisible().catch(() => false);
    ok(`${label} · 공유 버튼`, shareVisible, shareVisible ? "버튼이 보임" : "버튼이 숨겨짐");

    const notice = await page.locator("#inapp").isVisible().catch(() => false);
    const noticeText = notice ? (await page.locator("#inapp").textContent()) : "";
    ok(
      `${label} · 안내 표시`,
      notice && noticeText.includes("카카오톡"),
      notice ? "다른 브라우저로 열기 안내 나옴" : "안내가 없음"
    );

    // 저장 버튼도 인앱에서는 곧바로 대체 안내로 이어져야 한다
    await page.locator("#download").click();
    await page.waitForTimeout(800);
    const dlStatus = await page.locator("#status").textContent().catch(() => "");
    ok(
      `${label} · 저장 버튼`,
      dlStatus.includes("막혀") || dlStatus.includes("아래"),
      dlStatus ? dlStatus.trim().slice(0, 34) + "…" : "알림이 없음"
    );

    if (shareVisible) {
      await page.locator("#share").click();
      await page.waitForTimeout(900);
      const boxVisible = await page.locator("#saveout").isVisible().catch(() => false);
      const msg = boxVisible ? await page.locator("#savemsg").textContent() : "";
      ok(
        `${label} · 대체 안내`,
        boxVisible && msg.includes("길게"),
        boxVisible ? msg.trim().slice(0, 40) + "…" : "안내 상자가 안 뜸"
      );
      const src = boxVisible ? await page.locator("#saveimg").getAttribute("src") : "";
      ok(
        `${label} · 저장용 이미지`,
        !!src && src.startsWith("data:image/png;base64,"),
        src ? `${Math.round(src.length / 1024)}KB 이미지 노출` : "이미지가 없음"
      );
    }
  });

  /* ---- 2) 일반 휴대폰 브라우저 (파일 공유 지원) ---- */
  await scenario(browser, "일반 휴대폰", PHONE_UA, "files", async (page, label) => {
    const notice = await page.locator("#inapp").isVisible().catch(() => false);
    ok(`${label} · 안내 없음`, !notice, notice ? "불필요한 안내가 뜸" : "안내 없음 (정상)");

    await page.locator("#share").click();
    await page.waitForTimeout(900);
    const shared = await page.evaluate(() => window.__shared);
    const f = shared && shared.files && shared.files[0];
    ok(
      `${label} · 파일 공유`,
      !!f && f.type === "image/png" && f.size > 10000,
      f ? `${f.name} · ${Math.round(f.size / 1024)}KB` : "공유창에 파일이 안 넘어감"
    );
  });

  /* ---- 3) 파일은 막히고 주소만 되는 브라우저 ---- */
  await scenario(browser, "주소만 공유", PHONE_UA, "urlonly", async (page, label) => {
    await page.locator("#share").click();
    await page.waitForTimeout(900);
    const shared = await page.evaluate(() => window.__shared);
    ok(`${label} · 주소 공유`, !!(shared && shared.url), shared && shared.url ? shared.url : "주소도 안 넘어감");

    const boxVisible = await page.locator("#saveout").isVisible().catch(() => false);
    const msg = boxVisible ? await page.locator("#savemsg").textContent() : "";
    ok(
      `${label} · 이후 안내`,
      boxVisible && msg.includes("길게"),
      boxVisible ? "그림 보내는 방법 안내됨" : "안내가 없음"
    );
  });

  await browser.close();

  console.log("\n휴대폰 환경 테스트 결과");
  console.log("=".repeat(70));
  for (const [m, n, note] of results) console.log(`${m}  ${n.padEnd(24)} ${note}`);
  console.log("=".repeat(70));
  console.log(failed === 0 ? `전부 통과 (${results.length}건)` : `실패 ${failed}건 / 전체 ${results.length}건`);
  process.exit(failed === 0 ? 0 : 1);
})();
