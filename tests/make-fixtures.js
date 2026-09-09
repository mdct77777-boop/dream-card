const sharp = require('sharp');

// 네 모서리에 서로 다른 색 표식을 넣은 테스트 이미지.
// 카드에 그려진 뒤 네 색이 모두 보이면 = 이미지가 하나도 잘리지 않았다는 뜻.
const CASES = [
  { name: '9x16-vertical', w: 720,  h: 1280 },
  { name: '16x9-horizontal', w: 1280, h: 720 },
  { name: '1x1-square', w: 800, h: 800 },
  { name: '4x1-ultrawide', w: 2000, h: 500 },
  { name: '1x3-tall', w: 480, h: 1440 },
];

const MARK = 0.10; // 모서리 표식 크기 (가로/세로 중 짧은 쪽의 10%)

for (const c of CASES) {
  const m = Math.round(Math.min(c.w, c.h) * MARK);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.w}" height="${c.h}">
    <rect width="100%" height="100%" fill="#F1F5F9"/>
    <rect x="0" y="0" width="${m}" height="${m}" fill="#E11D48"/>
    <rect x="${c.w - m}" y="0" width="${m}" height="${m}" fill="#2563EB"/>
    <rect x="0" y="${c.h - m}" width="${m}" height="${m}" fill="#16A34A"/>
    <rect x="${c.w - m}" y="${c.h - m}" width="${m}" height="${m}" fill="#F59E0B"/>
    <rect x="${c.w * 0.5 - 4}" y="0" width="8" height="${c.h}" fill="#94A3B8" opacity="0.5"/>
    <rect x="0" y="${c.h * 0.5 - 4}" width="${c.w}" height="8" fill="#94A3B8" opacity="0.5"/>
    <text x="${c.w / 2}" y="${c.h / 2 - 20}" font-family="sans-serif" font-size="${Math.round(Math.min(c.w, c.h) * 0.09)}"
      fill="#0F172A" text-anchor="middle">${c.name}</text>
    <text x="${c.w / 2}" y="${c.h / 2 + Math.round(Math.min(c.w, c.h) * 0.09)}" font-family="sans-serif"
      font-size="${Math.round(Math.min(c.w, c.h) * 0.06)}" fill="#475569" text-anchor="middle">${c.w}x${c.h}</text>
  </svg>`;
  sharp(Buffer.from(svg)).png().toFile(`fixtures/${c.name}.png`)
    .then(() => console.log('made', c.name, c.w + 'x' + c.h));
}
