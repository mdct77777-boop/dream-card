/**
 * 이미지 복사(클립보드) 검증
 *
 * "이미지 복사"를 누르면 클립보드에 PNG 이미지 자체가 들어가는지,
 * 그래서 카카오톡이나 문서에 Ctrl+V 로 붙여넣을 수 있는 상태가 되는지 확인합니다.
 * 클립보드를 실제로 다시 읽어서 이미지인지, 손상되지 않았는지까지 봅니다.
 */
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const results = [];
  let failed = 0;

  const ok = (name, pass, note) => {
    results.push([pass ? "✓" : "✗", name, note]);
    if (!pass) failed++;
  };

  page.on("pageerror", (e) => ok("페이지 오류", false, e.message));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 복사 버튼이 보이는지
  const copyBtn = page.locator("#copy");
  const visible = await copyBtn.isVisible().catch(() => false);
  ok("복사 버튼 표시", visible, visible ? "이미지 복사 버튼 있음" : "버튼이 없음");

  if (!visible) {
    await browser.close();
    console.log("\n복사 버튼이 없어 이후 검증을 진행할 수 없습니다.");
    process.exit(1);
  }

  // 사진까지 넣은 상태로 복사
  await page.setInputFiles("input[type=file]", path.join(__dirname, "fixtures", "9x16-vertical.png"));
  await page.waitForTimeout(800);

  await copyBtn.click();
  await page.waitForTimeout(1200);

  // 클립보드를 실제로 다시 읽어 본다
  const clip = await page.evaluate(async () => {
    try {
      const items = await navigator.clipboard.read();
      const out = [];
      for (const item of items) {
        for (const type of item.types) {
          const blob = await item.getType(type);
          const buf = new Uint8Array(await blob.arrayBuffer());
          out.push({
            type,
            size: buf.length,
            // PNG 머리글 89 50 4E 47
            png: buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
            // IHDR 안에 들어 있는 가로·세로
            width: (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19],
            height: (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23],
          });
        }
      }
      return { ok: true, items: out };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  if (!clip.ok) {
    ok("클립보드 읽기", false, clip.error);
  } else {
    const img = clip.items.find((i) => i.type === "image/png");
    ok("클립보드에 이미지", !!img, img ? `image/png · ${Math.round(img.size / 1024)}KB` : `들어 있는 형식: ${clip.items.map((i) => i.type).join(", ") || "없음"}`);
    if (img) {
      ok("PNG 형식", img.png, img.png ? "정상 PNG 머리글" : "PNG가 아님");
      ok("9:16 크기", img.width === 1080 && img.height === 1920, `${img.width}×${img.height}`);
    }
  }

  // 복사했다는 안내가 화면에 뜨는지
  const msg = await page.locator("#copymsg").textContent().catch(() => "");
  ok("복사 안내 문구", !!msg && msg.includes("붙여넣"), msg ? msg.trim() : "안내가 없음");

  // 복사 후에도 저장이 여전히 되는지
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
    page.locator("#download").click(),
  ]);
  ok("복사 후 저장", !!dl, dl ? dl.suggestedFilename() : "다운로드되지 않음");

  await browser.close();

  console.log("\n이미지 복사 테스트 결과");
  console.log("=".repeat(62));
  for (const [m, n, note] of results) console.log(`${m}  ${n.padEnd(16)} ${note}`);
  console.log("=".repeat(62));
  console.log(failed === 0 ? `전부 통과 (${results.length}건)` : `실패 ${failed}건 / 전체 ${results.length}건`);
  process.exit(failed === 0 ? 0 : 1);
})();
