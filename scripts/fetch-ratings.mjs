// data/places.json에 등록된 Place ID 목록을 기준으로
// Google Places API(New)에서 평점·리뷰수를 가져와 data/restaurants.json에 저장한다.
//
// 필요 환경변수: GOOGLE_MAPS_API_KEY
// 실행: node scripts/fetch-ratings.mjs

import { readFile, writeFile } from "node:fs/promises";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_INPUT = new URL("../data/places.json", import.meta.url);
const RESTAURANTS_OUTPUT = new URL("../data/restaurants.json", import.meta.url);

// Places API는 짧은 시간에 너무 많은 요청을 보내면 차단될 수 있어
// 항목 사이에 약간의 간격을 둔다.
const REQUEST_DELAY_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPlaceRating(placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "displayName,rating,userRatingCount"
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Place 조회 실패 (${res.status}): ${placeId} — ${body}`);
  }

  return res.json();
}

async function main() {
  if (!API_KEY) {
    console.error("GOOGLE_MAPS_API_KEY 환경변수가 설정되어 있지 않습니다.");
    process.exit(1);
  }

  const raw = await readFile(PLACES_INPUT, "utf-8");
  const { restaurants } = JSON.parse(raw);

  const targets = restaurants.filter(
    (r) => r.placeId && !r.placeId.startsWith("PLACE_ID_")
  );

  if (targets.length === 0) {
    console.warn(
      "data/places.json에 실제 Place ID가 하나도 없습니다. " +
      "플레이스홀더만 있는 상태라 갱신할 항목이 없어요."
    );
  }

  const results = [];
  const errors = [];

  for (const target of targets) {
    try {
      const place = await fetchPlaceRating(target.placeId);
      results.push({
        placeId: target.placeId,
        name: place.displayName?.text ?? "(이름 없음)",
        region: target.region,
        category: target.category,
        rating: typeof place.rating === "number" ? place.rating : null,
        reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : 0
      });
    } catch (err) {
      errors.push({ placeId: target.placeId, message: err.message });
      console.error(err.message);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const output = {
    updatedAt: new Date().toISOString(),
    count: results.length,
    errorCount: errors.length,
    restaurants: results
  };

  await writeFile(RESTAURANTS_OUTPUT, JSON.stringify(output, null, 2) + "\n", "utf-8");

  console.log(`완료: ${results.length}건 저장, 실패 ${errors.length}건`);

  // 평점 조회가 전부 실패했는데 대상은 있었다면 워크플로를 실패로 표시해
  // (예: 키 만료) 조용히 빈 파일로 덮어써지는 걸 방지한다.
  if (targets.length > 0 && results.length === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
