// scripts/render-intro.mjs
// 소개자료(nextlab-intro.html)를 통 이미지 PNG + A4 PDF 로 내보낸다.
// 실행: node scripts/render-intro.mjs
//
// 왜 스크립트로 두는가 — 이 두 파일은 업무망에서 그대로 돌려보는 산출물이라
// HTML 을 고치면 같이 갱신해야 한다. 손으로 찍으면 배율·페이지 크기가 매번
// 달라진다(실제로 A4 아닌 US Letter 로 찍힌 판이 섞여 있었다).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'nextlab-intro.html');
const PNG = path.join(ROOT, 'NEXTLAB-소개자료.png');
const PDF = path.join(ROOT, 'NEXTLAB-소개자료.pdf');

const WIDTH = 1240; // HTML 의 .page{max-width:1240px} 와 맞춘다
const SCALE = 2; // 문서에 붙였을 때 또렷하도록 2배(결과 2480px)
const PROBE_H = 8000; // 콘텐츠보다 확실히 큰 높이로 한 번 찍어 실제 끝을 찾는다

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
for (const [p, what] of [
  [CHROME, 'Chrome (env CHROME_PATH 로 지정 가능)'],
  [SRC, '원본 HTML'],
]) {
  if (!fs.existsSync(p)) {
    console.error(`[render-intro] ${what} 을 찾지 못했습니다: ${p}`);
    process.exit(1);
  }
}

const url = `file://${SRC}`;
// 웹폰트(Pretendard)가 CDN 에서 내려온다 — 짧으면 대체 폰트로 찍혀 자간이 어긋난다.
const base = ['--headless', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=8000'];
const shoot = (args) => execFileSync(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });

/**
 * 아래 여백 트리밍.
 *
 * headless 스크린샷은 --window-size 만큼만 찍히고 페이지 높이를 알려주지 않는다.
 * 넉넉한 높이로 찍어 아래에서부터 배경색만인 줄을 걷어내는 방식이 가장 단순하다 —
 * 배경이 단색(--ink-950)이라 이 판별이 안전하다.
 */
const TRIM = `
from PIL import Image
import sys
p = sys.argv[1]
im = Image.open(p).convert('RGB')
w, h = im.size
bg = im.getpixel((4, 4))
def diff(px):
    return abs(px[0]-bg[0]) + abs(px[1]-bg[1]) + abs(px[2]-bg[2])
last = 0
for y in range(h - 1, -1, -1):
    if any(diff(im.getpixel((x, y))) > 12 for x in range(0, w, 17)):
        last = y
        break
pad = int(sys.argv[2])
im.crop((0, 0, w, min(h, last + 1 + pad))).save(p)
print(last + 1 + pad)
`;

// 1) PNG — 넉넉히 찍고 아래 여백을 잘라낸다.
shoot([
  ...base,
  `--force-device-scale-factor=${SCALE}`,
  `--window-size=${WIDTH},${PROBE_H}`,
  `--screenshot=${PNG}`,
  url,
]);
let trimmed = '(자동 트리밍 실패 — 아래 여백 확인 필요)';
try {
  trimmed =
    execFileSync('/usr/bin/python3', ['-c', TRIM, PNG, String(72 * SCALE)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .toString()
      .trim() + 'px';
} catch (e) {
  console.warn(`[render-intro] PNG 트리밍을 건너뜁니다 (Pillow 없음?): ${e.message.split('\n')[0]}`);
}

// 2) PDF — A4. HTML 의 @page{size:A4} 가 없으면 Letter 로 찍힌다.
shoot([...base, '--no-pdf-header-footer', `--print-to-pdf=${PDF}`, url]);

const mb = (p) => (fs.statSync(p).size / 1024 / 1024).toFixed(1);
console.log(`[render-intro] PNG ${mb(PNG)}MB (높이 ${trimmed}) · PDF ${mb(PDF)}MB → ${ROOT}`);
