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

// 사용자 문서(사용자메뉴얼·소개자료) + 참조 이미지를 채널로 복사한다.
// 채널이 곧 사용자 사이트이므로 index.html 이 링크하는 이 파일들이 함께 올라가야 한다.
// 이미지는 HTML 이 실제 참조하는 것만 복사한다 — docs/images 전체(14MB)를 올리면
// 저장소가 불필요하게 무거워진다.
// nextlab-landing.html 이 채널 메인(index.html)이다 — 소개+다운로드가 이미 한 페이지라
// 별도 인덱스를 두지 않는다.
const DOC_PAGES = [
  { src: 'nextlab-builder-사용자메뉴얼-v1.0.html', dest: 'manual.html' },
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
const referenced = new Set();
let pages = 0;
for (const { src, dest } of DOC_PAGES) {
  const abs = path.join(DOCS_SRC, src);
  if (!fs.existsSync(abs)) {
    console.warn(`[publish-channel] 문서 없음(건너뜀): ${abs}`);
    continue;
  }
  const html = fs.readFileSync(abs, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="(images\/[^"]+)"/g)) referenced.add(m[1]);
  fs.writeFileSync(path.join(CHANNEL_DIR, dest), html, 'utf8');
  pages++;
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
