// scripts/publish-channel.mjs
// 공개 업데이트 채널(github.com/DevJH/nxl-web 클론)로 배포물을 내보낸다.
// sync-assets 산출물(public/)에서 release-manifest.json 과 VSIX 들을 복사한다.
// 실행: pnpm publish-channel  (복사만 — 커밋·푸시는 확인 후 직접)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * 발행 대상 채널 저장소.
 * 이 스크립트가 채널 저장소 안에 있으면(정상 배치) 자기 자신이 대상이다 —
 * 모노레포에 있던 시절처럼 ~/nxl-web 로 따로 복사하지 않는다.
 * 다른 위치로 내보내려면 env NXL_CHANNEL_DIR 로 지정한다.
 */
const CHANNEL_DIR = process.env.NXL_CHANNEL_DIR
  ? path.resolve(process.env.NXL_CHANNEL_DIR)
  : fs.existsSync(path.join(ROOT, '.git'))
    ? ROOT
    : path.join(os.homedir(), 'nxl-web');
const MANIFEST_SRC = path.join(ROOT, 'public', 'release-manifest.json');
const RELEASES_SRC = path.join(ROOT, 'public', 'releases');

if (!fs.existsSync(path.join(CHANNEL_DIR, '.git'))) {
  console.error(`[publish-channel] 채널 저장소가 없습니다: ${CHANNEL_DIR} (env NXL_CHANNEL_DIR 로 지정 가능)`);
  process.exit(1);
}
if (!fs.existsSync(MANIFEST_SRC)) {
  console.error('[publish-channel] 매니페스트가 없습니다 — 먼저 pnpm sync-assets 를 실행하세요');
  process.exit(1);
}

// 채널은 자동 설치용 = 최신 버전 VSIX 하나만 호스팅한다.
// 구버전 VSIX 를 이력마다 커밋하면 저장소가 매 릴리스 ~10MB 씩 무거워지고
// GitHub HTTP 푸시 한도(400 에러)에 걸린다. 이력 정보는 매니페스트(JSON)에만 남긴다.
const fullManifest = JSON.parse(fs.readFileSync(MANIFEST_SRC, 'utf8'));
const latestRelease = fullManifest.releases?.[0];
if (!latestRelease) {
  console.error('[publish-channel] 매니페스트에 릴리스가 없습니다 — 먼저 pnpm sync-assets 를 실행하세요');
  process.exit(1);
}
const latest = latestRelease.version;

// 매니페스트도 최신 릴리스 1건만 남긴다 — 구버전 vsix 파일을 안 올리므로
// 이력에 예전 버전을 남기면 그 vsix.path 다운로드가 404 가 된다.
// files[] 도 vsix 만 남긴다(중복 제거): INSTALL.md 등 사내 문서는 채널에 올리지 않으므로
// 그대로 실으면 없는 경로를 광고하게 된다. (extension 은 vsix.path/sha256 만 읽는다)
const seen = new Set();
const channelManifest = {
  ...fullManifest,
  releases: [
    {
      ...latestRelease,
      files: (latestRelease.files ?? []).filter((f) => {
        if (!f.name?.endsWith('.vsix') || seen.has(f.path)) return false;
        seen.add(f.path);
        return true;
      }),
    },
  ],
};
fs.writeFileSync(
  path.join(CHANNEL_DIR, 'release-manifest.json'),
  JSON.stringify(channelManifest, null, 2),
  'utf8',
);

