/* ============================================================
   로컬 PDF 변환기 — 오프라인 캐시 서비스 워커

   전략: 앱 껍데기와 vendor 라이브러리를 설치 시점에 전부 미리 받아두고(precache),
   이후 요청은 캐시 우선(cache-first)으로 응답한다.
   앱 자체가 네트워크를 쓰지 않으므로 한 번 설치되면 완전히 오프라인으로 돌아간다.

   캐시 이름의 버전을 올리면 activate 단계에서 옛 캐시를 지운다.
   vendor 라이브러리를 교체하거나 index.html을 고치면 버전을 올릴 것.
   ============================================================ */

var CACHE = "pdf-tool-v1";

// 상대경로로 적어 서브디렉터리(/sogeul-site/pdf/) 배포에서도 그대로 동작하게 한다
var PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./vendor/xlsx.full.min.js",
  "./vendor/jszip.min.js",
  "./vendor/pdf-lib.min.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // 하나라도 실패하면 설치 전체가 실패하므로 개별로 담고 실패는 넘긴다
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(new Request(url, { cache: "reload" })).catch(function () {
            return null;
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          return key === CACHE ? null : caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;

  // GET이 아니거나 다른 오리진이면 그대로 통과시킨다
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;

      return fetch(req).then(function (res) {
        // 정상 응답만 캐시에 넣는다
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // 오프라인인데 캐시에도 없는 문서 요청이면 앱 껍데기를 돌려준다
        if (req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "오프라인" });
      });
    })
  );
});
