export const CARD_W = 1080;
export const CARD_H = 1920; // 9:16

/** 꿈 문장 최대 글자 수 — 입력창과 카드가 같은 값을 씁니다. */
export const DREAM_MAX = 100;
/** 사진 아래 문장 띠에서 글이 차지할 수 있는 최대 높이와 위아래 여백 */
const CAPTION_MAX_H = 240;
const CAPTION_PAD = 46;
/** 꽉 채우기에서 사진 위에 올리는 문장의 최대 높이 */
const OVERLAY_MAX_H = 250;

/* ---------- 그리기 도우미 ---------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function blob(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function star(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x + s * 0.16, y - s * 0.16, x + s, y);
  ctx.quadraticCurveTo(x + s * 0.16, y + s * 0.16, x, y + s);
  ctx.quadraticCurveTo(x - s * 0.16, y + s * 0.16, x - s, y);
  ctx.quadraticCurveTo(x - s * 0.16, y - s * 0.16, x, y - s);
  ctx.closePath();
  ctx.fill();
}

/**
 * 이미지를 정해진 영역에 맞추는 사각형을 계산합니다.
 * mode "contain" — 이미지 전체가 다 보이도록 (잘림 없음). 9:16, 16:9 모두 전부 노출됩니다.
 * mode "cover"   — 영역을 가득 채우도록 (바깥쪽이 잘림).
 * @returns {{x:number,y:number,w:number,h:number,scale:number}}
 */
export function fitRect(imgW, imgH, x, y, w, h, mode = "contain") {
  const safeW = Math.max(1, imgW);
  const safeH = Math.max(1, imgH);
  const scale =
    mode === "cover"
      ? Math.max(w / safeW, h / safeH)
      : Math.min(w / safeW, h / safeH);
  const dw = safeW * scale;
  const dh = safeH * scale;
  return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh, scale };
}

