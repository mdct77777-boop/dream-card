/**
 * 100자 표시 검증
 *
 * 꿈 문장을 100자까지 적을 수 있는지, 그리고 그 100자가 카드 이미지에
 * 한 글자도 빠짐없이 그려지는지 확인합니다.
 * 사진 없음 · 전체 담기 · 꽉 채우기 세 가지 경우를 모두 봅니다.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = path.join(__dirname, "shots-text");

// 정확히 100자인 실제 문장 (숙박업 맥락)
const DREAM_100 =
  "바다가 보이는 낡은 모텔을 사서 삼 년 안에 손님이 다시 찾아오는 작은 스테이로 고치고, 우리 가족이 함께 웃으며 일할 수 있는 따뜻한 자리를 꼭 만들어 내는 것이 나의 오랜 소망";

const DREAM_120 = DREAM_100 + "이고 반드시 이루어 내겠습니다 정말로요";

const strip = (s) => s.replace(/\s+/g, "");

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  const results = [];
  let failed = 0;

  const ok = (name, pass, note) => {
    results.push([pass ? "✓" : "✗", name, note]);
    if (!pass) failed++;
  };

  page.on("pageerror", (e) => ok("페이지 오류", false, e.message));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  console.log(`테스트 문장 길이: ${DREAM_100.length}자`);
  ok("테스트 문장 준비", DREAM_100.length === 100, `${DREAM_100.length}자`);

  const setDream = async (text) => {
    await page.fill("#dream", "");
    await page.fill("#dream", text);
    await page.waitForTimeout(700);
  };

  // 카드에 실제로 그려진 줄을 읽어 온다
  const drawn = () => page.evaluate(() => window.__dreamCard || null);

  /* ---- 1) 입력창이 100자를 받고 그 이상은 막는지 ---- */
  await setDream(DREAM_100);
  let value = await page.inputValue("#dream");
  ok("100자 입력", value.length === 100, `${value.length}자 입력됨`);

  await setDream(DREAM_120);
  value = await page.inputValue("#dream");
  ok("100자 초과 차단", value.length === 100, `${DREAM_120.length}자 입력 → ${value.length}자로 잘림`);

  /* ---- 2) 사진 없이 100자가 전부 그려지는지 ---- */
  await setDream(DREAM_100);
  let info = await drawn();
  if (!info) {
    ok("사진 없음 · 100자", false, "그리기 정보를 읽지 못함");
  } else {
    const joined = strip(info.dreamLines.join(""));
    ok(
      "사진 없음 · 100자",
      joined === strip(DREAM_100) && info.dreamFits,
      `${info.dreamLines.length}줄 · ${info.dreamSize}px · ${joined.length}/${strip(DREAM_100).length}자`
    );
  }
  await page.locator("canvas").screenshot({ path: path.join(SHOTS, "100-text-only.png") });

  /* ---- 3) 사진 + 전체 담기 ---- */
  await page.setInputFiles("input[type=file]", path.join(__dirname, "fixtures", "16x9-horizontal.png"));
  await page.waitForTimeout(800);
  await page.locator(".seg", { hasText: "전체 담기" }).click();
  await page.waitForTimeout(600);

  info = await drawn();
  if (!info) {
    ok("전체 담기 · 100자", false, "그리기 정보를 읽지 못함");
  } else {
    const joined = strip(info.dreamLines.join(""));
    ok(
      "전체 담기 · 100자",
      joined === strip(DREAM_100) && info.dreamFits,
      `${info.dreamLines.length}줄 · ${info.dreamSize}px · ${joined.length}/${strip(DREAM_100).length}자`
    );
  }
  await page.locator("canvas").screenshot({ path: path.join(SHOTS, "100-contain.png") });

  /* ---- 4) 사진 + 꽉 채우기 ---- */
  await page.locator(".seg", { hasText: "꽉 채우기" }).click();
  await page.waitForTimeout(600);

  info = await drawn();
  if (!info) {
    ok("꽉 채우기 · 100자", false, "그리기 정보를 읽지 못함");
  } else {
    const joined = strip(info.dreamLines.join(""));
    ok(
      "꽉 채우기 · 100자",
      joined === strip(DREAM_100) && info.dreamFits,
      `${info.dreamLines.length}줄 · ${info.dreamSize}px · ${joined.length}/${strip(DREAM_100).length}자`
    );
  }
  await page.locator("canvas").screenshot({ path: path.join(SHOTS, "100-cover.png") });

  /* ---- 5) 짧은 문장은 여전히 크게 나오는지 ---- */
  await page.locator(".thumbrow button").click();
  await page.waitForTimeout(300);
  await setDream("바다가 보이는 작은 숙소의 주인이 되기");
  info = await drawn();
  ok("짧은 문장 크기", info && info.dreamSize >= 50, info ? `${info.dreamSize}px` : "정보 없음");
  await page.locator("canvas").screenshot({ path: path.join(SHOTS, "short-text.png") });

  /* ---- 6) 사진 없이 100자를 넣어도 카드가 정상 저장되는지 ---- */
  await setDream(DREAM_100);
  const dataUrl = await page.evaluate(() => document.querySelector("canvas").toDataURL("image/png").slice(0, 22));
  ok("100자 카드 저장", dataUrl.startsWith("data:image/png;base64,"), "PNG 생성됨");

  await browser.close();

  console.log("\n100자 표시 테스트 결과");
  console.log("=".repeat(70));
  for (const [m, n, note] of results) console.log(`${m}  ${n.padEnd(20)} ${note}`);
  console.log("=".repeat(70));
  console.log(failed === 0 ? `전부 통과 (${results.length}건)` : `실패 ${failed}건 / 전체 ${results.length}건`);
  process.exit(failed === 0 ? 0 : 1);
})();
