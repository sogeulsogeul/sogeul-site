# 로컬 PDF 변환기

PDF 하나를 **이미지 · Excel · 텍스트**로 바꾸고 **페이지를 분할**하는 정적 웹 앱입니다.
서버도, 빌드 과정도 없습니다. 파일은 브라우저 메모리에만 올라가고 **어디로도 업로드되지 않습니다.**

> 이 앱에는 네트워크로 파일을 보내는 코드 경로가 존재하지 않습니다.
> 라이브러리도 CDN이 아니라 `vendor/`에 자체 호스팅하므로, 설치 후에는 완전히 오프라인으로 동작합니다.

## 기능

| 모드 | 하는 일 |
| --- | --- |
| **이미지** | 각 페이지를 JPG/PNG로 렌더링. 해상도 1.5x/2x/3x, 페이지 범위 지정, 썸네일 클릭 시 낱장 저장, 여러 장이면 ZIP 일괄 저장 |
| **Excel** | 글자의 x·y 좌표를 읽어 행·열을 재구성 → `.xlsx` 생성. 미리보기 표와 CSV 저장 제공. 페이지별 시트 / 한 시트 합치기 선택 |
| **텍스트** | 본문을 줄 단위로 재구성해 `.txt` 추출. 미리보기·복사 지원. 여러 페이지면 페이지 구분선 삽입 |
| **PDF 분할** | 지정한 페이지만 새 PDF로. "하나의 PDF" 또는 "페이지별 개별 PDF(ZIP)" |

## 폴더 구조

```
pdf/
├── index.html               # UI와 로직 전부 (단일 파일)
├── manifest.webmanifest     # PWA 설치 정보
├── sw.js                    # 오프라인 캐시 서비스 워커
├── assets/
│   ├── icon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
├── vendor/                  # 자체 호스팅 라이브러리 (CDN 안 씀)
│   ├── pdf.min.js           # pdf.js 3.11.174
│   ├── pdf.worker.min.js    # pdf.js 워커 (같은 도메인)
│   ├── xlsx.full.min.js     # SheetJS 0.18.5
│   ├── jszip.min.js         # JSZip 3.10.1
│   └── pdf-lib.min.js       # pdf-lib 1.17.1
└── README.md
```

## 로컬에서 확인하기

`file://`로 열면 **동작하지 않습니다.** pdf.js 워커와 서비스 워커가 `file://` 스킴에서 막히기 때문에,
반드시 로컬 서버로 띄워야 합니다.

```bash
# 저장소 루트에서
cd pdf
python3 -m http.server 8000
```

그다음 브라우저에서 열기:

```
http://localhost:8000/
```

저장소 루트에서 한 번에 띄우고 싶다면:

```bash
python3 -m http.server 8000
# → http://localhost:8000/pdf/
```

포트가 이미 쓰이고 있으면 `python3 -m http.server 8080`처럼 다른 번호를 쓰면 됩니다.
서버를 멈출 때는 터미널에서 `Ctrl+C`.

### 서비스 워커를 고쳤다면

브라우저가 옛 서비스 워커를 붙들고 있어 변경이 반영되지 않을 수 있습니다.
개발자 도구 → Application → Service Workers → **Unregister** 후 새로고침하거나,
`sw.js`의 `CACHE` 버전 문자열(`pdf-tool-v1`)을 올리세요.

## 배포

빌드 없이 그대로 올라갑니다. GitHub Pages는 저장소 루트에 `.nojekyll`이 있어야
`_`로 시작하는 경로가 무시되지 않습니다(이 저장소에는 이미 있습니다).

- **GitHub Pages** — `main` 브랜치 루트를 소스로 지정하면 `/<저장소>/pdf/`에서 열립니다.
- **Netlify** — 이 폴더를 그대로 드래그해 올리면 됩니다. 빌드 명령 없음, publish 디렉터리는 `pdf`.

경로를 전부 상대경로(`./vendor/...`)로 적어 두어서 서브디렉터리 배포에서도 그대로 동작합니다.

## 모바일 메모리 대응

모바일 웹뷰는 메모리 한계가 낮아 큰 PDF에서 잘 죽습니다. 다음을 넣어 두었습니다.

- **캔버스 자동 축소** — iOS 한계(면적 약 16.7M px, 한 변 4096px)를 넘으면 **그 페이지만** 배율을 낮춰 렌더합니다. 몇 장이 축소됐는지 결과에 표시합니다.
- **썸네일 축소** — 화면에는 전체 해상도 대신 200px 썸네일만 올려 DOM 메모리를 아낍니다.
- **캔버스 해제** — 페이지 처리가 끝나면 `canvas.width = canvas.height = 0`으로 즉시 메모리를 놓아줍니다. 실패한 페이지도 `finally`에서 똑같이 해제합니다.
- **`toBlob` 폴백** — `canvas.toBlob`이 `null`을 반환하면 `toDataURL`로 우회합니다.
- **페이지별 try/catch** — 한 장이 실패해도 전체가 멈추지 않고, 실패한 페이지만 "변환 실패"로 표시한 뒤 계속 진행합니다.
- **ArrayBuffer detach 방지** — pdf.js와 pdf-lib는 넘겨받은 버퍼를 detach시킵니다. 그래서 넘길 때마다 `bytes.slice()`로 **새 복사본**을 만들어, 같은 파일로 여러 번 변환해도 깨지지 않습니다.
- **큰 파일 안내** — 25MB 이상이거나 40쪽 이상이면 "해상도 표준 + 페이지 범위 분할(`1-20`, `21-40`)" 팁을 상시 노출합니다.

## 알아둘 점

**스캔 PDF는 글자를 뽑을 수 없습니다.** 파일을 열면 앞 몇 페이지를 표본으로 텍스트 레이어가 있는지 확인하고,
없으면 "OCR 필요" 안내를 띄운 뒤 이미지 변환을 권합니다. 이 앱에는 OCR 기능이 없습니다.

**Excel 변환은 추정입니다.** 표의 괘선을 인식하는 게 아니라 글자의 x·y 좌표로 행과 열을 추정합니다.

1. y 좌표가 가까운 글자를 같은 **행**으로 묶습니다(허용 오차 = 글자 높이 중앙값 × 0.6).
2. 한 행 안에서 가로 간격이 글자폭의 1.6배를 넘으면 다른 **칸**으로 끊습니다.
3. 페이지 전체의 칸 시작 x를 모아 **열 기준선**을 만들고, 각 칸을 가장 가까운 열에 배치합니다.

그래서 칸 병합이 많거나 여백이 불규칙한 문서는 열이 어긋날 수 있습니다. 변환 후 미리보기 표로 확인하세요.

**CSV는 BOM을 붙여 저장합니다.** 엑셀이 한글을 깨뜨리지 않게 하기 위해서입니다.

## 라이브러리

전부 npm에서 받아 `vendor/`에 두었습니다. 다시 받으려면:

```bash
npm pack pdfjs-dist@3.11.174   # build/pdf.min.js, build/pdf.worker.min.js
npm pack xlsx@0.18.5           # dist/xlsx.full.min.js
npm pack jszip@3.10.1          # dist/jszip.min.js
npm pack pdf-lib@1.17.1        # dist/pdf-lib.min.js
```

각 tarball을 풀어 위 주석의 파일을 `vendor/`에 복사하면 됩니다.
pdf.js 워커는 `GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js'`로 같은 도메인을 가리킵니다.

## 브라우저

최신 Chrome · Edge · Safari · Firefox에서 동작합니다.
`async/await`, `canvas.toBlob`, `Promise`를 쓰므로 Internet Explorer는 지원하지 않습니다.
