// 맛집 순위 (html/matjip.html) 전용 스크립트
// data/restaurants.json이 있으면 실데이터, 없으면 목업 데이터로 화면을 그린다.
(function(){
  "use strict";

  function mulberry32(seed){
    return function(){
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260723);
  function pick(arr){ return arr[Math.floor(rand() * arr.length)]; }
  function randInt(min, max){ return Math.floor(rand() * (max - min + 1)) + min; }

  const REGIONS = [
    { id: "all", label: "전체" },
    { id: "seoul-seongdong", label: "서울 성동" },
    { id: "seoul-mapo", label: "서울 마포" },
    { id: "seoul-gangnam", label: "서울 강남" },
    { id: "gyeonggi", label: "경기" }
  ];

  const CATEGORIES = ["한식", "일식", "중식", "이탈리안", "분식", "카페", "고기구이", "국밥", "파스타", "베이커리"];
  const PREFIX = ["여주", "본가", "동네", "성수", "합정", "연희", "판교", "수원", "강남", "역삼", "골목", "터줏대감", "이모네", "삼촌네", "명동", "청춘"];
  const NOUN = ["피자", "국수", "냉면", "삼겹살", "칼국수", "돈까스", "만두", "김밥", "떡볶이", "우동", "라멘", "스테이크", "곱창", "짬뽕"];
  const SUFFIX = ["", "집", "식당", "본점", "강서점", "성수점", "마포점", "1호점"];

  function regionForIndex(i){
    const real = REGIONS.slice(1);
    return real[i % real.length].id;
  }

  function makeName(){
    return `${pick(PREFIX)}${pick(NOUN)}${pick(SUFFIX)}`;
  }

  function buildMockPool(){
    const pool = [];
    const TOTAL_GOOGLE = 480;
    for(let i=0;i<TOTAL_GOOGLE;i++){
      pool.push({
        name: makeName(),
        category: pick(CATEGORIES),
        region: regionForIndex(i),
        rating: (3.6 + rand() * 1.4).toFixed(2) * 1,
        reviewCount: randInt(8, 2400)
      });
    }
    return pool;
  }

  const fmt = new Intl.NumberFormat("ko-KR");
  const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

  let currentRegion = "all";
  let POOL = [];
  let dataSource = "loading"; // "live" | "mock" | "loading"
  let updatedAt = null;

  function serviceNoteText(){
    if(dataSource === "live"){
      const when = updatedAt ? dateFmt.format(new Date(updatedAt)) : "알 수 없음";
      return `구글 실데이터 기준 평점 순 정렬입니다. 매일 자동 갱신되며, 마지막 갱신: ${when}`;
    }
    if(dataSource === "mock"){
      return "실데이터 파일(data/restaurants.json)을 아직 찾지 못해 목업 데이터로 표시 중입니다. GitHub Actions가 한 번 이상 실행되면 자동으로 실데이터로 전환됩니다.";
    }
    return "데이터를 불러오는 중입니다…";
  }

  async function loadRestaurants(){
    try{
      // html/ 하위 페이지에서 호출하므로 저장소 루트의 data/를 상대경로로 거슬러 올라간다
      const res = await fetch("../data/restaurants.json", { cache: "no-store" });
      if(!res.ok) throw new Error("no data file");
      const json = await res.json();
      if(!Array.isArray(json.restaurants) || json.restaurants.length === 0){
        throw new Error("empty data file");
      }
      POOL = json.restaurants.filter(r => typeof r.rating === "number");
      updatedAt = json.updatedAt || null;
      dataSource = "live";
    }catch(err){
      POOL = buildMockPool();
      dataSource = "mock";
    }
    render();
  }

  function getList(){
    const filtered = currentRegion === "all" ? POOL : POOL.filter(r => r.region === currentRegion);
    const sorted = filtered.slice().sort((a, b) => {
      if(b.rating !== a.rating) return b.rating - a.rating;
      return b.reviewCount - a.reviewCount;
    });
    return sorted.slice(0, 100);
  }

  function regionLabel(id){
    const found = REGIONS.find(r => r.id === id);
    return found ? found.label : id;
  }

  function render(){
    document.getElementById("service-note").textContent = serviceNoteText();

    const list = getList();
    document.getElementById("result-label").textContent = regionLabel(currentRegion);
    document.getElementById("result-count").textContent = fmt.format(list.length);

    const ol = document.getElementById("rank-list");
    ol.innerHTML = "";

    if(list.length === 0){
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "해당 조건에 맞는 맛집이 아직 없어요. 다른 지역을 선택해보세요.";
      ol.appendChild(empty);
      return;
    }

    list.forEach((item, idx) => {
      const li = document.createElement("li");
      li.className = "rank-row";
      if(idx === 0) li.classList.add("tier-1");
      else if(idx === 1 || idx === 2) li.classList.add("tier-2");

      // 배지는 장식 — 순위는 아래 rank-name의 "N위." 텍스트로 읽힌다
      const badge = document.createElement("div");
      badge.className = "rank-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = String(idx + 1);

      const body = document.createElement("div");
      body.className = "rank-body";
      const name = document.createElement("p");
      name.className = "rank-name";
      name.textContent = `${idx + 1}위. ${item.name}`;
      const sub = document.createElement("div");
      sub.className = "rank-sub";
      const catTag = document.createElement("span");
      catTag.className = "tag category";
      catTag.textContent = item.category;
      const regionSpan = document.createElement("span");
      regionSpan.textContent = regionLabel(item.region);
      sub.appendChild(catTag);
      sub.appendChild(regionSpan);
      body.appendChild(name);
      body.appendChild(sub);

      const metric = document.createElement("div");
      metric.className = "rank-metric";
      const r = document.createElement("div");
      r.className = "metric-rating is-rating";
      r.textContent = item.rating.toFixed(2);
      const rc = document.createElement("div");
      rc.className = "metric-sub";
      rc.textContent = `리뷰 ${fmt.format(item.reviewCount)}개`;
      metric.appendChild(r);
      metric.appendChild(rc);

      li.appendChild(badge);
      li.appendChild(body);
      li.appendChild(metric);
      ol.appendChild(li);
    });
  }

  function renderRegionChips(){
    const wrap = document.getElementById("region-chips");
    wrap.innerHTML = "";
    REGIONS.forEach((r) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "region";
      input.value = r.id;
      input.checked = r.id === currentRegion;
      input.addEventListener("change", () => {
        currentRegion = r.id;
        render();
      });
      const span = document.createElement("span");
      span.textContent = r.label;
      label.appendChild(input);
      label.appendChild(span);
      wrap.appendChild(label);
    });
  }

  renderRegionChips();
  loadRestaurants();
})();
