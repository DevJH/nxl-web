# LIFEPLUS SELECT · 멤버십 홈

NEXTLAB Studio 대표 화면을 위해 새로 제작한 반응형 HTML 시안입니다.
주제는 전시·문화, 다이닝, 스테이를 발견하는 프리미엄 멤버십 서비스입니다.
장소·혜택은 예시이며 실제 예약이나 결제는 제공하지 않습니다.

- 로컬 미리보기: `http://localhost:3300/examples/studio-membership/`
- Studio 편집: `http://localhost:3200/w/talk-to-design?c=518&file=membership-home.html`
- 정본: 이 폴더의 `index.html`과 `images/`
- 기능: 카테고리·지역·일정 필터, 검색, 저장과 저장 목록, 상세 팝업, 모바일 메뉴.
- 레이어: `data-name`으로 영역과 요소에 읽기 쉬운 한글 이름을 부여했습니다.

## Studio 저장 방식

Studio의 초기 생성 요청은 개발 서버 재시작으로 중단되었습니다. 이후 HTML/CSS/JS를 직접 작성하고 브라우저에서 보정한 파일을 새 작업 공간 518에 저장했습니다. 자동 생성·자동 품질 검사를 통과한 결과라고 주장하지 않습니다.

각 이미지는 `/api/workspace-asset`으로 작업 공간 518의 `assets/select-*.jpg`에 저장했습니다. Studio에 저장한 HTML은 로컬 `images/*.jpg` 경로 대신 해당 이미지 API 주소를 사용합니다. HTML은 `/api/design/save`로 `membership-home.html`에 저장했습니다. 다른 작업 공간은 수정하지 않았습니다.

대표 캡처는 실제 Studio 편집 화면에서 데스크톱 너비 1440px, 맞춤 배율, 제목 선택 상태로 촬영했습니다. 화면 목록은 접고 레이어를 작업 영역 단위로 정리했습니다. 스크린샷 합성·필터는 사용하지 않았습니다.

## 사진 출처

Unsplash 이미지 CDN에서 내려받아 로컬 이미지로 제공합니다. 화면에 맞는 크기와 품질은 CDN 매개변수로 지정했고, 배치는 CSS의 `object-fit`과 `object-position`으로 조정했습니다.

- `selection.jpg`: https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=80
- `culture.jpg`: https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=640&q=78
- `dining.jpg`: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=85
- `stay.jpg`: https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80

## 확인한 동작

데스크톱·모바일 axe WCAG A/AA 검사, 320·390·768·1024·1280·1440px 가로 넘침, 필터 조합과 빈 결과, 초기화, 저장 후 새로고침, 검색, 상세 팝업과 Escape, 스테이 CTA, 모바일 메뉴와 멤버십 팝업을 확인했습니다.
