// scripts/publish-studio.mjs
// NEXTLAB Studio(데스크톱 설치본) 를 배포 채널로 발행한다.
//
// 구조 — 왜 설치본을 git 에 커밋하지 않는가:
//   설치본이 개당 175~220MB 라 GitHub 의 파일당 100MB 하드리밋에 걸려 푸시 자체가
//   거부된다 (LFS 무료 한도로도 감당 불가). 그래서 큰 파일(dmg/zip/exe/blockmap)은
//   이 저장소(공개)의 **GitHub Release 자산**으로 올리고, 채널(git/Vercel)에는
//   작은 파일만 커밋한다:
//     studio/latest.yml · latest-mac.yml  — 업데이트 메타. files[].url 을 Release
//                                           자산의 절대 URL 로 재작성 (electron-updater
//                                           는 절대 URL 을 그대로 따라간다)
//     studio/version.json · index.html    — 알림용 메타 + 다운로드 페이지
//
//   GitHub 는 Release 자산 이름의 공백을 점(.)으로 바꾸므로, 업로드 시점부터
//   점 이름으로 통일해 메타의 URL 과 실제 자산 URL 이 항상 일치하게 한다.
//
//   실행: node scripts/publish-studio.mjs [--release-dir <경로>]
//         (Release 업로드 + studio/ 갱신까지. 커밋·푸시는 확인 후 직접)
//   토큰: env NXL_GH_TOKEN > `git credential fill` (repo 권한 필요)
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** 채널 저장소 — publish-channel.mjs 와 같은 규칙. */
const CHANNEL_DIR = process.env.NXL_CHANNEL_DIR
  ? path.resolve(process.env.NXL_CHANNEL_DIR)
  : fs.existsSync(path.join(ROOT, '.git'))
    ? ROOT
    : path.join(os.homedir(), 'nxl-web');

/**
 * electron-builder 산출물 위치.
 * 위치로 추측하지 않는다 — 채널 저장소에서 실행하면 상대경로가 홈을 가리켜
 * 조용히 0건으로 끝난다 (sync-assets 가 같은 함정을 겪었다).
 *   1) --release-dir 인자  2) env NXL_STUDIO_RELEASE_DIR  3) 모노레포 형제/안
 */
function resolveReleaseDir() {
  const argIndex = process.argv.indexOf('--release-dir');
  if (argIndex !== -1 && process.argv[argIndex + 1]) {
    return path.resolve(process.argv[argIndex + 1]);
  }
  if (process.env.NXL_STUDIO_RELEASE_DIR) {
    return path.resolve(process.env.NXL_STUDIO_RELEASE_DIR);
  }
  const rel = 'nextlab-agent-workspace/desktop/release';
  for (const base of [path.resolve(ROOT, '../nextlab-ai'), path.resolve(ROOT, '..'), ROOT]) {
    const candidate = path.join(base, rel);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.resolve(ROOT, '..', rel);
}

const RELEASE_DIR = resolveReleaseDir();
const OUT_DIR = path.join(CHANNEL_DIR, 'studio');
// The channel owns the page. Resolve it before any output cleanup or network write.
const STUDIO_PAGE = path.join(ROOT, 'studio', 'index.html');
if (!fs.existsSync(STUDIO_PAGE)) {
  console.error('[publish-studio] studio/index.html 다운로드 페이지가 없습니다. 채널 파일을 확인하세요.');
  process.exit(1);
}
const studioPageHtml = fs.readFileSync(STUDIO_PAGE, 'utf8');

if (!fs.existsSync(path.join(CHANNEL_DIR, '.git'))) {
  console.error(`[publish-studio] 채널 저장소가 없습니다: ${CHANNEL_DIR} (env NXL_CHANNEL_DIR 로 지정 가능)`);
  process.exit(1);
}
if (!fs.existsSync(RELEASE_DIR)) {
  console.error(
    `[publish-studio] 빌드 산출물이 없습니다: ${RELEASE_DIR}\n` +
      '  desktop 에서 npm run dist:mac / dist:win 을 먼저 실행하거나,\n' +
      '  CI 아티팩트를 내려받아 --release-dir 로 지정하세요.',
  );
  process.exit(1);
}

// ---- GitHub Release 대상 저장소 (채널 저장소 자신의 origin) ----
const originUrl = execSync('git remote get-url origin', { cwd: CHANNEL_DIR, encoding: 'utf8' }).trim();
const repoMatch = originUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
if (!repoMatch) {
  console.error(`[publish-studio] origin 이 GitHub 저장소가 아닙니다: ${originUrl}`);
  process.exit(1);
}
const REPO = `${repoMatch[1]}/${repoMatch[2]}`;

function ghToken() {
  if (process.env.NXL_GH_TOKEN) return process.env.NXL_GH_TOKEN;
  try {
    const out = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
    });
    const line = out.split('\n').find((l) => l.startsWith('password='));
    if (line) return line.slice('password='.length);
  } catch {
    // fallthrough
  }
  console.error('[publish-studio] GitHub 토큰이 없습니다 — env NXL_GH_TOKEN 지정 또는 git 자격증명 필요');
  process.exit(1);
}