// 최신 버전 VSIX 만 복사 — 매니페스트의 vsix.path 와 같은 상대 구조(releases/<버전>/<파일>).
// releases/ 를 통째로 비우고 최신만 채워, 이전 버전 vsix 가 남지 않게 한다.
fs.rmSync(path.join(CHANNEL_DIR, 'releases'), { recursive: true, force: true });
let copied = 0;
const latestDir = path.join(RELEASES_SRC, latest);
if (fs.existsSync(latestDir)) {
  for (const name of fs.readdirSync(latestDir)) {
    if (!name.endsWith('.vsix')) continue; // PDF·INSTALL.md 등 사내 문서는 채널에 올리지 않는다
    const dest = path.join(CHANNEL_DIR, 'releases', latest, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(latestDir, name), dest);
    copied++;
  }
}
if (copied === 0) {
  console.error(`[publish-channel] 최신 버전(${latest}) VSIX 를 찾지 못했습니다 — pnpm sync-assets 확인`);
  process.exit(1);
}

// 사용자 문서(사용자메뉴얼·소개자료) + 참조 이미지를 모노레포 docs 에서 복사한다.
//
// ⚠ 기본은 복사하지 않는다 (env NXL_PUBLISH_DOCS=1 일 때만).
// 사이트 페이지(index.html·manual.html·images/)의 정본은 이제 채널 저장소 자신이다 —
// 채널에서 직접 고친 뒤 모노레포 docs 사본이 낡았고, 릴리스마다 이 복사가
// 낡은 사본으로 사이트를 회귀시켰다(v0.3.10 · v0.3.11 두 번 발생, 04ba7d4 · 2ee90e5).
// 모노레포 docs 를 실제로 갱신한 릴리스에서만 NXL_PUBLISH_DOCS=1 로 켠다.
const PUBLISH_DOCS = process.env.NXL_PUBLISH_DOCS === '1';
const DOC_PAGES = [
  { src: 'nextlab-builder-사용자메뉴얼-v1.0.html', dest: 'manual.html', stamp: '확장' },
  { src: 'nextlab-landing.html', dest: 'index.html' },
];
// 원본 docs 위치 — sync-assets 와 같은 규칙(위치 추측 금지, env 우선)
const DOCS_SRC = (() => {
  const fromEnv = process.env.NXL_SOURCE_DIR;
  if (fromEnv) return path.join(path.resolve(fromEnv), 'docs');
  for (const c of [path.resolve(ROOT, '../nextlab-ai/docs'), path.resolve(ROOT, '../docs')]) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(ROOT, '../docs');
})();
/**
 * 메뉴얼에 박힌 버전 표기를 실제 릴리스 버전으로 맞춘다.
 *
 * 메뉴얼은 index.html 과 달리 매니페스트를 런타임에 읽지 않는다 — 표지·목차·푸터에
 * 숫자가 그대로 박혀 있어, 손으로 안 고치면 릴리스마다 조용히 어긋난다.
 * (실제로 Builder 는 0.3.5 에, Studio 는 0.1.0 에 멈춰 있었다.)
 *
 * 문구가 아니라 "v" 뒤 숫자만 바꾼다 — 라벨(확장/앱)까지 스크립트가 정하면
 * 메뉴얼 문장을 고칠 때마다 여기도 따라 고쳐야 한다.
 * 메뉴얼 문서 버전(사용자 메뉴얼 v1.0)은 제품 버전과 별개라 건드리지 않는다.
 */
function stampVersion(html, label, version) {
  const re = new RegExp(`(${label} v)\\d+\\.\\d+\\.\\d+`, 'g');
  const hits = html.match(re);
  return { html: html.replace(re, `$1${version}`), hits: hits ? hits.length : 0 };
}

