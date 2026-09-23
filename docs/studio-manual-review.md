# Studio 매뉴얼 갱신 · 2026-09-23

범위는 `studio-manual.html`의 캡처와 사용 설명입니다. 공통 페이지·매뉴얼 디자인은 유지했습니다.

## 반영한 내용

- 기존 11개 이미지 자리의 구형·혼합 캡처를 매뉴얼 전용 16개 장면으로 교체했습니다. 실제 앱의 라이트·다크 테마로 총 32장을 촬영했습니다.
- ‘주말의 발견’ 전시 예약 예제로 기획 → User Flow → 디자인 → 프로토타입 → 개발을 설명합니다. 다른 서비스의 디자인 화면을 섞지 않습니다.
- 질문·PRD·기능별 검토, 화면 목록·속성·요소 추가, 계획/구현 모드, 파일 맥락과 관리 파일, 산출물, UX Writing, 스킬, 설정과 문제 해결을 보강했습니다.
- 현재 이미지 도구의 ‘변경 저장’, SVG/PNG 내보내기, 배경·배율·비율 유지, 조건부 모션 내보내기 안내를 반영했습니다.
- [캡처 출처](../images/studio-manual/README.md)와 [직접 제작한 그래픽](../examples/weekend-discovery/weekend-pass.svg)을 함께 보관합니다.

## 문구 검토

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH · 해결 | `studio-manual.html` 기획·디자인·이미지·Figma 절 | 구형 사이드바와 기능명으로 진입 경로 설명 | 현재 앱의 프로젝트 단계 및 AI 도구 경로 | 화면의 실제 행동과 설명을 일치시킴 |
| HIGH · 해결 | `studio-manual.html` 이미지 생성 | 예전 저장·다운로드 명칭 | 변경 저장, SVG, PNG · 2×와 해당 스타일에만 표시되는 모션 내보내기 | 실제 제공되는 결과 형식을 명확히 안내 |
| MEDIUM · 해결 | `studio-manual.html` 프로젝트 흐름 | 개발을 누락한 4단계 설명 | 기획부터 개발까지 5단계 및 단계별 확인 내용 | 문서와 앱의 순서를 일치시킴 |
| MEDIUM · 해결 | `studio-manual.html` 캡처·캡션 | 서로 다른 서비스와 이전 UI 혼용 | 동일한 전시 예약 예제와 최신 캡처 | 단계 사이의 문맥을 유지 |

소스와 실제 화면의 메뉴명을 대조했습니다. 남은 HIGH 없음. **Approve.**

## 확인 결과

- `scripts/check-site.mjs`: 7페이지, 로컬 링크·자산 450개, 파일 해시, 앵커, 배포 메타데이터 통과.
- 매뉴얼 이미지 32장 모두 실제 HTTP 로딩·디코딩 성공, 3360×2100 규격 확인.
- 두 테마에서 axe WCAG A/AA 자동 검사 위반 0건.
- 320, 390, 600, 768, 832, 833, 1024, 1440, 1920px에서 문서 가로 넘침 없음.
- 목차 검색·결과 없음·검색 초기화·Enter 이동·읽는 위치·포커스 확인.
- 이미지 확대·Escape 닫기·초점 복귀·모바일 가로 스크롤 확인.
- 모바일 목차 닫힘과 앵커 이동, JavaScript 없는 환경의 목차 탐색 확인.
- 브라우저 JavaScript 오류 없음. `git diff --check` 통과.
- 렌더된 매뉴얼과 주요 원본 캡처를 직접 확인했습니다.

설치 파일 실행, 외부 Figma 변환과 실제 예약·결제 연동은 이번 작업 범위에서 실행하지 않았습니다. Figma 화면은 생성 준비 상태로 표시합니다. 로컬 개발 화면과 설치 배포본의 차이는 문서 첫 안내에 명시했습니다.

커밋·푸시·배포는 하지 않았습니다.

## 입문 안내 추가 · 2026-09-23