const TOKEN = ghToken();

async function gh(pathOrUrl, init = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `https://api.github.com${pathOrUrl}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      ...init.headers,
    },
  });
  return res;
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function human(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---- 산출물 수집 ----
// latest.yml / latest-mac.yml : 업데이트 메타 (채널에 커밋, URL 재작성)
// dmg / zip / exe / blockmap  : Release 자산으로 업로드 (mac zip 은 서명 후
//                               자동 업데이트가 받는 실제 대상, blockmap 은 차등 다운로드)
const ASSET_PATTERN = /\.(exe|dmg|zip|blockmap)$/i;
const META_FILES = ['latest.yml', 'latest-mac.yml'];

const assets = fs
  .readdirSync(RELEASE_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && ASSET_PATTERN.test(e.name))
  .map((e) => e.name);
const metas = META_FILES.filter((name) => fs.existsSync(path.join(RELEASE_DIR, name)));

if (assets.length === 0) {
  console.error(`[publish-studio] 설치 파일을 찾지 못했습니다: ${RELEASE_DIR}`);
  process.exit(1);
}
if (metas.length === 0) {
  console.warn(
    '[publish-studio] 경고: latest.yml / latest-mac.yml 이 없습니다 — 자동 업데이트가 동작하지 않습니다.',
  );
}

// 버전은 desktop package.json 정본 > 메타파일 순으로 읽는다 (파일명 파싱은 깨지기 쉽다)
function readVersion() {
  for (const base of [
    path.resolve(RELEASE_DIR, '..'),
    path.resolve(ROOT, '../nextlab-ai/nextlab-agent-workspace/desktop'),
  ]) {
    const pkg = path.join(base, 'package.json');
    if (fs.existsSync(pkg)) {
      const parsed = JSON.parse(fs.readFileSync(pkg, 'utf8'));
      if (parsed.version) return parsed.version;
    }
  }
  for (const name of metas) {
    const text = fs.readFileSync(path.join(RELEASE_DIR, name), 'utf8');
    const m = text.match(/^version:\s*(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

const version = readVersion();
if (!version) {
  console.error('[publish-studio] 버전을 확인하지 못했습니다 (desktop/package.json 없음)');
  process.exit(1);
}

const TAG = `studio-v${version}`;
/** GitHub 가 자산 이름의 공백을 점으로 바꾼다 — 업로드 시점부터 점 이름으로 통일 */
const dotted = (name) => name.replace(/\s+/g, '.');
const assetUrl = (name) => `https://github.com/${REPO}/releases/download/${TAG}/${dotted(name)}`;

// ---- Release 확보 + 자산 업로드 ----
async function ensureRelease() {
  const found = await gh(`/repos/${REPO}/releases/tags/${TAG}`);
  if (found.ok) return found.json();
  const created = await gh(`/repos/${REPO}/releases`, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: TAG,
      name: `NEXTLAB Studio v${version}`,
      body: `NEXTLAB Studio ${version} 설치본. 다운로드 안내: https://nxl-ai-tools.reala.pro/studio/`,
      draft: false,
      prerelease: false,
    }),
  });
  if (!created.ok) {
    throw new Error(`Release 생성 실패 (${created.status}): ${await created.text()}`);
  }
  return created.json();
}

