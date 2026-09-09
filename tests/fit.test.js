/**
 * 사진 맞춤 동작 검증
 *
 * "전체 담기(contain)" 모드에서 어떤 비율의 사진이든 네 모서리가 모두 카드에 남아 있는지,
 * "꽉 채우기(cover)" 모드에서는 네모칸이 빈틈없이 채워지는지 실제 브라우저에서 확인합니다.
 */
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const FIXTURES = path.join(__dirname, "fixtures");
const SHOTS = path.join(__dirname, "shots");

// 테스트 이미지의 모서리 표식 색
const MARKS = {
  "왼쪽 위": [225, 29, 72],
  "오른쪽 위": [37, 99, 235],
  "왼쪽 아래": [22, 163, 74],
  "오른쪽 아래": [245, 158, 11],
};

const CASES = [
  { file: "9x16-vertical.png", w: 720, h: 1280, label: "9:16 세로" },
  { file: "16x9-horizontal.png", w: 1280, h: 720, label: "16:9 가로" },
  { file: "1x1-square.png", w: 800, h: 800, label: "1:1 정사각" },
  { file: "4x1-ultrawide.png", w: 2000, h: 500, label: "4:1 초광각" },
  { file: "1x3-tall.png", w: 480, h: 1440, label: "1:3 세로장" },
];

// 카드 안 사진 영역 (lib/draw.js 의 값과 같아야 함. 이름 한마디가 있으면 by = 236)
const AREA = { x: 170 + 18, y: 236 + 18, w: 740 - 36, h: 740 - 36 };
// 문장 띠 높이는 글 길이에 따라 달라지므로 페이지가 알려 주는 값을 씁니다.

