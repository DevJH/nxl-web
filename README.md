# nxl-web — NEXTLAB 배포 채널

사내 배포 채널. **https://nxl-web.vercel.app** (main 푸시 = Vercel 자동 배포)

두 제품을 함께 호스팅한다.

- **Builder(VSCode 확장)** — 채널 루트. 사용자메뉴얼·소개자료 + VSIX 다운로드,
  설치된 확장의 업데이트 확인이 읽는 `release-manifest.json`.
- **Studio(데스크톱 앱)** — `studio/` 하위. 설치본(dmg·exe) 다운로드 페이지 +
  Electron 자동 업데이트가 읽는 `latest.yml`·`latest-mac.yml`.

Studio 자산을 `studio/` 로 격리한 이유: `latest.yml` 같은 일반 이름이 루트에서
확장 배포와 충돌한다.

빌드도 프레임워크도 없다 — 정적 HTML + Node 스크립트 2개.
(Vercel Framework Preset: Other)

## 구성

| 경로 | 내용 | 생성 |
|------|------|------|
| `index.html` | 채널 메인 = 소개 랜딩(소개 + 다운로드 한 페이지) | `docs/nextlab-landing.html` 에서 복사 |
| `manual.html` | Builder 사용자 메뉴얼 v1.0 | `docs/nextlab-builder-사용자메뉴얼-v1.0.html` 에서 복사 |
| `images/` | 위 두 문서가 참조하는 캡쳐 (실제 참조분만 26개) | 자동 |
| `release-manifest.json` | 버전·해시·크기 — 확장 업데이트 확인 + index.html 이 읽는다 | 자동 |
| `releases/<버전>/*.vsix` | 최신 VSIX 1개만 | 자동 |
| `vercel.json` | 매니페스트·업데이트 메타 `no-store` (CDN stale 캐시로 옛 버전 보는 문제 방지) | 수동 |
| `.github/workflows/release.yml` | `v*` 태그 push → GitHub Release 생성 + VSIX 첨부 | 수동 |
| `studio/index.html` | Studio 다운로드 페이지 (mac 수동 설치 유도) | 자동 |
| `studio/latest.yml`<br>`studio/latest-mac.yml` | Electron 자동 업데이트 메타 — **빠지면 업데이트가 조용히 안 된다** | 자동 |
| `studio/*.dmg` `*.exe` `*.zip` | Studio 설치본 (최신 1개 릴리스만) | 자동 |
| `studio/version.json` | 버전·해시 조회용 (mac 알림 폴백) | 자동 |

`index.html` 은 버전·VSIX 경로·파일명을 `release-manifest.json` 에서 읽는다 —
릴리스마다 HTML 을 고칠 필요가 없다.

**정본은 모노레포**(`nextlab-ai/docs/`)다. `index.html`·`manual.html` 을 여기서 직접 고치면
다음 발행 때 덮어써진다 — 원본을 고치고 아래 절차로 다시 발행할 것.

## 릴리스 발행 — Builder(확장)

모노레포에서 `npm run deploy:release` (VSIX·릴리스 패키지 생성) 후:

```bash
pnpm release                                  # sync-assets + publish-channel
git add -A && git commit -m "release: v<버전>" && git push
```

`pnpm release` 두 단계가 하는 일:

1. **sync-assets** — 모노레포의 `nextlab-ai/install/`(VSIX·패키지)을 `public/` 으로 모으고
   `public/release-manifest.json` 을 만든다. `public/` 은 전 버전이 쌓이는 스테이징이라 gitignore.
2. **publish-channel** — `public/` 과 `docs/` 에서 **실제 배포분만** 저장소 루트로 쓴다.
   - 매니페스트는 최신 릴리스 1건만 (구버전 VSIX 를 안 올리므로 이력을 남기면 404)
   - `files[]` 도 VSIX 만 (채널에 없는 INSTALL.md 등을 광고하면 404)
   - 최신 VSIX 1개만 — 매 릴리스 ~10MB 를 쌓으면 GitHub HTTP 푸시 한도에 걸린다
   - 문서 2종 + **HTML 이 실제 참조하는 이미지만** (`docs/images` 전체는 14MB)

**푸시까지 해야 배포 완료** — 확장의 업데이트 확인이 이 사이트의 매니페스트를 보므로,
푸시를 빼먹으면 사용자는 새 버전을 모른다.
(전체 체크리스트: 모노레포 `nextlab-ai/SOURCE_GUIDE.md` "릴리스 배포 체크리스트")

GitHub Release 까지 올리려면 푸시 후 `git tag v<버전> && git push origin v<버전>`.

## 릴리스 발행 — Studio(데스크톱)

모노레포 `nextlab-agent-workspace/desktop` 에서 설치본을 빌드한 뒤:

```bash
pnpm publish-studio                                   # 산출물 위치 자동 탐색
pnpm publish-studio -- --release-dir <아티팩트 폴더>  # CI 아티팩트를 쓸 때
git add -A && git commit -m "release(studio): v<버전>" && git push
```

- 설치본 + `latest*.yml` 을 `studio/` 로 복사하고, 다운로드 페이지와 `version.json` 을 만든다.
- `studio/` 를 비우고 최신 릴리스만 채운다 — 설치본이 수백 MB 라 이력마다 쌓으면
  저장소가 급격히 무거워지고 푸시 한도에 걸린다 (VSIX 와 같은 정책).
- **`latest.yml`·`latest-mac.yml` 이 함께 올라가야 자동 업데이트가 동작한다.**
  electron-builder 의 `publish` 설정이 있어야 이 파일들이 생성된다.
- Windows 설치본은 CI(`desktop-release.yml`)에서 만든다 — macOS 에서 NSIS 빌드는 Wine 이 필요하다.

플랫폼별 업데이트 동작과 mac 서명 제약은 `nextlab-agent-workspace/desktop/README.md` 참조.

## 원본 위치

스크립트는 모노레포를 자동으로 찾는다 (형제 디렉토리 `../nextlab-ai` → 자기 상위 `..` 순).
다른 곳에 있으면 명시한다:

```bash
NXL_SOURCE_DIR=~/some/nextlab-ai pnpm release
```

`NXL_CHANNEL_DIR` 로 발행 대상을 다른 저장소로 바꿀 수도 있다 (기본값 = 이 저장소).

## 주의

- 사내용이므로 페이지에 robots noindex 를 둔다.
- VSIX 는 공개 저장소에 올라간다 — 버전·체크섬 외 사내 문서(INSTALL.md 등)는 올리지 않는다.