async function uploadAssets() {
  const release = await ensureRelease();
  // 재발행 멱등성 — 같은 이름의 기존 자산은 지우고 다시 올린다
  const existing = new Map((release.assets ?? []).map((a) => [a.name, a.id]));
  let uploaded = 0;
  for (const name of assets) {
    const target = dotted(name);
    const prevId = existing.get(target);
    if (prevId !== undefined) {
      await gh(`/repos/${REPO}/releases/assets/${prevId}`, { method: 'DELETE' });
    }
    const buf = fs.readFileSync(path.join(RELEASE_DIR, name));
    const res = await gh(
      `https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(target)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(buf.length) },
        body: buf,
      },
    );
    if (!res.ok) {
      throw new Error(`자산 업로드 실패 ${target} (${res.status}): ${await res.text()}`);
    }
    uploaded++;
    console.log(`  ↑ ${target} (${human(buf.length)})`);
  }
  return uploaded;
}

/** 업데이트 메타의 상대 파일명을 Release 자산 절대 URL 로 재작성한다. */
function rewriteMeta(text) {
  // yml 은 electron-builder 원본 이름(공백)을 참조하지만, CI 스테이징 Release 에서
  // 내려받은 로컬 자산은 GitHub 가 공백을 점으로 바꾼 이름이다 — 문자열 일치가 아니라
  // 점 정규화(dotted)로 대조해야 두 경로(로컬 빌드·CI 다운로드) 모두에서 치환된다.
  return text.replace(/^(\s*(?:-\s*)?(?:url|path):\s*)(.+)$/gm, (line, prefix, value) => {
    const match = assets.find((name) => dotted(name) === dotted(value.trim()));
    return match ? `${prefix}${assetUrl(match)}` : line;
  });
}

const filesMeta = assets.map((name) => {
  const src = path.join(RELEASE_DIR, name);
  const stat = fs.statSync(src);
  return {
    name: dotted(name),
    url: assetUrl(name),
    bytes: stat.size,
    sha256: sha256(src),
    modifiedAt: stat.mtime.toISOString(),
  };
});

function pick(pattern) {
  return filesMeta.find((f) => pattern.test(f.name)) ?? null;
}
// mac 은 아치별 2종. electron-builder 기본 명명: arm64 는 "-arm64.dmg",
// x64 는 접미사 없는 legacy 이름 — arm64 가 안 붙은 쪽이 Intel 이다.
const macArmDmg = pick(/-arm64\.dmg$/i);
const macX64Dmg = pick(/^(?!.*arm64).*\.dmg$/i);
const winExe = pick(/\.exe$/i);

// ---- 릴리스 노트 게이트 ----
// updates.html 은 손으로 쓰는 문서라 릴리스 때 잊히기 쉽다 (v0.3.2 에서 실제 누락).
// 발행 전에 이번 버전 항목이 있는지 강제한다 — 없으면 업로드를 시작하기 전에 멈춘다.
// 긴급 우회: env NXL_SKIP_UPDATES_CHECK=1
{
  const updatesPath = path.join(CHANNEL_DIR, 'updates.html');
  const hasEntry =
    fs.existsSync(updatesPath) && fs.readFileSync(updatesPath, 'utf8').includes(`>v${version}<`);
  if (!hasEntry && !process.env.NXL_SKIP_UPDATES_CHECK) {
    console.error(
      `[publish-studio] updates.html 에 v${version} 항목이 없습니다 — 릴리스 노트를 먼저 추가하세요.\n` +
        `  (Studio 섹션에 <span class="rel-v">v${version}</span> 블록. 우회: NXL_SKIP_UPDATES_CHECK=1)`,
    );
    process.exit(1);
  }
}

await (async () => {
  console.log(`[publish-studio] v${version} → ${REPO} Release ${TAG} 업로드 시작`);
  const uploaded = await uploadAssets();

  // studio/ 는 작은 파일만 — 이전 실행이 스테이징한 큰 파일도 여기서 정리된다
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const name of metas) {
    const text = fs.readFileSync(path.join(RELEASE_DIR, name), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, name), rewriteMeta(text), 'utf8');
  }

  const platformEntry = (f) =>
    f ? { name: f.name, url: f.url, bytes: f.bytes, sha256: f.sha256 } : undefined;
  const versionJson = {
    product: 'NEXTLAB Studio',
    version,
    releasedAt: new Date().toISOString(),
    downloadPage: 'https://nxl-ai-tools.reala.pro/studio/',
    releaseTag: TAG,
    platforms: {
      ...(macArmDmg ? { 'mac-arm64': platformEntry(macArmDmg) } : {}),
      ...(macX64Dmg ? { 'mac-x64': platformEntry(macX64Dmg) } : {}),
      ...(winExe ? { win: platformEntry(winExe) } : {}),
    },
    files: filesMeta,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'version.json'), JSON.stringify(versionJson, null, 2), 'utf8');

  // Versions and artifact links are read from version.json by the shared site script.
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), studioPageHtml, 'utf8');

  console.log(
    `[publish-studio] 자산 ${uploaded}개 → ${REPO}@${TAG} · 메타 ${metas.length}개 + 페이지 → ${OUT_DIR}`,
  );
  console.log(
    `다음 단계: cd ${CHANNEL_DIR} && git add -A && git commit -m "release(studio): v${version}" && git push`,
  );
})();
