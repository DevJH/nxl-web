// scripts/publish-studio.mjs
// NextLab Studio(데스크톱 설치본) 를 배포 채널로 발행한다.
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
      name: `NextLab Studio v${version}`,
      body: `NextLab Studio ${version} 설치본. 다운로드 안내: https://nxl-web.vercel.app/studio/`,
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
  let out = text;
  for (const name of assets) {
    // url:/path: 값으로 등장하는 원본 파일명만 치환 (sha512 등 다른 줄은 건드리지 않는다)
    out = out
      .replaceAll(`url: ${name}`, `url: ${assetUrl(name)}`)
      .replaceAll(`path: ${name}`, `path: ${assetUrl(name)}`);
  }
  return out;
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
    product: 'NextLab Studio',
    version,
    releasedAt: new Date().toISOString(),
    downloadPage: 'https://nxl-web.vercel.app/studio/',
    releaseTag: TAG,
    platforms: {
      ...(macArmDmg ? { 'mac-arm64': platformEntry(macArmDmg) } : {}),
      ...(macX64Dmg ? { 'mac-x64': platformEntry(macX64Dmg) } : {}),
      ...(winExe ? { win: platformEntry(winExe) } : {}),
    },
    files: filesMeta,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'version.json'), JSON.stringify(versionJson, null, 2), 'utf8');

  // ---- 다운로드 페이지 ----
  const downloadButton = (label, file, note) =>
    file
      ? `      <a class="dl" href="${file.url}">
        <span class="dl-label">${label}</span>
        <span class="dl-meta">${file.name} · ${human(file.bytes)}</span>
      </a>${note ? `\n      <p class="note">${note}</p>` : ''}`
      : `      <p class="note missing">${label} 설치본은 이번 릴리스에 포함되지 않았습니다.</p>`;

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>NextLab Studio 다운로드</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#16191d; --muted:#5b636d; --line:#e3e6ea; --accent:#fa6600; --card:#fff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#16191d; --fg:#f2f4f6; --muted:#a0a7b0; --line:#2b3037; --card:#1d2126; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif; line-height:1.6; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 56px 24px 80px; }
  h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: -0.02em; }
  .appicon { width: 64px; height: 64px; display:block; margin: 0 0 14px; filter: drop-shadow(0 8px 18px rgba(0,0,0,.22)); }
  .ver { color: var(--muted); font-size: 14px; margin-bottom: 40px; }
  h2 { font-size: 17px; margin: 36px 0 12px; }
  .dl { display:flex; flex-direction:column; gap:2px; padding:16px 20px; border:1px solid var(--line); border-radius:12px; background:var(--card); text-decoration:none; color:inherit; transition:border-color .15s; margin-bottom:10px; }
  .dl:hover { border-color: var(--accent); }
  .dl-label { font-weight:600; font-size:15px; }
  .dl-meta { color:var(--muted); font-size:13px; }
  .note { color:var(--muted); font-size:13px; margin:10px 2px 0; }
  .note.missing { padding:16px 20px; border:1px dashed var(--line); border-radius:12px; margin:0; }
  .box { border:1px solid var(--line); border-left:3px solid var(--accent); border-radius:8px; padding:14px 18px; background:var(--card); margin:28px 0 0; }
  .box p { margin:0 0 6px; font-size:14px; }
  .box p:last-child { margin-bottom:0; }
  code { background:rgba(128,128,128,.14); padding:1px 6px; border-radius:4px; font-size:13px; }
  footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted); font-size:13px; }
  a.plain { color:var(--accent); }
</style>
</head>
<body>
<div class="wrap">
  <img class="appicon" src="../images/logos/studio-appicon.png" alt="" width="512" height="512" decoding="async" />
  <h1>NextLab Studio</h1>
  <div class="ver">버전 ${version} · ${new Date().toISOString().slice(0, 10)}</div>

  <h2>macOS</h2>
  <p class="note" style="margin:0 0 10px">Apple 메뉴 &gt; 이 Mac에 관하여에서 <strong>칩</strong> 항목이 Apple M1~ 이면 Apple Silicon, Intel Core 면 Intel 입니다.</p>
${downloadButton('Apple Silicon (M1 이상)', macArmDmg, '')}
${downloadButton('Intel Mac', macX64Dmg, '설치: dmg 를 열고 앱을 <code>응용 프로그램</code> 으로 끌어놓습니다. 첫 실행이 차단되면 아래 <strong>첫 실행 안내</strong>를 따라주세요 (최초 1회).')}

  <h2>Windows (x64)</h2>
${downloadButton('Windows 설치본 내려받기', winExe, '설치: exe 실행 시 파란 SmartScreen 창이 뜨면 아래 <strong>첫 실행 안내</strong>를 따라주세요 (최초 1회).')}

  <div class="box">
    <p><strong>업데이트</strong></p>
    <p>Windows 는 앱이 새 버전을 자동으로 확인하고 설치합니다.</p>
    <p>macOS 는 새 버전이 나오면 앱이 알려주며, 이 페이지에서 새 dmg 를 받아 덮어쓰면 됩니다.</p>
    <p>메뉴 <code>파일 &gt; 업데이트 확인…</code> 으로 언제든 직접 확인할 수 있습니다.</p>
  </div>

  <div class="box">
    <p><strong>첫 실행 안내 — 임시 절차입니다</strong></p>
    <p>아직 OS 인증서 서명이 적용되지 않아 첫 실행을 한 번 막습니다. 정식 서명이 적용되면 사라질 절차이며, <strong>최초 1회만</strong> 하면 됩니다.</p>
    <p><strong>macOS</strong>: "악성 코드가 없음을 확인할 수 없습니다" 창 → 닫고 <strong>시스템 설정 → 개인정보 보호 및 보안</strong> 아래쪽 <strong>"그래도 열기"</strong> → 다시 실행</p>
    <p><strong>Windows</strong>: SmartScreen 파란 창 → <strong>추가 정보 → 실행</strong></p>
  </div>

  <footer>
    기존 데이터를 옮기려면 앱에서 <code>파일 &gt; 데이터 가져오기…</code> 를 사용하세요.<br />
    <a class="plain" href="/">← 배포 채널 홈</a>
  </footer>
</div>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');

  console.log(
    `[publish-studio] 자산 ${uploaded}개 → ${REPO}@${TAG} · 메타 ${metas.length}개 + 페이지 → ${OUT_DIR}`,
  );
  console.log(
    `다음 단계: cd ${CHANNEL_DIR} && git add -A && git commit -m "release(studio): v${version}" && git push`,
  );
})();