이번 추가 범위는 처음 사용하는 사람을 위한 세부 사용법입니다.

- Claude 계정 준비, Mac 터미널/Windows PowerShell 열기, 공식 CLI 설치, 버전 확인, 로그인, Studio 사번 입력·계정 연결, 토큰 방식, 계정 변경·연결 해제.
- 설치 오류와 PATH 복구, 설치 진단, CLI와 Studio 앱 업데이트 구분.
- 도구 고정, 개인 홈/시작 화면의 제공 상태, 왼쪽 패널 고정, 테마 변경, 프로젝트 검색·정렬·이름 변경·삭제, 첫 요청과 수정 요청.
- `.nxlproj` 내보내기·가져오기·복제, 포함/제외 범위, 64MB 개별 파일 및 512MB 가져오기 제한, 외부 연결 저장소 이동, 요구사항 문서 가져오기와 산출물의 차이.
- 가이드 탐색 36개 항목. 제목·본문·별칭을 검색하며 CLI 명령은 입력 위치와 복사 버튼을 함께 제공. 복사 권한이 없으면 명령을 선택하고 수동 복사 안내.
- 가이드 허브에 Claude 설치, 개인 환경, 프로젝트 이동 진입점 추가. 기존 매뉴얼 디자인과 5단계 작업 순서 유지.

### 실제 제공 상태

로컬 Studio의 `/home`은 `/projects`로 이동하며, 설정 다이얼로그는 `personal` 요청을 `account`로 처리합니다. 관련 컴포넌트는 소스에 남아 있지만 현재 화면에서 시작 화면 선택과 개인 홈 순서 편집을 열 수 없습니다. 문서에 이 상태를 명시하고, 현재 동작하는 도구 고정·패널 고정·테마 변경과 구분했습니다. 앱 소스나 사용자 계정 설정은 수정하지 않았습니다.

### 검증 근거

- 앱 소스: `components/projects/projects-manager.tsx`, `lib/projects/{project-archive,export-project,import-project}.ts`, `components/spec/import-dialog.tsx`, `components/studio/*`, `components/sidebar.tsx`, `components/settings-dialog.tsx`, `desktop/src/setup/setup.html`.
- 공식 설치: https://code.claude.com/docs/en/setup
- 터미널 입문: https://code.claude.com/docs/en/terminal-guide
- 로그인: https://code.claude.com/docs/en/quickstart 및 https://code.claude.com/docs/en/authentication
- PATH/설치 오류: https://code.claude.com/docs/en/troubleshoot-install
- 확인일: 2026-09-23. Windows에서 Git Bash는 현행 공식 문서상 선택 사항이며, PowerShell 설치를 기본 안내로 사용했습니다.
- 실제 앱 UI에서 예제 559를 내보내 다운로드 성공: 12,360,325바이트, `nxlproj` 스키마 1, 320개 파일, 기획·디자인 대화 2개, User Flow와 개발 파일 포함, 경고 없음. 검증 파일은 `/tmp`에만 보관. 가져오기 동작은 구현을 확인했고 사용자 데이터에 복사본은 만들지 않았습니다.
- CLI 설치·로그인 명령은 공식 문서와 대조했으며, 사용자 컴퓨터에서 설치/업데이트/계정 변경을 실행하지 않았습니다.
- 18개 장면/36개 이미지 로딩·테마 전환, 두 테마 axe WCAG A/AA, 9개 너비의 가로 넘침 검사 통과.
- 본문/별칭 검색, 빈 결과, 초기화, 앵커와 초점, 명령 복사 성공·실패 경로, 확대와 모바일 스크롤, JavaScript 없는 탐색 통과. Builder 매뉴얼의 공통 스크립트와 가이드 허브 링크도 확인.
- `scripts/check-site.mjs`: 7페이지, 로컬 링크/자산 491개 통과. `git diff --check` 통과.

커밋·푸시·배포는 하지 않았습니다.
