# 주말의 발견 · 전시 예약 예제

NEXTLAB Studio의 기획·기능명세와 User Flow를 소개하기 위해 직접 제작한 가상 서비스입니다. 실제 회사·서비스와의 관계를 나타내지 않습니다. 전시·장소·일정·예약 정보는 예시입니다.

- Studio 프로젝트: `http://localhost:3200/projects?p=559&tab=spec`
- User Flow: `http://localhost:3200/projects?p=559&tab=flow`
- 연결 디자인 작업 공간: 560
- 프로토타입: `http://localhost:3200/projects?p=559&tab=prototype`
- 개발 작업대: `http://localhost:3200/projects?p=559&tab=dev`
- 로컬 화면 둘러보기: `http://localhost:3300/examples/weekend-discovery/`

## 구성

- `spec.json`: PRD와 기능 6개의 설명, 대상 사용자, 완료 조건.
- `flow.json`: 시작·완료 노드와 네 화면의 연결. 실제 Studio 흐름 보드에 저장한 문서.
- `index.html` → `detail.html` → `booking.html` → `complete.html`: 경험 탐색, 전시 상세, 방문 일정, 예약 완료.

화면 원본은 반응형 HTML/CSS입니다. 날짜·시간을 선택하면 세션 동안 예제 예약 내용에 반영됩니다. 실제 예약·결제 요청은 보내지 않습니다. 기획 문서는 제품의 목표 동작과 예외 조건을 설명하며, 이 시안이 서버 기능을 구현했다는 의미는 아닙니다.

Studio에는 새 프로젝트와 디자인 작업 공간을 만들어 저장했습니다. 기존 프로젝트는 수정하지 않았습니다. 기획과 화면은 직접 작성한 예제이며 AI 자동 생성 결과로 표시하지 않습니다. 기능별 검토 상태는 미검토로 유지했고, User Flow의 기능 연결·시작·완료 구조 경고가 없는 것을 확인했습니다.

## 캡처

`images/studio-current/spec-{light,dark}.jpg`와 `flow-{light,dark}.jpg`는 실제 Studio 화면을 1680×1050, 기기 배율 2로 촬영했습니다. 기능명세는 ‘예약 신청’을 선택했고, User Flow는 네 화면과 시작·완료 지점이 보이도록 맞춤 배율을 사용했습니다. 테마 변경과 앱의 선택·배율 조작만 사용했습니다.

사진은 `../studio-membership/images/culture.jpg`와 `selection.jpg`를 재사용했습니다. 출처는 해당 폴더의 README에 기록되어 있습니다. Studio에서는 작업 공간 560의 이미지 자산으로 저장해 참조합니다.

## 프로토타입과 개발 소개

예약 여정의 4단계 시나리오와 화면 연결을 직접 작성해 같은 프로젝트에 저장했습니다. AI가 자동 생성한 시나리오로 표시하지 않습니다. 개발 작업대는 Studio의 실제 프로젝트 조립 기능으로 만든 결과이며, 코드 문법·타입·앱 빌드 검사를 통과했습니다. 실제 예약 서버 기능의 완성을 뜻하지 않습니다.

개발 캡처에는 연결된 파일 목록과 `src/routes.tsx`를 열었습니다. 작업 대화는 비어 있는 예제이며 생성·수정·리뷰 결과를 꾸며 넣지 않았습니다. 자동 Git 체크포인트를 만드는 작업 생성 API는 사용하지 않았고, 로컬 예제 작업의 빈 메타데이터만 저장했습니다. 커밋과 푸시는 수행하지 않았습니다.
