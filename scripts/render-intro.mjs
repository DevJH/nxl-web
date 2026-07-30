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
// 메일 첨부용 A4 1장이 기본 산출물이다 — 5장짜리 상세본(nextlab-intro.html)은
// 사이트에서 보는 용도라 이미지·PDF 로 내보내지 않는다.
const SRC = path.join(ROOT, 'nextlab-intro-1p.html');
const PNG = path.join(ROOT, 'NEXTLAB-소개자료.png');
const PDF = path.join(ROOT, 'NEXTLAB-소개자료.pdf');

const WIDTH = 794; // A4 @96dpi. HTML 의 .sheet 폭과 맞춘다
const SCALE = 2; // 메일에서 확대해도 또렷하도록 2배(결과 1588x2246)
const HEIGHT = 1123; // A4 @96dpi. 시트가 고정 높이라 트리밍이 필요 없다

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

// 1) PNG — A4 한 장 그대로. 시트 높이가 고정이라 여백 트리밍이 필요 없다.
shoot([
  ...base,
  `--force-device-scale-factor=${SCALE}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  `--screenshot=${PNG}`,
  url,
]);

// 2) PDF — A4. HTML 의 @page{size:A4} 가 없으면 Letter 로 찍힌다.
shoot([...base, '--no-pdf-header-footer', `--print-to-pdf=${PDF}`, url]);

const mb = (p) => (fs.statSync(p).size / 1024 / 1024).toFixed(1);
console.log(`[render-intro] PNG ${mb(PNG)}MB · PDF ${mb(PDF)}MB (A4 1장) → ${ROOT}`);
