"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_H, CARD_W, DREAM_MAX, drawCard } from "@/lib/draw";
import { pickQuote } from "@/lib/quotes";

const SAMPLE_DREAM = "3년 안에 바다가 보이는 작은 숙소의 주인이 되기";
const SAMPLE_WHO = "길원의 꿈";

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

  // navigator.canShare 는 브라우저에서만 있으므로 화면이 뜬 뒤 확인합니다.
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.canShare === "function");
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

  // 다운로드가 막힌 환경(앱 안 미리보기 등)을 위해 완성 이미지를 화면에 띄웁니다.
  const showSaveImage = (message) => {
    const cv = canvasRef.current;
    if (!cv) return;
    setSaveMsg(message);
    setSaveUrl(cv.toDataURL("image/png"));
  };

  const download = async () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const name = makeFileName();

    try {
      const blob = await canvasBlob();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
      }
    } catch {
      /* 아래 안내로 넘어갑니다 */
    }

    showSaveImage(
      '저장이 시작되지 않았다면 아래 이미지를 길게 눌러(PC는 오른쪽 클릭) "이미지 저장"을 선택하세요.'
    );
  };

  // 휴대폰: 사진첩에 바로 저장하거나 카톡·인스타로 보내기
  const share = async () => {
    const blob = await canvasBlob();
    if (!blob) return showSaveImage("이미지를 길게 눌러 저장하세요.");
    const file = new File([blob], makeFileName(), { type: "image/png" });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
      return showSaveImage("이미지를 길게 눌러 저장하세요.");
    }
    try {
      await navigator.share({ files: [file], title: "나의 꿈 카드" });
    } catch {
      /* 사용자가 공유를 취소함 */
    }
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
              {canShare ? (
                <button type="button" id="share" className="ghost" onClick={share}>
                  휴대폰에 저장 · 공유
                </button>
              ) : null}
            </div>
            <p className="tiny">
              사진은 이 브라우저 안에서만 처리되며 서버로 올라가지 않습니다.
            </p>

            {saveUrl ? (
              <div className="saveout" id="saveout">
                <p className="savemsg">{saveMsg}</p>
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
          <span>꿈은 적는 순간, 방향이 됩니다.</span>
          <span>
            <b>우산 쓴 고양이</b> 놀스테이(구, 모텔사랑) 대표 이길원 · 잘잘잘tv
          </span>
        </div>
      </main>
    </>
  );
}
