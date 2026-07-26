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
| 프로젝트 | 직접 만든 웹 도구 카드 (Tonfit · 맛집 순위 · 오피스타임) |
| 협업 문의 | 협업 가능 영역과 연락처 |

## 폴더 구조

```
sogeul-site/
├── index.html                    # 포트폴리오 본문 마크업
├── html/
│   ├── matjip.html               # 맛집 순위 페이지
│   └── office.html               # 오피스타임 (팀 게임·챌린지 앱)
├── assets/
│   ├── css/
│   │   ├── style.css             # 포트폴리오 스타일
│   │   ├── matjip.css            # 맛집 순위 페이지 스타일
│   │   └── office.css            # 오피스타임 스타일
│   └── js/
│       ├── main.js               # 앵커 링크 부드러운 스크롤
│       ├── matjip.js             # 맛집 순위 렌더링 · 지역 필터
│       └── office.js             # 오피스타임 라우팅 · 게임 · 저장소
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

## 오피스타임 (`html/office.html`)

같은 회사·팀 동료끼리 쓰는 가벼운 게임·챌린지 웹앱입니다.
컨셉은 "사무실 코르크보드" — 게임 결과와 챌린지 인증이 압정 꽂힌 포스트잇으로 보드에 쌓입니다.

### 화면

| 화면 | 내용 |
| --- | --- |
| 온보딩 | 닉네임 입력 → 그룹 코드로 합류하거나 새 팀 만들기(코드 5자리 자동 생성) |
| 홈 | 오늘의 추천 배너, 빠른 실행 3버튼, 팀 피드(포스트잇 보드), 팀 랭킹 TOP 3 |
| 게임 | 사다리타기 · 메뉴 룰렛 · 밸런스 게임 |
| 챌린지 | 물 마시기 · 스트레칭 · 노커피 3종, 하루 1회 인증(+10P), 챌린지별 랭킹 |
| 우리팀 | 그룹 코드 표시·복사, 팀원 추가, 멤버 포인트 랭킹 |
| 마이 | 내 포인트·순위·뱃지(포인트 기준 자동 지급), 팀 나가기 |

사다리타기는 눈속임이 아니라 실제 사다리를 만듭니다. 세로줄 사이에 가로대를 무작위로 놓고
(같은 높이에 연달아 붙지 않게) 경로를 따라 내려가므로 결과는 언제나 1:1 매칭입니다.
룰렛도 당첨 조각을 먼저 뽑은 뒤 그 조각의 한가운데가 바늘에 오도록 최종 각도를 역산해서,
화면에 멈춘 위치와 발표되는 결과가 항상 일치합니다.

### 저장 구조

전부 브라우저 `localStorage`에 저장합니다.

| 키 | 내용 |
| --- | --- |
| `ow_profile` | 내 프로필 `{ id, nickname, code }` |
| `ow_team_{code}` | 팀 정보와 멤버·포인트 |
| `ow_feed_{code}` | 팀 피드(포스트잇) 목록 |
| `ow_checkins_{code}_{challengeId}` | 챌린지 인증 기록 |
| `ow_balance_{code}` | 밸런스 게임 투표 (`sessionStorage`, 탭을 닫으면 사라짐) |

### ⚠️ 알아둘 한계 — 기기 간 공유가 안 됩니다

`localStorage`는 **브라우저마다 따로** 저장됩니다. 그래서 팀을 만든 뒤 그룹 코드를 알려줘도
**다른 사람의 기기나 다른 브라우저에서는 그 팀을 찾지 못합니다.**
지금 구조는 노트북 한 대를 돌려가며 쓰는 팀, 또는 혼자 둘러보는 데모에 맞습니다.
이 점은 온보딩 화면과 "우리팀" 화면에도 안내 문구로 노출해 두었습니다.

여러 사용자 간 실시간 동기화가 필요해지면 Firebase / Supabase를 붙이면 됩니다.
`assets/js/office.js`의 모든 데이터 접근은 `Repo` 객체 한 곳을 거치도록 되어 있어서,
`Repo`의 각 메서드를 원격 호출로 바꾸고 Promise를 반환하게 만든 뒤 렌더 호출부를 `await` 하면
화면 코드는 거의 그대로 재사용할 수 있습니다.

### 기술 노트

- 프레임워크·빌드 도구 없이 순수 HTML/CSS/JS. 화면별 `render*()` 함수 + `document` 이벤트 위임 구조입니다.
- 라우팅은 해시 기반(`#/games/ladder` 등)이고, 화면이 바뀌면 `<main>`으로 포커스를 옮깁니다.
- 폰트는 Noto Sans KR(본문) + Gaegu(헤드라인)를 Google Fonts에서 불러옵니다.
- 결과 알림은 네이티브 `<dialog>`를 써서 Esc 닫기·포커스 트랩을 브라우저에 맡깁니다.
- 요청받은 4색(coral/teal/amber/lavender)은 종이 배경 위 본문 텍스트로 쓰면 WCAG AA 4.5:1을
  넘지 못해(각각 2.78 / 3.64 / 1.38 / 3.36), **원색은 면·핀·그래픽 전용**으로 두고
  텍스트에는 어둡게 파생한 `--coral-deep` `--teal-deep` `--lavender-deep`(5:1 이상)을 씁니다.
- 데스크톱은 좌측 고정 사이드바, 860px 이하에서는 하단 탭바로 전환됩니다.

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
