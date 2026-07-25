# sogeul-site

**소글소글(sogeul)** 의 채널 아카이브 원페이지 사이트입니다.
복층 오피스텔에 사는 30대 직장인의 일상 기록을 모아두고, 운영 중인 채널과 협업 문의 창구를 안내합니다.

> Thoughtfully Archived — 평범한 하루를 오래 남는 기록으로.

## 구성

| 섹션 | 내용 |
| --- | --- |
| Hero | 사이트 인트로와 슬로건 |
| 소개 | 소글소글이 어떤 기록을 남기는지 |
| 채널 | Instagram · YouTube · 네이버 블로그 · GitHub 링크 |
| 프로젝트 | 직접 만든 웹 도구 카드 (Tonfit · 맛집 순위) |
| 협업 문의 | 협업 가능 영역과 연락처 |

## 폴더 구조

```
sogeul-site/
├── index.html                    # 포트폴리오 본문 마크업
├── html/
│   └── matjip.html               # 맛집 순위 페이지
├── assets/
│   ├── css/
│   │   ├── style.css             # 포트폴리오 스타일
│   │   └── matjip.css            # 맛집 순위 페이지 스타일
│   └── js/
│       ├── main.js               # 앵커 링크 부드러운 스크롤
│       └── matjip.js             # 맛집 순위 렌더링 · 지역 필터
├── data/
│   ├── places.json               # 갱신 대상 Place ID 목록 (직접 채움)
│   └── restaurants.json          # 자동 생성 — 평점 결과 (Actions가 커밋)
├── scripts/
│   └── fetch-ratings.mjs         # 구글 Places API 평점 조회
├── .github/workflows/
│   └── refresh-ratings.yml       # 매일 KST 03:00 평점 갱신
└── README.md
```

## 실행 방법

빌드 도구나 의존성 설치가 필요 없는 정적 사이트입니다.

```bash
# 방법 1 — 파일을 바로 열기
open index.html

# 방법 2 — 로컬 서버로 띄우기 (권장)
python3 -m http.server 8000
# → http://localhost:8000
```

## 기술 노트

- 프레임워크 없이 순수 HTML / CSS / JavaScript로 작성했습니다.
- 본문 폰트는 [Pretendard](https://github.com/orioncactus/pretendard), 제목 폰트는 Paperlogy를 jsDelivr CDN에서 불러옵니다.
- 접근성: 본문 바로가기 링크, `aria-label` / `aria-labelledby`, `prefers-reduced-motion` 대응을 적용했습니다.
- 반응형 레이아웃으로 모바일과 데스크톱을 모두 지원합니다.

## 맛집 순위 페이지 (`html/matjip.html`)

구글 지도 평점을 기준으로 지역별 맛집 순위를 보여주는 하위 페이지입니다.
`data/restaurants.json`이 있으면 실데이터로, 없으면 **목업 데이터**로 자동 폴백하므로
아래 설정을 하지 않아도 화면은 깨지지 않습니다.

### 1. 구글 API 키 발급

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. **결제 계정 연결** (API 사용의 필수 조건 — 무료 크레딧 범위 내에서는 과금되지 않음)
3. API 라이브러리에서 **"Places API (New)"** 활성화
4. 사용자 인증 정보 → API 키 생성
5. 키 제한(권장): "API 제한사항"에서 **Places API (New)** 만 허용하도록 설정

### 2. 저장소에 키 등록

**Settings → Secrets and variables → Actions → New repository secret**

- Name: `GOOGLE_MAPS_API_KEY`
- Value: 위에서 발급한 키

절대 코드에 직접 키를 적지 마세요. GitHub Actions가 서버 쪽에서만 이 Secret을 읽습니다.

### 3. Place ID 채우기

`data/places.json`의 `PLACE_ID_여기에_붙여넣기_1` 자리에 실제 Google Place ID를 넣습니다.
[Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id)에서
가게 이름·주소로 검색하면 나옵니다.

`region` 값은 `seoul-seongdong / seoul-mapo / seoul-gangnam / gyeonggi` 중 하나입니다.
새 지역을 추가하려면 `assets/js/matjip.js`의 `REGIONS` 배열에도 같이 넣어야 필터로 나타납니다.

### 4. 동작 확인

- **Actions 탭 → "맛집 평점 매일 갱신" → Run workflow** 로 수동 실행해서
  `data/restaurants.json`이 커밋되는지 먼저 확인하세요.
- 이후로는 매일 KST 새벽 3시에 자동 실행됩니다.
- 갱신 주기를 바꾸려면 `.github/workflows/refresh-ratings.yml`의 `cron` 값을 조정합니다
  (호출량이 늘면 비용도 늘어납니다).

### 알아둘 점

- **실시간이 아닙니다.** 구글이 평점 변경을 알려주는 기능이 없어 하루 1번 다시 물어보는 방식입니다.
- **새 맛집을 자동으로 찾아주지 않습니다.** `data/places.json`에 등록해 둔 가게의 평점만 갱신합니다.
  자동 탐색은 별도의 검색 API(Nearby/Text Search) 연동이 필요하고 비용 구조도 달라집니다.
- 정적 파일이라 `file://`로 직접 열면 `fetch`가 막혀 목업 데이터만 보입니다.
  로컬에서는 아래 "실행 방법"의 로컬 서버로 띄워야 실데이터를 읽습니다.

## 채널

- Instagram — [@_sogeul](https://www.instagram.com/_sogeul)
- YouTube — [@sogeul](https://youtube.com/@sogeul)
- 네이버 블로그 — [sogeulsogeul](https://m.blog.naver.com/sogeulsogeul)
- GitHub — [sogeulsogeul](https://github.com/sogeulsogeul)

## 협업 문의

인스타그램 · 유튜브 · 네이버 블로그 콘텐츠, 웹사이트 제작 관련 제안을 받고 있습니다.
📮 sogeulsogeul@gmail.com

---

© 2026 sogeul