const referenced = new Set();
let pages = 0;
// 복사를 건너뛰어도 메뉴얼 버전 표기는 릴리스마다 어긋나면 안 된다 —
// 채널의 manual.html 을 제자리에서 스탬프한다 (studio-manual 과 같은 방식).
if (!PUBLISH_DOCS) {
  console.log('[publish-channel] 문서·이미지 복사 생략 (채널이 정본) — 모노레포 docs 반영은 NXL_PUBLISH_DOCS=1');
  for (const { dest, stamp } of DOC_PAGES) {
    if (!stamp) continue;
    const abs = path.join(CHANNEL_DIR, dest);
    if (!fs.existsSync(abs)) continue;
    const before = fs.readFileSync(abs, 'utf8');
    const r = stampVersion(before, stamp, latest);
    if (r.hits === 0) {
      console.warn(`[publish-channel] ${dest}: "${stamp} v0.0.0" 표기를 못 찾아 버전을 못 박았습니다`);
    } else if (r.html !== before) {
      fs.writeFileSync(abs, r.html, 'utf8');
      console.log(`[publish-channel] ${dest}: ${stamp} 버전 ${r.hits}곳 → v${latest} (제자리)`);
    }
  }
}
for (const { src, dest, stamp } of PUBLISH_DOCS ? DOC_PAGES : []) {
  const abs = path.join(DOCS_SRC, src);
  if (!fs.existsSync(abs)) {
    console.warn(`[publish-channel] 문서 없음(건너뜀): ${abs}`);
    continue;
  }
  let html = fs.readFileSync(abs, 'utf8');
  if (stamp) {
    const r = stampVersion(html, stamp, latest);
    html = r.html;
    if (r.hits === 0) {
      // 표기가 하나도 없으면 메뉴얼 쪽 문구가 바뀐 것이다 — 조용히 넘기면
      // 다시 버전이 굳는다.
      console.warn(`[publish-channel] ${dest}: "${stamp} v0.0.0" 표기를 못 찾아 버전을 못 박았습니다`);
    } else {
      console.log(`[publish-channel] ${dest}: ${stamp} 버전 ${r.hits}곳 → v${latest}`);
    }
  }
  for (const m of html.matchAll(/(?:src|href)="(images\/[^"]+)"/g)) referenced.add(m[1]);
  fs.writeFileSync(path.join(CHANNEL_DIR, dest), html, 'utf8');
  pages++;
}

// Studio 메뉴얼은 업스트림 docs 가 아니라 이 저장소에서 관리한다 — 복사 대상이 아니라
// 제자리에서 고친다. 버전 출처도 매니페스트가 아니라 studio/version.json 이다
// (설치본이 GitHub Release 자산이라 릴리스 파이프라인이 다르다).
const STUDIO_META = path.join(CHANNEL_DIR, 'studio', 'version.json');
const STUDIO_MANUAL = path.join(CHANNEL_DIR, 'studio-manual.html');
if (fs.existsSync(STUDIO_META) && fs.existsSync(STUDIO_MANUAL)) {
  const studioVer = JSON.parse(fs.readFileSync(STUDIO_META, 'utf8')).version;
  if (studioVer) {
    const before = fs.readFileSync(STUDIO_MANUAL, 'utf8');
    const r = stampVersion(before, '앱', studioVer);
    if (r.hits === 0) {
      console.warn('[publish-channel] studio-manual.html: "앱 v0.0.0" 표기를 못 찾아 버전을 못 박았습니다');
    } else if (r.html !== before) {
      fs.writeFileSync(STUDIO_MANUAL, r.html, 'utf8');
      console.log(`[publish-channel] studio-manual.html: 앱 버전 ${r.hits}곳 → v${studioVer}`);
    }
  }
}
let imgs = 0;
let missingImgs = 0;
for (const rel of referenced) {
  const from = path.join(DOCS_SRC, rel);
  if (!fs.existsSync(from)) {
    console.warn(`[publish-channel] 이미지 없음(캡쳐 깨짐): ${rel}`);
    missingImgs++;
    continue;
  }
  const to = path.join(CHANNEL_DIR, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  imgs++;
}

console.log(
  `[publish-channel] 매니페스트 + VSIX ${copied}개(v${latest}) + 문서 ${pages}개 + 이미지 ${imgs}개` +
    (missingImgs > 0 ? ` (누락 ${missingImgs}개 — 위 경고 확인)` : '') +
    ` → ${CHANNEL_DIR}`,
);
console.log(`다음 단계: cd ${CHANNEL_DIR} && git add -A && git commit -m "release: v${latest}" && git push`);
