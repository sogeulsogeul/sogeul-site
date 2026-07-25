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
| 협업 문의 | 협업 가능 영역과 연락처 |

## 폴더 구조

```
sogeul-site/
├── index.html          # 문서 구조 (본문 마크업)
├── assets/
│   ├── css/
│   │   └── style.css   # 전체 스타일
│   └── js/
│       └── main.js     # 앵커 링크 부드러운 스크롤
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
