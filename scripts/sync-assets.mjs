// scripts/sync-assets.mjs
// 배포 자산 동기화 — extension 저장소의 install/(VSIX·릴리스 패키지)와 docs/(소개자료)를
// public/ 으로 복사하고, 페이지가 읽는 release-manifest.json 을 생성한다.
// 실행: pnpm sync-assets (build 시 prebuild 로 자동 실행)
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * 산출물 원본이 있는 모노레포 루트.
 * 이 스크립트는 모노레포 안(nextlab-ai/nxl-web/)에서도, 채널 저장소(~/nxl-web)에서도
 * 돌기 때문에 위치로 추측하지 않고 명시한다 — 상대경로로 두면 채널에서 `../docs` 가
 * 홈 디렉토리를 가리켜 조용히 0건으로 끝난다.
 *   1) env NXL_SOURCE_DIR
 *   2) ../nextlab-ai (채널 저장소가 모노레포와 형제일 때)
 *   3) .. (모노레포 안 nxl-web/ 에서 실행할 때)
 */
function resolveSourceDir() {
  const fromEnv = process.env.NXL_SOURCE_DIR;
  if (fromEnv) return path.resolve(fromEnv);
  for (const candidate of [path.resolve(ROOT, '../nextlab-ai'), path.resolve(ROOT, '..')]) {
    if (fs.existsSync(path.join(candidate, 'docs'))) return candidate;
  }
  return path.resolve(ROOT, '..');
}

const SOURCE_DIR = resolveSourceDir();
const INSTALL_DIR = path.join(SOURCE_DIR, 'nextlab-ai', 'install');
const DOCS_DIR = path.join(SOURCE_DIR, 'docs');
const OUT_RELEASES = path.join(ROOT, 'public', 'releases');
const OUT_DOCS = path.join(ROOT, 'public', 'docs');
const MANIFEST = path.join(ROOT, 'public', 'release-manifest.json');

/**
 * 매니페스트에 실을 부가 자료 — 한글 파일명은 URL 안전한 슬러그로 복사한다.
 * 사용자 메뉴얼·소개자료(manual.html·intro.html)는 채널의 정적 페이지로 직접 올라가므로
 * (publish-channel 이 담당) 여기 넣지 않는다. PDF 배포본이 생기면 여기에 추가한다.
 */
const DOC_SOURCES = [];

const VSIX_PATTERN = /^nxl-builder-(\d+\.\d+\.\d+)\.vsix$/;

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyInto(srcFile, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(srcFile));
  fs.copyFileSync(srcFile, dest);
  return dest;
}

// 날짜·크기·해시는 복사본이 아니라 **원본** 기준 (copyFileSync 가 mtime 을 새로 찍으므로)
function fileEntry(srcPath, publicPath) {
  const stat = fs.statSync(srcPath);
  return {
    name: path.basename(srcPath),
    path: publicPath,
    bytes: stat.size,
    sha256: srcPath.endsWith('.vsix') ? sha256(srcPath) : undefined,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function collectReleases() {
  if (!fs.existsSync(INSTALL_DIR)) {
    console.warn(`[sync-assets] install 디렉토리 없음: ${INSTALL_DIR} — 릴리스 0건으로 진행`);
    return [];
  }
  /** version → { version, files: [absPath...] } */
  const byVersion = new Map();
  const put = (version, absPath) => {
    const entry = byVersion.get(version) ?? { version, sources: [] };
    entry.sources.push(absPath);
    byVersion.set(version, entry);
  };

  for (const name of fs.readdirSync(INSTALL_DIR)) {
    const abs = path.join(INSTALL_DIR, name);
    const stat = fs.statSync(abs);
    if (stat.isFile()) {
      const match = VSIX_PATTERN.exec(name);
      if (match) put(match[1], abs);
      continue;
    }
    // install/<버전>/ 릴리스 패키지 폴더 — vsix + INSTALL.md + 소개 pdf 등
    if (stat.isDirectory() && /^\d+\.\d+\.\d+$/.test(name)) {
      for (const inner of fs.readdirSync(abs)) {
        put(name, path.join(abs, inner));
      }
    }
  }

  const releases = [];
  for (const { version, sources } of byVersion.values()) {
    const destDir = path.join(OUT_RELEASES, version);
    const files = [];
    let vsix = null;
    let releasedAt = null;
    for (const src of sources) {
      const copied = copyInto(src, destDir);
      const entry = fileEntry(src, `/releases/${version}/${path.basename(copied)}`);
      files.push(entry);
      if (entry.name.endsWith('.vsix')) {
        vsix = entry;
        releasedAt = entry.modifiedAt;
      }
    }
    if (!vsix) continue; // vsix 없는 버전은 배포 대상이 아니다
    releases.push({ version, releasedAt, vsix, files });
  }

  // 최신 버전이 앞으로 (semver 내림차순)
  const numeric = (v) => v.split('.').map(Number);
  releases.sort((a, b) => {
    const [a1 = 0, a2 = 0, a3 = 0] = numeric(a.version);
    const [b1 = 0, b2 = 0, b3 = 0] = numeric(b.version);
    return b1 - a1 || b2 - a2 || b3 - a3;
  });
  return releases;
}

function collectDocs() {
  const docs = [];
  if (DOC_SOURCES.length === 0) return docs;
  for (const { src, dest, title, kind } of DOC_SOURCES) {
    const abs = path.join(DOCS_DIR, src);
    if (!fs.existsSync(abs)) {
      console.warn(`[sync-assets] 소개자료 없음(건너뜀): ${abs}`);
      continue;
    }
    fs.mkdirSync(OUT_DOCS, { recursive: true });
    fs.copyFileSync(abs, path.join(OUT_DOCS, dest));
    const stat = fs.statSync(abs);
    docs.push({ title, kind, path: `/docs/${dest}`, bytes: stat.size, modifiedAt: stat.mtime.toISOString() });
  }
  return docs;
}

// 이전 산출물 정리 후 재생성 (지워진 버전이 남지 않게)
fs.rmSync(OUT_RELEASES, { recursive: true, force: true });
fs.rmSync(OUT_DOCS, { recursive: true, force: true });

const releases = collectReleases();
const docs = collectDocs();
const manifest = { generatedAt: new Date().toISOString(), releases, docs };

// Builder extension 의 업데이트 자동 확인이 GET /release-manifest.json 으로 읽고,
// 채널 index.html 도 이 파일에서 버전·해시를 읽어 표시한다.
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`[sync-assets] 릴리스 ${releases.length}개 · 소개자료 ${docs.length}개 → 매니페스트 생성 완료`);