/** 한글은 단어 단위로 끊기지 않으므로 글자 단위까지 내려가며 줄바꿈합니다. */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  const parts = String(text).split(/(\s+)/);

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      if (line) line += " ";
      continue;
    }
    let chunk = "";
    for (const ch of part) {
      const test = line + chunk + ch;
      if (ctx.measureText(test).width > maxWidth && (line + chunk) !== "") {
        lines.push((line + chunk).trim());
        line = "";
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    line += chunk;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/**
 * 주어진 폭·높이 안에 글이 다 들어가도록 글자 크기를 자동으로 낮춰 줄을 나눕니다.
 * 100자까지 한 글자도 잘리지 않게 하는 것이 목적입니다.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text 담을 글
 * @param {number} maxWidth 한 줄 최대 폭
 * @param {number} maxHeight 글 전체가 차지할 수 있는 최대 높이
 * @param {number[]} sizes 큰 크기부터 시도할 글자 크기 목록
 * @param {(size:number)=>string} fontOf 크기를 받아 CSS font 문자열을 돌려주는 함수
 * @param {number} lineFactor 줄 간격 배수
 * @returns {{size:number, lines:string[], lineHeight:number, height:number, fits:boolean}}
 */
export function layoutText(ctx, text, maxWidth, maxHeight, sizes, fontOf, lineFactor = 1.45) {
  let last = null;
  for (const size of sizes) {
    ctx.font = fontOf(size);
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = Math.round(size * lineFactor);
    const height = lines.length * lineHeight;
    last = { size, lines, lineHeight, height, fits: height <= maxHeight };
    if (last.fits) return last;
  }
  // 가장 작은 크기로도 넘칠 때 (100자 제한 안에서는 사실상 생기지 않습니다)
  return last;
}

/** 우산 쓴 고양이가 두 손을 들고 화이팅을 외치는 그림 */
function drawCat(ctx, cx, cy, scale) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // 우산
  ctx.fillStyle = "#E9B7A3";
  ctx.beginPath();
  ctx.moveTo(-96, -96);
  ctx.quadraticCurveTo(0, -192, 96, -96);
  ctx.quadraticCurveTo(48, -76, 0, -96);
  ctx.quadraticCurveTo(-48, -76, -96, -96);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#B98B76";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -140);
  ctx.lineTo(0, -96);
  ctx.stroke();

  // 몸
  ctx.fillStyle = "#FFFCF6";
  ctx.strokeStyle = "#5B4E74";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(0, 58, 54, 58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 만세 한 두 팔
  ctx.beginPath();
  ctx.moveTo(-44, 34);
  ctx.lineTo(-88, -24);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(44, 34);
  ctx.lineTo(88, -24);
  ctx.stroke();
  ctx.fillStyle = "#FFFCF6";
  ctx.beginPath();
  ctx.arc(-92, -30, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(92, -30, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 머리와 귀
  ctx.beginPath();
  ctx.arc(0, -24, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-46, -52);
  ctx.lineTo(-38, -92);
  ctx.lineTo(-12, -62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(46, -52);
  ctx.lineTo(38, -92);
  ctx.lineTo(12, -62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 표정
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#3B3252";
  ctx.beginPath();
  ctx.moveTo(-30, -30);
  ctx.lineTo(-19, -40);
  ctx.lineTo(-8, -30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, -30);
  ctx.lineTo(19, -40);
  ctx.lineTo(30, -30);
  ctx.stroke();
  ctx.fillStyle = "#E4879A";
  ctx.beginPath();
  ctx.arc(0, -14, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-14, -4);
  ctx.quadraticCurveTo(0, 8, 14, -4);
  ctx.stroke();

  // 수염
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#8B7FA6";
  ctx.beginPath();
  ctx.moveTo(-52, -16);
  ctx.lineTo(-30, -14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(52, -16);
  ctx.lineTo(30, -14);
  ctx.stroke();

  ctx.restore();
}

/* ---------- 카드 한 장 ---------- */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{dream?:string, who?:string, image?:HTMLImageElement|null,
 *          fit?:"contain"|"cover", quote:{text:string, source:string},
 *          signature?:string, tagline?:string}} opts
 */
export function drawCard(ctx, opts) {
  const W = CARD_W;
  const H = CARD_H;
  const dream = (opts.dream || "").trim();
  const who = (opts.who || "").trim();
  const img = opts.image || null;
  // "contain" — 사진 전체가 다 보이게(기본), "cover" — 네모칸을 꽉 채우고 잘라내기
  const fit = opts.fit === "cover" ? "cover" : "contain";
  const quote = opts.quote;
  const signature = opts.signature || "우산 쓴 고양이  놀스테이(구, 모텔사랑) 대표 이길원 · 잘잘잘tv";
  const tagline = opts.tagline || "꿈은 적는 순간, 방향이 됩니다.";

  // 그려진 결과를 알려 주는 정보 (테스트와 화면 안내에 씁니다)
  const info = { dreamLines: [], dreamSize: 0, dreamFits: true, photoRect: null, captionH: 0, photoArea: null };

  ctx.clearRect(0, 0, W, H);

  // 수채화 종이 바탕
  ctx.fillStyle = "#FBF5EE";
  ctx.fillRect(0, 0, W, H);
  blob(ctx, 80, 60, 540, "rgba(214,199,235,.75)");
  blob(ctx, 1010, 300, 560, "rgba(197,219,232,.7)");
  blob(ctx, 120, 1780, 620, "rgba(180,205,218,.55)");
  blob(ctx, 960, 1700, 520, "rgba(246,214,190,.7)");
  blob(ctx, 540, 980, 700, "rgba(255,250,242,.85)");

  // 종이결 (같은 무늬가 나오도록 고정 시드)
  let seed = 20260909;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#8C7BA6";
  for (let i = 0; i < 900; i++) ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
  ctx.globalAlpha = 1;

  // 금박 테두리
  ctx.strokeStyle = "rgba(192,154,69,.55)";
  ctx.lineWidth = 2;
  roundRect(ctx, 34, 34, W - 68, H - 68, 26);
  ctx.stroke();

  ctx.textAlign = "center";

  // 머리말
  ctx.fillStyle = "#C09A45";
  ctx.font = '600 26px "Gowun Dodum", sans-serif';
  ctx.fillText("나 의   꿈   ·   D R E A M   C A R D", W / 2, 128);
  star(ctx, 190, 120, 13, "rgba(192,154,69,.75)");
  star(ctx, 890, 120, 13, "rgba(192,154,69,.75)");

  if (who) {
    ctx.fillStyle = "#6B4AA8";
    ctx.font = '400 40px "Gowun Batang", serif';
    ctx.fillText(who, W / 2, 196);
  }

  // ── 꿈 상자 ──
  const bx = 170;
  const by = who ? 236 : 216;
  const bw = 740;
  const bh = 740;

  ctx.save();
  ctx.shadowColor = "rgba(57,48,76,.22)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#FFFDF9";
  roundRect(ctx, bx, by, bw, bh, 30);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#C09A45";
  ctx.lineWidth = 6;
  roundRect(ctx, bx, by, bw, bh, 30);
  ctx.stroke();
  ctx.strokeStyle = "#7B62B5";
  ctx.lineWidth = 3;
  roundRect(ctx, bx + 14, by + 14, bw - 28, bh - 28, 20);
  ctx.stroke();

  if (img) {
    // 사진이 놓일 영역 (금박 테두리 안쪽)
    const ax = bx + 18;
    const ay = by + 18;
    const aw = bw - 36;
    const ah = bh - 36;

    // "전체 담기"에서 꿈 문장이 있으면 문장 자리를 따로 비워 두어
    // 사진 위를 덮지 않게 합니다. (사진이 하나도 가려지지 않습니다)
    // 띠 높이는 글 길이에 맞춰 늘어나므로 100자도 잘리지 않습니다.
    let capLayout = null;
    let capH = 0;
    if (dream && fit === "contain") {
      capLayout = layoutText(
        ctx,
        dream,
        aw - 90,
        CAPTION_MAX_H,
        [44, 40, 36, 32, 29, 26],
        (n) => `400 ${n}px "Gowun Batang", serif`
      );
      capH = capLayout.height + CAPTION_PAD;
    }
    const ph = ah - capH;

    ctx.save();
    roundRect(ctx, ax, ay, aw, ah, 18);
    ctx.clip();

    if (fit === "contain") {
      // 남는 여백은 같은 사진을 크게 깔고 흐리게 처리해 채웁니다.
      const back = fitRect(img.width, img.height, ax, ay, aw, ah, "cover");
      ctx.save();
      const canBlur = typeof ctx.filter === "string";
      if (canBlur) ctx.filter = "blur(30px) saturate(1.15)";
      else ctx.globalAlpha = 0.35;
      ctx.drawImage(img, back.x - 30, back.y - 30, back.w + 60, back.h + 60);
      ctx.restore();
      // 흐린 배경을 한 겹 눌러 사진 본체가 또렷하게 보이도록 합니다.
      ctx.fillStyle = "rgba(251,245,238,.42)";
      ctx.fillRect(ax, ay, aw, ah);
    }

    const r = fitRect(img.width, img.height, ax, ay, aw, ph, fit);
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    info.photoRect = { x: r.x, y: r.y, w: r.w, h: r.h };
    info.captionH = capH;
    info.photoArea = { x: ax, y: ay, w: aw, h: ph };

    if (fit === "contain") {
      // 사진과 여백의 경계를 살짝 구분해 줍니다.
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x + 1.5, r.y + 1.5, Math.max(0, r.w - 3), Math.max(0, r.h - 3));
    }
    ctx.restore();

    if (dream) {
      ctx.save();
      roundRect(ctx, ax, ay, aw, ah, 18);
      ctx.clip();

      if (capH > 0) {
        // 사진 아래 따로 마련한 띠에 문장을 씁니다.
        const cy0 = ay + ah - capH;
        ctx.fillStyle = "rgba(35,28,50,.72)";
        ctx.fillRect(ax, cy0, aw, capH);
        ctx.fillStyle = "rgba(255,255,255,.28)";
        ctx.fillRect(ax, cy0, aw, 2);
        ctx.fillStyle = "#FFFDF9";
        ctx.font = `400 ${capLayout.size}px "Gowun Batang", serif`;
        const startY = cy0 + CAPTION_PAD / 2 + capLayout.size * 0.82;
        capLayout.lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * capLayout.lineHeight));
        info.dreamLines = capLayout.lines;
        info.dreamSize = capLayout.size;
        info.dreamFits = capLayout.fits;
      } else {
        // 꽉 채우기에서는 사진 위에 그라데이션을 얹어 문장을 올립니다.
        const lay = layoutText(
          ctx,
          dream,
          aw - 100,
          OVERLAY_MAX_H,
          [48, 44, 40, 36, 32, 29, 26],
          (n) => `400 ${n}px "Gowun Batang", serif`
        );
        const bandH = lay.height + 96;
        const g = ctx.createLinearGradient(0, ay + ah - bandH, 0, ay + ah);
        g.addColorStop(0, "rgba(35,28,50,0)");
        g.addColorStop(0.45, "rgba(35,28,50,.62)");
        g.addColorStop(1, "rgba(35,28,50,.9)");
        ctx.fillStyle = g;
        ctx.fillRect(ax, ay + ah - bandH, aw, bandH);
        ctx.fillStyle = "#FFFDF9";
        ctx.font = `400 ${lay.size}px "Gowun Batang", serif`;
        const y0 = ay + ah - 40 - (lay.lines.length - 1) * lay.lineHeight;
        lay.lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lay.lineHeight));
        info.dreamLines = lay.lines;
        info.dreamSize = lay.size;
        info.dreamFits = lay.fits;
      }
      ctx.restore();
    }
  } else if (dream) {
    ctx.fillStyle = "#39304C";
    const lay = layoutText(
      ctx,
      dream,
      bw - 130,
      bh - 140,
      [70, 62, 56, 50, 44, 40, 36, 32, 29],
      (n) => `700 ${n}px "Gowun Batang", serif`,
      1.5
    );
    ctx.font = `700 ${lay.size}px "Gowun Batang", serif`;
    const sy = by + bh / 2 - ((lay.lines.length - 1) * lay.lineHeight) / 2;
    lay.lines.forEach((l, i) => ctx.fillText(l, W / 2, sy + i * lay.lineHeight + lay.size * 0.34));
    info.dreamLines = lay.lines;
    info.dreamSize = lay.size;
    info.dreamFits = lay.fits;
  } else {
    ctx.fillStyle = "#B6A9C9";
    ctx.font = '400 40px "Gowun Dodum", sans-serif';
    ctx.fillText("이 빈칸에 당신의 꿈을", W / 2, by + bh / 2 - 16);
    ctx.fillText("적거나 그려보세요", W / 2, by + bh / 2 + 42);
  }

  // ── 응원 밴드 ──
  const cyc = by + bh + 250;

  ctx.save();
  ctx.translate(700, cyc - 24);
  for (let r = 0; r < 20; r++) {
    ctx.rotate((Math.PI * 2) / 20);
    ctx.fillStyle = r % 2 ? "rgba(192,154,69,.18)" : "rgba(123,98,181,.15)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(238, -22);
    ctx.lineTo(238, 22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  drawCat(ctx, 255, cyc - 10, 0.86);

  ctx.textAlign = "left";
  ctx.fillStyle = "#2C6B5C";
  ctx.font = '400 148px "Black Han Sans", sans-serif';
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,.95)";
  ctx.shadowBlur = 22;
  ctx.fillText("화이팅!", 430, cyc + 38);
  ctx.restore();
  ctx.fillStyle = "#6B4AA8";
  ctx.font = '400 32px "Gowun Dodum", sans-serif';
  ctx.fillText("당신의 꿈을 크게 응원합니다", 436, cyc + 96);
  ctx.textAlign = "center";

  // ── 오늘의 명언 ──
  const qy = cyc + 250;
  ctx.strokeStyle = "rgba(192,154,69,.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(330, qy - 70);
  ctx.lineTo(750, qy - 70);
  ctx.stroke();
  star(ctx, 540, qy - 70, 15, "#C09A45");

  ctx.fillStyle = "#C09A45";
  ctx.font = '600 25px "Gowun Dodum", sans-serif';
  ctx.fillText("오 늘 의   명 언", W / 2, qy - 14);

  // 긴 명언은 한 단계 작은 글자로 담아 꼬리말과 부딪히지 않게 합니다.
  ctx.fillStyle = "#39304C";
  ctx.font = '400 46px "Gowun Batang", serif';
  let quoteSize = 46;
  let ql = wrapText(ctx, `“${quote.text}”`, 820);
  if (ql.length > 2) {
    quoteSize = 38;
    ctx.font = `400 ${quoteSize}px "Gowun Batang", serif`;
    ql = wrapText(ctx, `“${quote.text}”`, 840);
  }
  const qlh = Math.round(quoteSize * 1.48);
  ql.forEach((l, i) => ctx.fillText(l, W / 2, qy + 56 + i * qlh));
  ctx.fillStyle = "#6E6382";
  ctx.font = '400 30px "Gowun Dodum", sans-serif';
  ctx.fillText(`— ${quote.source}`, W / 2, qy + 74 + ql.length * qlh);

  // ── 꼬리말 ──
  ctx.fillStyle = "#6B4AA8";
  ctx.font = '400 52px "Black Han Sans", sans-serif';
  ctx.fillText(tagline, W / 2, H - 150);
  ctx.fillStyle = "#8B7FA6";
  ctx.font = '400 26px "Gowun Dodum", sans-serif';
  ctx.fillText(signature, W / 2, H - 96);

  return info;
}