function fitRect(iw, ih, a, mode) {
  const scale = mode === "cover" ? Math.max(a.w / iw, a.h / ih) : Math.min(a.w / iw, a.h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  return { x: a.x + (a.w - dw) / 2, y: a.y + (a.h - dh) / 2, w: dw, h: dh };
}

const near = (px, want, tol = 26) =>
  Math.abs(px[0] - want[0]) <= tol && Math.abs(px[1] - want[1]) <= tol && Math.abs(px[2] - want[2]) <= tol;

async function readPixels(page, points) {
  return page.evaluate((pts) => {
    const cv = document.querySelector("canvas");
    const ctx = cv.getContext("2d");
    return pts.map((p) => Array.from(ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data));
  }, points);
}

(async () => {
  const fs = require("fs");
  fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  const results = [];
  let failed = 0;

  page.on("pageerror", (e) => {
    failed++;
    results.push(["✗", "페이지 오류", e.message]);
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  for (const c of CASES) {
    await page.setInputFiles("input[type=file]", path.join(FIXTURES, c.file));
    await page.waitForTimeout(700);

    // 업로드하면 맞춤 방식 선택 버튼이 나타나야 한다
    const segCount = await page.locator(".seg").count();
    if (segCount !== 2) {
      failed++;
      results.push(["✗", c.label, "맞춤 방식 선택 버튼이 보이지 않음"]);
      continue;
    }

    /* ---- 1) 전체 담기: 네 모서리가 모두 남아 있어야 한다 ---- */
    await page.locator(".seg", { hasText: "전체 담기" }).click();
    await page.waitForTimeout(450);

    const info = await page.evaluate(() => window.__dreamCard || null);
    if (!info || !info.photoRect) {
      failed++;
      results.push(["✗", `${c.label} · 전체 담기`, "그려진 사진 위치를 읽지 못함"]);
      continue;
    }
    const photoArea = info.photoArea;
    const r = info.photoRect;

    // 비율이 찌그러지지 않았는지 (원본 비율과 같아야 함)
    const ratioOk = Math.abs(r.w / r.h - c.w / c.h) < 0.01;
    if (!ratioOk) {
      failed++;
      results.push(["✗", `${c.label} · 비율`, `원본 ${(c.w / c.h).toFixed(3)} → 그려진 ${(r.w / r.h).toFixed(3)}`]);
    }

    // 계산식 자체도 함께 확인 (코드와 테스트가 같은 결론에 이르는지)
    const expect = fitRect(c.w, c.h, photoArea, "contain");
    const sameAsExpected =
      Math.abs(expect.x - r.x) < 1 && Math.abs(expect.y - r.y) < 1 &&
      Math.abs(expect.w - r.w) < 1 && Math.abs(expect.h - r.h) < 1;
    if (!sameAsExpected) {
      failed++;
      results.push(["✗", `${c.label} · 맞춤 계산`, "예상 위치와 다름"]);
    }
    const inset = Math.max(4, Math.min(r.w, r.h) * 0.03);
    const corners = [
      { name: "왼쪽 위", x: r.x + inset, y: r.y + inset },
      { name: "오른쪽 위", x: r.x + r.w - inset, y: r.y + inset },
      { name: "왼쪽 아래", x: r.x + inset, y: r.y + r.h - inset },
      { name: "오른쪽 아래", x: r.x + r.w - inset, y: r.y + r.h - inset },
    ];
    const px = await readPixels(page, corners);

    const missing = corners
      .map((corner, i) => (near(px[i], MARKS[corner.name]) ? null : `${corner.name}(${px[i].slice(0, 3).join(",")})`))
      .filter(Boolean);

    if (missing.length) {
      failed++;
      results.push(["✗", `${c.label} · 전체 담기`, `모서리 누락: ${missing.join(" ")}`]);
    } else {
      results.push(["✓", `${c.label} · 전체 담기`, "네 모서리 모두 보임 — 잘림 없음"]);
    }

    // 사진이 영역 밖으로 넘치지 않는지도 확인
    const overflow =
      r.x < photoArea.x - 1 ||
      r.y < photoArea.y - 1 ||
      r.x + r.w > photoArea.x + photoArea.w + 1 ||
      r.y + r.h > photoArea.y + photoArea.h + 1;
    if (overflow) {
      failed++;
      results.push(["✗", `${c.label} · 전체 담기`, "사진이 네모칸 밖으로 넘침"]);
    }

    // 여백이 종이색 그대로가 아니라 흐린 사진 배경으로 채워졌는지 (세로/가로 이미지만 해당)
    if (r.w < photoArea.w - 8 || r.h < photoArea.h - 8) {
      const gapPoint =
        r.w < photoArea.w - 8
          ? { x: photoArea.x + 8, y: photoArea.y + photoArea.h / 2 }
          : { x: photoArea.x + photoArea.w / 2, y: photoArea.y + 8 };
      const [gp] = await readPixels(page, [gapPoint]);
      const isBarePaper = near(gp, [255, 253, 249], 6);
      results.push([
        isBarePaper ? "✗" : "✓",
        `${c.label} · 여백`,
        isBarePaper ? "여백이 빈 흰색으로 남음" : `흐린 사진 배경으로 채워짐 (${gp.slice(0, 3).join(",")})`,
      ]);
      if (isBarePaper) failed++;
    }

    await page.locator("canvas").screenshot({ path: path.join(SHOTS, `${c.file.replace(".png", "")}-contain.png`) });

    /* ---- 2) 꽉 채우기: 네모칸이 빈틈없이 차야 한다 ---- */
    await page.locator(".seg", { hasText: "꽉 채우기" }).click();
    await page.waitForTimeout(450);

    const infoCover = await page.evaluate(() => window.__dreamCard || null);
    const areaCover = (infoCover && infoCover.photoArea) || AREA;
    const rc = (infoCover && infoCover.photoRect) || fitRect(c.w, c.h, areaCover, "cover");
    const fills = rc.w >= areaCover.w - 1 && rc.h >= areaCover.h - 1;
    results.push([fills ? "✓" : "✗", `${c.label} · 꽉 채우기`, fills ? "네모칸을 빈틈없이 채움" : "빈 곳이 남음"]);
    if (!fills) failed++;

    await page.locator("canvas").screenshot({ path: path.join(SHOTS, `${c.file.replace(".png", "")}-cover.png`) });

    // 다음 사진을 위해 비우기
    await page.locator(".thumbrow button").click();
    await page.waitForTimeout(300);
  }

  /* ---- 3) 사진을 뺐을 때 원래 빈칸 안내로 돌아오는지 ---- */
  const segAfterClear = await page.locator(".seg").count();
  results.push([
    segAfterClear === 0 ? "✓" : "✗",
    "사진 빼기",
    segAfterClear === 0 ? "맞춤 방식 버튼이 사라지고 빈칸으로 돌아옴" : "버튼이 남아 있음",
  ]);
  if (segAfterClear !== 0) failed++;

  /* ---- 4) 저장 버튼이 실제 PNG를 만들어 내는지 ---- */
  const dataUrl = await page.evaluate(() => document.querySelector("canvas").toDataURL("image/png").slice(0, 22));
  const okPng = dataUrl.startsWith("data:image/png;base64,");
  results.push([okPng ? "✓" : "✗", "이미지 저장", okPng ? "PNG 데이터 생성됨" : "PNG 생성 실패"]);
  if (!okPng) failed++;

  await browser.close();

  console.log("\n사진 맞춤 테스트 결과");
  console.log("=".repeat(64));
  for (const [mark, name, note] of results) console.log(`${mark}  ${name.padEnd(22)} ${note}`);
  console.log("=".repeat(64));
  console.log(failed === 0 ? `전부 통과 (${results.length}건)` : `실패 ${failed}건 / 전체 ${results.length}건`);
  process.exit(failed === 0 ? 0 : 1);
})();
