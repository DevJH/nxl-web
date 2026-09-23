# nxl-web — NEXTLAB 배포 채널

사내 배포 채널. **https://nxl-ai-tools.reala.pro** (main 푸시 = Vercel 자동 배포)

두 제품을 함께 호스팅한다.

- **Builder(VSCode 확장)** — 채널 루트. 사용자메뉴얼·소개자료 + VSIX 다운로드,
  설치된 확장의 업데이트 확인이 읽는 `release-manifest.json`.
- **Studio(데스크톱 앱)** — `studio/` 하위. 설치본(dmg·exe) 다운로드 페이지 +
  Electron 자동 업데이트가 읽는 `latest.yml`·`latest-mac.yml`.

Studio 자산을 `studio/` 로 격리한 이유: `latest.yml` 같은 일반 이름이 루트에서
확장 배포와 충돌한다.

빌드나 프레임워크 없이 정적 HTML + 공통 CSS/JavaScript + Node 배포 스크립트로 구성합니다.
(Vercel Framework Preset: Other)

## 구성

| 경로 | 내용 | 생성 |
|------|------|------|
| `index.html` | 제품 소개 + 현재 Studio 화면 둘러보기 | 이 저장소에서 관리 |
| `download.html` · `studio/index.html` | 제품별 다운로드·설치 안내 | 이 저장소에서 관리 |
| `guide.html` | 시작 가이드와 제품별 문서 탐색 | 이 저장소에서 관리 |
| `assets/` | 공통 테마, 내비게이션, 다운로드 로직, 문서 스타일 | 이 저장소에서 관리 |
| `examples/weekend-discovery/` | 기획·User Flow 캡처용 가상 전시 예약 서비스 | 직접 제작 · Studio 프로젝트 559 |
| `examples/studio-membership/` | Studio 대표 캡처용 멤버십 홈 시안과 이미지 원본 | 직접 제작 · Studio 작업 공간 518에 저장 |
| `images/studio-current/` | 현재 Studio의 라이트·다크 화면 캡처 | localhost:3200에서 캡처 |
| `images/studio-manual/` | Studio 매뉴얼 전용 16개 장면의 라이트·다크 캡처 | 2026-09-23 실제 앱 · 전시 예약 예제 |
| `manual.html` · `studio-manual.html` | 제품별 상세 사용 가이드 | 이 저장소에서 관리 · 제품 버전 표기는 발행 시 갱신 |
| `images/` | 제품 화면과 문서 이미지 | 이 저장소에서 관리 |
| `release-manifest.json` | 버전·해시·크기 — 확장 업데이트 확인 + 다운로드 페이지가 읽는다 | 자동 |
| `releases/<버전>/*.vsix` | 최신 VSIX 1개만 | 자동 |
| `vercel.json` | 매니페스트·업데이트 메타 `no-store` (CDN stale 캐시로 옛 버전 보는 문제 방지) | 수동 |
| `.github/workflows/release.yml` | `v*` 태그 push → GitHub Release 생성 + VSIX 첨부 | 수동 |
| `studio/latest.yml`<br>`studio/latest-mac.yml` | Electron 자동 업데이트 메타 — **빠지면 업데이트가 조용히 안 된다** | 자동 |
| GitHub Release 자산 | Studio 설치본(DMG·EXE·ZIP) | 배포 스크립트로 업로드 |
| `studio/version.json` | 버전·해시 조회용 (mac 알림 폴백) | 자동 |

다운로드 페이지는 버전·VSIX 경로·파일명을 `release-manifest.json`에서, Studio 설치 정보를 `studio/version.json`에서 읽습니다 —
릴리스마다 HTML 을 고칠 필요가 없다.

**사이트 페이지의 정본은 이 저장소입니다.** 제품 소개, 다운로드, 가이드와 공통 자산은 여기에서 수정합니다.
`publish-channel`은 기본적으로 문서를 복사하지 않습니다. `NXL_PUBLISH_DOCS=1`을 명시하면 모노레포의 예전 문서가 덮어써질 수 있으므로 원본과 변경 내용을 먼저 확인하세요.
`publish-studio`는 현재 `studio/index.html`을 보존하며 버전·다운로드 주소는 `studio/version.json`에서 읽습니다.

## 로컬 미리보기와 확인

CSS/JavaScript 또는 이미지 수정 후에는 아래 명령으로 내용 해시를 HTML의 자산 URL에 반영합니다. 기존 브라우저가 이전 스타일·캡처를 재사용하는 문제를 방지하며, `check-site`가 누락된 갱신을 검사합니다. 갤러리는 각 탭의 `data-light-src`·`data-dark-src`를 사용하므로 동적으로 선택하는 이미지에도 같은 버전이 적용됩니다.

```bash
node scripts/version-assets.mjs
python3 -m http.server 3300 --bind 127.0.0.1
# http://127.0.0.1:3300
node scripts/check-site.mjs
```

- 테마는 기존 다크 화면을 기본으로 하며, 헤더에서 바꾼 선택을 `nxl-web-theme`에 저장합니다.
- `/`, `/download.html`, `/studio/`, `/guide.html`, 두 상세 가이드와 `/updates.html`이 공통 테마를 사용합니다.
- 홈 이외 6개 페이지의 제목·제품 색상·여백은 `assets/pages.css`를 공유합니다. 두 매뉴얼의 본문·표·목차는 `assets/docs.css`, 목차 검색·읽는 위치·캡처 확대는 `assets/docs.js`에서 관리합니다. 매뉴얼 HTML에 별도 전역 스타일을 추가하지 않습니다.
- 매뉴얼 목차는 기능명으로 검색할 수 있습니다. 모바일에서는 목차를 펼쳐 이동하며, 캡처의 ‘확대 보기’에서 원본을 크게 보고 좌우로 스크롤할 수 있습니다.
- `/download.html`은 두 제품의 설치 파일을 비교·선택하는 화면이고, `/studio/`는 Studio 전용 다운로드 화면입니다. 두 페이지의 스타일은 `assets/download.css`에 있습니다.
- 설치 안내와 도움말은 기본 HTML 펼침 목록을 사용합니다. 설치 항목으로 연결되는 앵커를 누르면 해당 안내가 자동으로 열립니다.
- 메인 Studio 미리보기(기획·기능명세 → User Flow → 화면 디자인 → 프로토타입 → 개발)는 키보드 방향키로 전환할 수 있고, 확대 화면은 Escape로 닫습니다.
- 설치 정보 요청 실패 시 다운로드 링크를 비활성화하고 재시도를 제공합니다.
- `nextlab-intro*.html` 및 기존 PDF/PNG는 별도의 인쇄·공유용 자료이며 이번 웹 개편의 생성 대상이 아닙니다.
- 로컬 검증 명령은 배포 스크립트를 실행하거나 GitHub에 업로드하지 않습니다.

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
   - 문서 복사는 기본적으로 생략. `NXL_PUBLISH_DOCS=1`일 때만 문서와 참조 이미지를 복사

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

- 설치본은 GitHub Release에 올리고 `studio/`에는 `latest*.yml`과 `version.json`을 생성합니다. 다운로드 페이지는 현재 디자인을 그대로 보존합니다.
- `studio/`에는 최신 릴리스 메타데이터와 다운로드 페이지만 남습니다. 수백 MB의 설치본은 Git 저장소에 넣지 않습니다.
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
