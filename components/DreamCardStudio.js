"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_H, CARD_W, DREAM_MAX, drawCard } from "@/lib/draw";
import { pickQuote } from "@/lib/quotes";

const SAMPLE_DREAM = "3년 안에 바다가 보이는 작은 숙소의 주인이 되기";
const SAMPLE_WHO = "길원의 꿈";

const LONG_PRESS_GUIDE =
  '아래 이미지를 길게 눌러(PC는 오른쪽 클릭) "이미지 저장"을 선택하면 됩니다. 그다음 카카오톡에서 사진으로 보내세요.';

/** 올린 사진의 크기를 사람이 읽기 쉬운 비율로 알려 줍니다. */
function describeRatio(w, h) {
  const r = w / h;
  const near = (target) => Math.abs(r - target) < 0.06;
  let name = `${w}×${h}`;
  if (near(9 / 16)) name += " · 9:16 세로";
  else if (near(16 / 9)) name += " · 16:9 가로";
  else if (near(1)) name += " · 정사각";
  else if (near(3 / 4)) name += " · 3:4 세로";
  else if (near(4 / 3)) name += " · 4:3 가로";
  else name += r < 1 ? " · 세로" : " · 가로";
  return name;
}

export default function DreamCardStudio() {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const statusTimer = useRef(null);

  const [dream, setDream] = useState(SAMPLE_DREAM);
  const [who, setWho] = useState(SAMPLE_WHO);
  const [fileName, setFileName] = useState("");
  const [thumb, setThumb] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fit, setFit] = useState("contain"); // 기본은 사진 전체가 다 보이게
  const [ratio, setRatio] = useState("");
  const [tick, setTick] = useState(0);
  const [saveUrl, setSaveUrl] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const [status, setStatus] = useState(null);
  const [inApp, setInApp] = useState("");
  const [openHref, setOpenHref] = useState("");
  const [openLabel, setOpenLabel] = useState("");
  const [host, setHost] = useState("dream.nolstay.com");

  // 공유 버튼은 숨기지 않습니다. 기능이 없는 브라우저에서는 눌렀을 때 다른 방법으로 안내합니다.
  useEffect(() => {
    setCanShare(true);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    if (/KAKAOTALK/i.test(ua)) setInApp("카카오톡");
    else if (/Instagram/i.test(ua)) setInApp("인스타그램");
    else if (/NAVER\(inapp/i.test(ua)) setInApp("네이버 앱");
    else if (/FBAN|FBAV/i.test(ua)) setInApp("페이스북");
    else if (/Line\//i.test(ua)) setInApp("라인");

    // 앱 안 브라우저에서 한 번에 크롬(안드로이드)·사파리(아이폰)로 넘어가는 주소
    const here = window.location.href;
    if (window.location.host) setHost(window.location.host);
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setOpenHref("x-safari-" + here);
      setOpenLabel("사파리에서 열기");
    } else {
      const bare = here.replace(/^https?:\/\//, "");
      setOpenHref(`intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`);
      setOpenLabel("크롬에서 열기");
    }
    setCanCopy(
      typeof window !== "undefined" &&
        typeof window.ClipboardItem === "function" &&
        !!navigator.clipboard &&
        typeof navigator.clipboard.write === "function"
    );
  }, []);

  const quote = pickQuote(dream);

  const render = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const info = drawCard(ctx, { dream, who, image: imageRef.current, fit, quote });
    // 카드에 실제로 그려진 줄 — 자동 검증에서 글자가 빠지지 않았는지 확인할 때 씁니다.
    if (typeof window !== "undefined") window.__dreamCard = info;
  }, [dream, who, fit, quote]);

  // 입력이 바뀌거나 사진이 바뀌면 다시 그립니다.
  useEffect(() => {
    render();
  }, [render, tick]);

  // 웹폰트가 늦게 도착하면 폰트가 적용된 상태로 한 번 더 그립니다.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) render();
    });
    return () => {
      alive = false;
    };
  }, [render]);

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setThumb(String(e.target.result));
        setFileName(file.name);
        setRatio(describeRatio(img.width, img.height));
        setTick((n) => n + 1);
      };
      img.src = String(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    imageRef.current = null;
    setThumb("");
    setFileName("");
    setRatio("");
    if (fileRef.current) fileRef.current.value = "";
    setTick((n) => n + 1);
  };

  const makeFileName = () => `dream-card-${new Date().toISOString().slice(0, 10)}.png`;

  const canvasBlob = () =>
    new Promise((resolve) => {
      const cv = canvasRef.current;
      if (!cv) return resolve(null);
      cv.toBlob(resolve, "image/png");
    });

  // 저장·복사·공유의 결과를 버튼 바로 아래 한 곳에서 알려 줍니다.
  const flash = (kind, msg) => {
    setStatus({ kind, msg });
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 9000);
  };

  // 저장이 막힌 환경을 위해 완성 이미지를 화면에 띄웁니다. (길게 눌러 저장)
  const showSaveImage = (message) => {
    const cv = canvasRef.current;
    if (!cv) return;
    setSaveMsg(message);
    setSaveUrl(cv.toDataURL("image/png"));
  };

  const download = async () => {
    const cv = canvasRef.current;
    if (!cv) return;

    // 앱 안 브라우저는 다운로드가 막혀 있으므로 곧바로 길게 눌러 저장하도록 안내합니다.
    if (inApp) {
      flash("warn", `${inApp} 안 브라우저는 저장이 막혀 있습니다. 아래 방법으로 저장하세요.`);
      showSaveImage(LONG_PRESS_GUIDE);
      return;
    }

    try {
      const blob = await canvasBlob();
      if (!blob) throw new Error("no blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = makeFileName();
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      flash("ok", `저장했습니다. 브라우저의 다운로드 폴더에서 ${makeFileName()} 을 확인하세요.`);
    } catch {
      flash("warn", "저장이 막혀 있습니다. 아래 이미지로 저장하세요.");
      showSaveImage(LONG_PRESS_GUIDE);
    }
  };

  // 카톡·문서에 Ctrl+V 로 바로 붙여넣을 수 있게 이미지 자체를 클립보드에 넣습니다.
  // ClipboardItem 은 클릭과 같은 동작 안에서 만들어야 하므로 Blob 대신 Promise 를 넘깁니다.
  const copyImage = async () => {
    try {
      const item = new ClipboardItem({ "image/png": canvasBlob() });
      await navigator.clipboard.write([item]);
      flash("ok", "복사했습니다. 카카오톡 대화창을 클릭한 뒤 Ctrl+V 를 누르세요.");
    } catch {
      flash("warn", "이 브라우저에서는 복사가 막혀 있습니다. 아래 이미지를 오른쪽 클릭해 \"이미지 복사\"를 선택하세요.");
      showSaveImage(
        '아래 이미지를 오른쪽 클릭해 "이미지 복사" 또는 "다른 이름으로 저장"을 선택하세요.'
      );
    }
  };

  // 주소창에 직접 붙여넣을 수 있게 페이지 주소를 복사합니다.
  const copyAddress = async () => {
    const url = window.location.origin + "/";
    try {
      await navigator.clipboard.writeText(url);
      flash("ok", `주소를 복사했습니다. 크롬 주소창에 붙여넣으세요. (${url.replace(/^https?:\/\//, "")})`);
    } catch {
      flash("warn", `주소를 직접 입력해 주세요 — ${url.replace(/^https?:\/\//, "")}`);
    }
  };

  // 어떤 브라우저에서도 통하는 마지막 수단 — 카드를 새 탭에 그대로 띄웁니다.
  const openInNewTab = async () => {
    const blob = await canvasBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      flash("warn", "새 탭이 차단되었습니다. 아래 이미지를 눌러 저장하세요.");
      showSaveImage(LONG_PRESS_GUIDE);
    } else {
      flash("ok", "새 탭에 카드를 열었습니다. 그 화면에서 저장하거나 복사하세요.");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const share = async () => {
    // 1) 이미지 파일 자체를 공유 (사진첩 저장·카톡 전송이 한 번에 됩니다)
    try {
      const blob = await canvasBlob();
      if (blob && typeof navigator.share === "function") {
        const file = new File([blob], makeFileName(), { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "나의 꿈 카드" });
          return;
        }
      }
    } catch (err) {
      // 사용자가 공유창을 닫은 경우에는 더 안내하지 않습니다.
      if (err && err.name === "AbortError") return;
    }

    // 2) 파일 공유가 막혀 있으면 페이지 주소라도 공유
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "꿈 채움 카드",
          text: "여기에 내 꿈을 적어 카드로 만들어 보세요.",
          url: window.location.href,
        });
        flash("ok", "주소를 공유했습니다.");
        showSaveImage("카드 그림 자체를 보내시려면 " + LONG_PRESS_GUIDE);
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }

    // 3) 공유 기능이 아예 없는 브라우저 (카카오톡 안 브라우저 등)
    flash("warn", "이 브라우저는 공유 기능이 없습니다. 아래 방법으로 보내세요.");
    showSaveImage(LONG_PRESS_GUIDE);
  };

  return (
    <>
      <header className="hero">
        <span className="chip">잠깐!</span>
        <h1>
          <span className="p">당신의 꿈을</span>
          <br />
          <span className="t">채워보세요</span>
        </h1>
        <p className="lead">
          빈칸에 이루고 싶은 꿈을 적거나 사진 한 장을 올려주세요. 9:16 세로 카드로 다시 그려
          드리고, 그 꿈에 어울리는 <b>오늘의 명언</b> 한 문장을 함께 담아 드립니다.
        </p>
        <div className="divider" />
      </header>

      <main className="wrap">
        <div className="studio">
          <section className="panel">
            {inApp ? (
              <div className="inapp" id="inapp" role="note">
                <strong>{inApp} 안의 브라우저로 보고 계십니다.</strong>
                여기서는 저장과 공유가 막혀 있습니다. 아래 버튼으로 넘어가시면 모든 기능이 정상
                동작합니다.
                <span className="inapprow">
                  <a className="inappbtn" id="openbrowser" href={openHref}>
                    {openLabel}
                  </a>
                  <button type="button" className="inappbtn ghostbtn" id="copyaddr" onClick={copyAddress}>
                    주소 복사
                  </button>
                </span>
                <span className="addr">
                  버튼이 안 되면 주소창에 <b id="plainaddr">{host}</b> 을 직접 입력하세요.
                </span>
              </div>
            ) : null}

            <div className="step">
              <b>01</b>
              <h2>꿈을 적어보세요</h2>
            </div>
            <p className="hint">100자까지 담을 수 있습니다. 길어지면 카드에서 글자 크기가 자동으로 맞춰집니다.</p>

            <div className="field">
              <label className="lbl" htmlFor="dream">
                나의 꿈
                <em className="count" id="count">
                  {dream.length} / {DREAM_MAX}자
                </em>
              </label>
              <textarea
                id="dream"
                value={dream}
                maxLength={DREAM_MAX}
                onChange={(e) => setDream(e.target.value.slice(0, DREAM_MAX))}
                placeholder="예) 3년 안에 바다가 보이는 작은 숙소의 주인이 되기"
              />
            </div>

            <div className="field">
              <label className="lbl" htmlFor="who">
                이름 또는 한마디 (선택)
              </label>
              <input
                id="who"
                type="text"
                value={who}
                onChange={(e) => setWho(e.target.value)}
                placeholder="예) 길원의 꿈"
              />
            </div>

            <div className="field">
              <span className="lbl">사진 넣기 (선택)</span>
              <div
                className={dragging ? "drop on" : "drop"}
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  loadFile(e.dataTransfer.files[0]);
                }}
              >
                <strong>사진을 끌어다 놓거나 클릭</strong>
                꿈을 담은 이미지 한 장 · JPG · PNG
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => loadFile(e.target.files?.[0])}
              />

              {thumb ? (
                <div className="thumbrow">
                  {/* 사용자가 방금 고른 로컬 파일이라 next/image 대신 img를 씁니다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt="올린 사진 미리보기" />
                  <span>
                    {fileName}
                    {ratio ? <em className="ratio">{ratio}</em> : null}
                  </span>
                  <button type="button" className="ghost mini" onClick={clearImage}>
                    빼기
                  </button>
                </div>
              ) : null}
            </div>

            {thumb ? (
              <div className="fitrow" role="group" aria-label="사진 맞춤 방식">
                <button
                  type="button"
                  className={fit === "contain" ? "seg on" : "seg"}
                  aria-pressed={fit === "contain"}
                  onClick={() => setFit("contain")}
                >
                  전체 담기
                  <small>사진이 하나도 잘리지 않습니다</small>
                </button>
                <button
                  type="button"
                  className={fit === "cover" ? "seg on" : "seg"}
                  aria-pressed={fit === "cover"}
                  onClick={() => setFit("cover")}
                >
                  꽉 채우기
                  <small>네모칸을 채우고 바깥을 자릅니다</small>
                </button>
              </div>
            ) : null}

            <div className="btnrow">
              <button type="button" id="download" className="primary" onClick={download}>
                이미지 저장
              </button>
              {canCopy ? (
                <button type="button" id="copy" className="ghost" onClick={copyImage}>
                  이미지 복사
                </button>
              ) : null}
              {canShare ? (
                <button type="button" id="share" className="ghost" onClick={share}>
                  공유하기
                </button>
              ) : null}
            </div>

            {status ? (
              <p className={status.kind === "ok" ? "status ok" : "status warn"} id="status" role="status">
                {status.msg}
              </p>
            ) : null}

            <p className="alt">
              잘 안 되나요?{" "}
              <button type="button" className="linkbtn" id="opentab" onClick={openInNewTab}>
                새 탭에서 카드 열기
              </button>
              <span aria-hidden="true"> · </span>
              <button
                type="button"
                className="linkbtn"
                id="showimg"
                onClick={() => showSaveImage(LONG_PRESS_GUIDE)}
              >
                이 화면에서 이미지로 받기
              </button>
            </p>

            <p className="tiny">
              <b>이미지 복사</b>를 누르면 카카오톡 대화창이나 문서에 <b>Ctrl+V</b>로 바로
              붙여넣을 수 있습니다. 휴대폰에서는 <b>공유하기</b>로 사진첩에 저장하거나 카톡으로
              바로 보낼 수 있습니다. 사진은 이 브라우저 안에서만 처리되며 서버로 올라가지 않습니다.
            </p>

            {saveUrl ? (
              <div className="saveout" id="saveout">
                <p className="savemsg" id="savemsg">{saveMsg}</p>
                {/* 캔버스에서 바로 만든 이미지라 next/image 를 쓰지 않습니다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img id="saveimg" src={saveUrl} alt="완성된 꿈 카드 — 길게 눌러 저장하세요" />
                <a className="savelink" id="savelink" href={saveUrl} download={makeFileName()}>
                  새 창에서 열기
                </a>
              </div>
            ) : null}
          </section>

          <section className="stage">
            <div className="cap">
              <span>미리보기</span>
              <span>
                {CARD_W} × {CARD_H} · 9:16
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={CARD_W}
              height={CARD_H}
              aria-label="완성된 꿈 카드 미리보기"
            />
            <div className="quotebox">
              <em>“{quote.text}”</em>
              <small>오늘의 명언 · {quote.source}</small>
            </div>
          </section>
        </div>

        <div className="foot">
          <span>
            꿈은 적는 순간, 방향이 됩니다.
            <em className="tip">
              휴대폰에서 브라우저 메뉴의 <b>홈 화면에 추가</b>를 누르면 앱처럼 바로 열립니다.
            </em>
          </span>
          <span>
            <b>우산 쓴 고양이</b> 놀스테이(구, 모텔사랑) 대표 이길원 · 잘잘잘tv
          </span>
        </div>
      </main>
    </>
  );
}
