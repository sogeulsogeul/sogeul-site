/* ============================================================
   오피스타임 (html/office.html)
   같은 팀 동료끼리 쓰는 가벼운 게임·챌린지 웹앱 — 프레임워크 없이 바닐라 JS.

   [구조]
   Store  : localStorage 원시 접근 (JSON 직렬화 + 예외 처리)
   Repo   : 도메인 단위 읽기/쓰기. 화면 코드는 Repo만 호출한다.
   render*: 화면별 HTML 문자열 생성 → setView()로 교체
   이벤트 : document에 위임(delegation). data-action 속성으로 분기.

   [중요한 한계 — localStorage]
   데이터가 "이 브라우저 안"에만 저장된다. 그래서 같은 그룹 코드를 입력해도
   다른 사람의 기기나 다른 브라우저에서는 그 팀을 찾지 못한다.
   즉 지금 구조는 "노트북 한 대를 돌려가며 쓰는 팀" 또는 1인 데모용이다.

   [실시간 동기화로 확장할 때]
   모든 데이터 접근이 아래 Repo 객체를 거치므로, Repo의 각 메서드를
   Firebase/Supabase 호출로 바꾸고 Promise를 반환하도록 만든 뒤
   렌더 호출부를 await 하도록 고치면 화면 코드는 거의 그대로 쓸 수 있다.
   (팀 = 문서 1개, 피드 = 서브컬렉션, 인증 = {code}_{challengeId} 컬렉션)
   ============================================================ */

(function () {
  "use strict";

  /* ==========================================================
     1. 저장소 어댑터
     ========================================================== */

  const KEY = {
    profile: "ow_profile",
    team: (code) => `ow_team_${code}`,
    feed: (code) => `ow_feed_${code}`,
    checkins: (code, challengeId) => `ow_checkins_${code}_${challengeId}`,
    balance: (code) => `ow_balance_${code}`
  };

  // 사파리 프라이빗 모드 등에서 저장이 막힐 수 있어 전부 감싼다.
  const Store = {
    read(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        /* 무시 */
      }
    },
    session(key, fallback) {
      try {
        const raw = sessionStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    sessionWrite(key, value) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* 무시 */
      }
    }
  };

  /* 도메인 계층 — 원격 DB로 옮길 때 여기만 바꾸면 된다 */
  const Repo = {
    getProfile() {
      return Store.read(KEY.profile, null);
    },
    saveProfile(profile) {
      return Store.write(KEY.profile, profile);
    },
    clearProfile() {
      Store.remove(KEY.profile);
    },

    getTeam(code) {
      return Store.read(KEY.team(code), null);
    },
    saveTeam(team) {
      return Store.write(KEY.team(team.code), team);
    },

    getFeed(code) {
      const feed = Store.read(KEY.feed(code), []);
      return Array.isArray(feed) ? feed : [];
    },
    addFeedItem(code, item) {
      const feed = Repo.getFeed(code);
      feed.unshift(item);
      Store.write(KEY.feed(code), feed.slice(0, 60)); // 보드가 무한히 길어지지 않게
    },

    getCheckins(code, challengeId) {
      const list = Store.read(KEY.checkins(code, challengeId), []);
      return Array.isArray(list) ? list : [];
    },
    addCheckin(code, challengeId, entry) {
      const list = Repo.getCheckins(code, challengeId);
      list.push(entry);
      Store.write(KEY.checkins(code, challengeId), list);
    },

    getBalanceVotes(code) {
      return Store.session(KEY.balance(code), {});
    },
    saveBalanceVotes(code, votes) {
      Store.sessionWrite(KEY.balance(code), votes);
    }
  };

  /* ==========================================================
     2. 고정 데이터
     ========================================================== */

  const CHALLENGES = [
    {
      id: "water",
      name: "물 2L 마시기",
      emoji: "💧",
      color: "teal",
      short: "하루 여덟 잔, 자리에서 일어날 핑계로도 좋아요.",
      detail:
        "텀블러 한 잔을 250ml로 보면 하루 여덟 잔입니다. 오전에 네 잔, 오후에 네 잔으로 나눠 마시면 부담이 덜해요."
    },
    {
      id: "stretch",
      name: "한 시간마다 스트레칭",
      emoji: "🤸",
      color: "lavender",
      short: "목·어깨·허리, 1분이면 충분해요.",
      detail:
        "알람을 한 시간 간격으로 맞춰두고, 울릴 때마다 자리에서 일어나 목을 좌우로 천천히 돌리고 어깨를 크게 두 바퀴 돌려보세요."
    },
    {
      id: "nocoffee",
      name: "오후 노커피",
      emoji: "☕",
      color: "coral",
      short: "2시 이후엔 카페인 대신 따뜻한 물로.",
      detail:
        "카페인은 몸에서 빠져나가는 데 대여섯 시간이 걸립니다. 오후 2시 이후로는 디카페인이나 보리차로 바꿔보세요."
    }
  ];

  const BALANCE_QUESTIONS = [
    {
      id: "q1",
      text: "평생 하나만 골라야 한다면?",
      a: "매주 점심 회식",
      b: "한 달에 한 번 저녁 회식"
    },
    {
      id: "q2",
      text: "둘 중 하나만 가능하다면?",
      a: "주 5일 완전 재택",
      b: "출근하되 매일 한 시간 일찍 퇴근"
    },
    {
      id: "q3",
      text: "그나마 견딜 만한 쪽은?",
      a: "월요일이 두 번 있는 한 주",
      b: "금요일이 사라진 한 주"
    }
  ];

  const BADGES = [
    { min: 0, emoji: "🪪", name: "신입 사원" },
    { min: 30, emoji: "🌱", name: "성실 사원" },
    { min: 60, emoji: "🔥", name: "열정 사원" },
    { min: 100, emoji: "🏆", name: "이달의 사원" },
    { min: 200, emoji: "👑", name: "오피스 레전드" }
  ];

  const RECOMMENDATIONS = [
    {
      tag: "오늘의 추천",
      title: "점심값 내기, 사다리로 정하기",
      desc: "가위바위보보다 뒤끝 없어요. 참가자를 고르고 항목만 적으면 끝.",
      cta: "사다리타기 하러 가기",
      route: "#/games/ladder"
    },
    {
      tag: "오늘의 추천",
      title: "오늘 뭐 먹지? 룰렛에 맡기기",
      desc: "메뉴 정하다 점심시간 다 보내지 말고, 휠 한 번 돌려보세요.",
      cta: "메뉴 룰렛 돌리기",
      route: "#/games/roulette"
    },
    {
      tag: "오늘의 추천",
      title: "회의 전 아이스브레이킹",
      desc: "밸런스 게임 세 문항이면 분위기가 금방 풀려요.",
      cta: "밸런스 게임 하기",
      route: "#/games/balance"
    },
    {
      tag: "오늘의 추천",
      title: "물 마시는 것도 팀플레이",
      desc: "혼자면 까먹지만 같이 하면 챙기게 돼요. 인증하면 10포인트.",
      cta: "챌린지 보러 가기",
      route: "#/challenge"
    }
  ];

  const LADDER_DEFAULT_ITEMS = ["커피 쏘기", "통과", "통과"];
  const ROULETTE_DEFAULT_MENUS = ["김치찌개", "돈까스", "국밥", "샐러드", "짜장면", "초밥"];

  const NOTE_COLORS = ["coral", "teal", "amber", "lavender"];
  const NOTE_TILTS = [-2.4, 1.8, -1.2, 2.6, -3, 1.2];
  const TRACE_COLORS = [
    "#C42D0B", "#0E7050", "#514FC4", "#FF5A36",
    "#158F68", "#7A78E0", "#1B1D18", "#8A5A00"
  ];
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0/O/1/I 제외

  /* ==========================================================
     3. 유틸
     ========================================================== */

  const $ = (sel, root) => (root || document).querySelector(sel);

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function makeCode() {
    let out = "";
    for (let i = 0; i < 5; i++) {
      out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return out;
  }

  function todayKey(date) {
    const d = date || new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const diff = Math.floor((Date.now() - then) / 1000);
    if (diff < 60) return "방금";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(then);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // 스크린리더에 짧은 상태 변화를 알린다 (복사됨, 인증 완료 등)
  function announce(message) {
    const live = $("#live");
    if (!live) return;
    live.textContent = "";
    window.setTimeout(() => { live.textContent = message; }, 60);
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ==========================================================
     4. 앱 상태
     ========================================================== */

  const state = {
    profile: null,   // { id, nickname, code }
    team: null,      // { code, name, createdAt, members: [...] }
    route: [],       // ['games','ladder']
    firstRender: true,
    ladder: null,    // { members:[id], items:[string], result:null }
    roulette: null,  // { menus:[string], rotation:number, spinning:bool, last:string }
    modalOnClose: null
  };

  function me() {
    if (!state.team || !state.profile) return null;
    return state.team.members.find((m) => m.id === state.profile.id) || null;
  }

  function sortedMembers() {
    if (!state.team) return [];
    return state.team.members.slice().sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.nickname.localeCompare(b.nickname, "ko");
    });
  }

  function addFeed(type, title, body) {
    if (!state.team || !state.profile) return;
    const feed = Repo.getFeed(state.team.code);
    const index = feed.length;
    Repo.addFeedItem(state.team.code, {
      id: uid("f"),
      type: type,
      title: title,
      body: body,
      author: state.profile.nickname,
      // 색과 기울기를 만들 때 한 번 정해 저장한다 — 다시 그릴 때 값이 튀지 않게
      color: NOTE_COLORS[index % NOTE_COLORS.length],
      tilt: NOTE_TILTS[index % NOTE_TILTS.length],
      createdAt: new Date().toISOString()
    });
  }

  /* ==========================================================
     5. 모달
     ========================================================== */

  function openModal(title, bodyHtml, actions, onClose) {
    const dialog = $("#modal");
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = bodyHtml;
    $("#modal-actions").innerHTML = (actions || [{ label: "닫기", kind: "btn" }])
      .map((a) => `<button type="button" class="btn ${a.kind || ""}" data-action="${esc(a.action || "modal-close")}">${esc(a.label)}</button>`)
      .join("");
    state.modalOnClose = onClose || null;
    if (typeof dialog.showModal === "function") {
      dialog.showModal(); // Esc 닫기·포커스 트랩·배경 비활성화가 네이티브로 따라온다
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeModal() {
    const dialog = $("#modal");
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  /* ==========================================================
     6. 온보딩
     ========================================================== */

  function renderOnboarding() {
    return `
      <div class="onboard">
        <div class="onboard-hero">
          <span class="brand-mark" aria-hidden="true">OT</span>
          <h1 class="page-title">오피스타임</h1>
          <p class="page-lede" style="margin-inline:auto">
            같은 팀 동료끼리 점심 내기, 메뉴 정하기, 소소한 챌린지를 함께 하는 공간이에요.
          </p>
        </div>

        <form class="card" data-action="onboard" novalidate>
          <p class="form-error" id="ob-error" role="alert"></p>

          <div class="field">
            <label for="ob-nick">닉네임</label>
            <input type="text" id="ob-nick" name="nickname" maxlength="12"
                   autocomplete="nickname" placeholder="예: 김대리" required>
            <p class="field-hint">팀 피드와 랭킹에 표시될 이름이에요. 최대 12자.</p>
          </div>

          <fieldset>
            <legend>어떻게 시작할까요?</legend>
            <div class="chip-group">
              <label class="chip">
                <input type="radio" name="mode" value="join" checked>
                <span>그룹 코드로 합류</span>
              </label>
              <label class="chip">
                <input type="radio" name="mode" value="create">
                <span>새 팀 만들기</span>
              </label>
            </div>
          </fieldset>

          <div class="field" id="ob-join-field">
            <label for="ob-code">그룹 코드</label>
            <input type="text" id="ob-code" name="code" class="code-input"
                   maxlength="5" autocomplete="off" autocapitalize="characters"
                   spellcheck="false" placeholder="ABC23">
            <p class="field-hint">팀을 만든 사람에게 받은 5자리 코드를 입력하세요.</p>
          </div>

          <div class="field" id="ob-create-field" hidden>
            <label for="ob-team">팀 이름</label>
            <input type="text" id="ob-team" name="teamName" maxlength="20" placeholder="예: 마케팅 2팀">
            <p class="field-hint">팀을 만들면 5자리 그룹 코드가 자동으로 생겨요.</p>
          </div>

          <button type="submit" class="btn btn-primary">시작하기</button>
        </form>

        <p class="notice" style="margin-top:24px">
          <b>알아두세요.</b>
          팀 정보는 지금 쓰는 브라우저 안에만 저장돼요. 그래서 같은 그룹 코드를 넣어도
          <b>다른 기기나 다른 브라우저에서는 팀을 찾지 못합니다.</b>
          한 대의 노트북을 돌려가며 쓰거나 혼자 둘러볼 때 알맞아요.
        </p>
      </div>
    `;
  }

  function handleOnboard(form) {
    const errorBox = $("#ob-error");
    const nickname = form.nickname.value.trim();
    const mode = form.querySelector('input[name="mode"]:checked').value;

    if (!nickname) {
      errorBox.textContent = "닉네임을 입력해 주세요.";
      form.nickname.focus();
      return;
    }

    let team;

    if (mode === "create") {
      const teamName = form.teamName.value.trim();
      if (!teamName) {
        errorBox.textContent = "팀 이름을 입력해 주세요.";
        $("#ob-team").focus();
        return;
      }
      // 이미 쓰는 코드가 나오면 다시 뽑는다
      let code = makeCode();
      let guard = 0;
      while (Repo.getTeam(code) && guard < 30) {
        code = makeCode();
        guard += 1;
      }
      team = { code: code, name: teamName, createdAt: new Date().toISOString(), members: [] };
    } else {
      const code = form.code.value.trim().toUpperCase();
      if (code.length !== 5) {
        errorBox.textContent = "그룹 코드는 5자리예요.";
        $("#ob-code").focus();
        return;
      }
      team = Repo.getTeam(code);
      if (!team) {
        errorBox.innerHTML =
          "이 브라우저에는 <b>" + esc(code) + "</b> 팀이 없어요. " +
          "팀 데이터는 브라우저마다 따로 저장돼서, 다른 기기에서 만든 팀은 여기서 찾을 수 없습니다. " +
          "직접 새 팀을 만들어 보세요.";
        $("#ob-code").focus();
        return;
      }
    }

    const profile = { id: uid("m"), nickname: nickname, code: team.code };
    team.members.push({
      id: profile.id,
      nickname: nickname,
      points: 0,
      joinedAt: new Date().toISOString()
    });

    if (!Repo.saveTeam(team) || !Repo.saveProfile(profile)) {
      errorBox.textContent =
        "브라우저 저장 공간에 쓸 수 없어요. 시크릿 모드라면 일반 창에서 다시 시도해 주세요.";
      return;
    }

    state.profile = profile;
    state.team = team;

    if (mode === "create") {
      addFeed("system", `${team.name} 팀이 열렸어요`, `그룹 코드는 ${team.code} 입니다.`);
    } else {
      addFeed("system", `${nickname}님이 합류했어요`, "반갑습니다!");
    }

    location.hash = "#/home";
    render();
  }

  /* ==========================================================
     7. 공통 조각
     ========================================================== */

  function noteHtml(item) {
    const kind = {
      ladder: "사다리타기", roulette: "메뉴 룰렛",
      challenge: "챌린지", system: "공지"
    }[item.type] || "기록";

    return `
      <li>
        <article class="note c-${esc(item.color)}" style="--tilt:${Number(item.tilt) || 0}deg">
          <span class="note-kind">${esc(kind)}</span>
          <h3 class="note-title">${esc(item.title)}</h3>
          ${item.body ? `<p class="note-body">${esc(item.body)}</p>` : ""}
          <p class="note-foot">${esc(item.author)} · <time datetime="${esc(item.createdAt)}">${esc(timeAgo(item.createdAt))}</time></p>
        </article>
      </li>
    `;
  }

  function feedBoardHtml(limit) {
    const feed = Repo.getFeed(state.team.code).slice(0, limit || 60);
    if (feed.length === 0) {
      return `<div class="board"><p class="empty">아직 보드가 비어 있어요. 게임을 한 판 돌리고 결과를 공유해 보세요.</p></div>`;
    }
    return `<div class="board"><ul class="note-list">${feed.map(noteHtml).join("")}</ul></div>`;
  }

  function rankListHtml(rows, unit, limit) {
    const list = rows.slice(0, limit || rows.length);
    if (list.length === 0) {
      return `<p class="empty card">아직 기록이 없어요.</p>`;
    }
    return `
      <ol class="rank-list">
        ${list.map((row, i) => `
          <li${row.id === (state.profile && state.profile.id) ? ' class="is-me"' : ""}>
            <span class="rank-no ${i < 3 ? "t" + (i + 1) : ""}">${i + 1}</span>
            <span class="rank-name">${esc(row.nickname)}${
              row.id === (state.profile && state.profile.id)
                ? '<span class="me-tag">나</span>' : ""
            }</span>
            <span class="rank-score">${row.score}<span class="tiny"> ${esc(unit)}</span></span>
          </li>
        `).join("")}
      </ol>
    `;
  }

  /* ==========================================================
     8. 홈
     ========================================================== */

  function renderHome() {
    // 날짜 기준으로 추천을 돌린다 — 하루 동안은 같은 추천이 보인다
    const dayIndex = Math.floor(Date.now() / 86400000) % RECOMMENDATIONS.length;
    const rec = RECOMMENDATIONS[dayIndex];
    const ranking = sortedMembers().map((m) => ({ id: m.id, nickname: m.nickname, score: m.points }));

    return `
      <h1 class="page-title">안녕하세요, ${esc(state.profile.nickname)}님</h1>
      <p class="page-lede">${esc(state.team.name)} · 오늘도 무사히.</p>

      <section class="banner" aria-labelledby="rec-title">
        <span class="banner-tag">${esc(rec.tag)}</span>
        <h2 class="banner-title" id="rec-title">${esc(rec.title)}</h2>
        <p class="banner-desc">${esc(rec.desc)}</p>
        <a class="btn" href="${esc(rec.route)}">${esc(rec.cta)}</a>
      </section>

      <section class="section" aria-labelledby="quick-title">
        <div class="section-head"><h2 class="section-title" id="quick-title">빠른 실행</h2></div>
        <div class="quick-grid">
          <a class="quick" href="#/games/ladder">
            <span class="quick-ico c1" aria-hidden="true">🪜</span>
            <span class="quick-name">사다리타기</span>
            <p class="quick-desc">참가자와 항목을 정하고 한 번에 매칭</p>
          </a>
          <a class="quick" href="#/games/roulette">
            <span class="quick-ico c2" aria-hidden="true">🍽️</span>
            <span class="quick-name">메뉴 룰렛</span>
            <p class="quick-desc">오늘 점심, 휠에 맡기기</p>
          </a>
          <a class="quick" href="#/games/balance">
            <span class="quick-ico c3" aria-hidden="true">⚖️</span>
            <span class="quick-name">밸런스 게임</span>
            <p class="quick-desc">회의 전 5분 아이스브레이킹</p>
          </a>
        </div>
      </section>

      <section class="section" aria-labelledby="feed-title">
        <div class="section-head">
          <h2 class="section-title" id="feed-title">팀 피드</h2>
          <p class="section-note">게임 결과와 챌린지 인증이 여기에 붙어요</p>
        </div>
        ${feedBoardHtml(8)}
      </section>

      <section class="section" aria-labelledby="rank-title">
        <div class="section-head">
          <h2 class="section-title" id="rank-title">팀 랭킹 TOP 3</h2>
          <p class="section-note"><a href="#/team">전체 보기</a></p>
        </div>
        ${rankListHtml(ranking, "P", 3)}
      </section>
    `;
  }

  /* ==========================================================
     9. 게임 목록
     ========================================================== */

  function renderGames() {
    return `
      <h1 class="page-title">게임</h1>
      <p class="page-lede">정하기 어려운 건 게임으로. 결과는 팀 피드에 남길 수 있어요.</p>

      <div class="game-grid">
        <a class="ch-card" href="#/games/ladder">
          <span class="ch-ico coral" aria-hidden="true">🪜</span>
          <span class="ch-name">사다리타기</span>
          <p class="ch-desc">참가자를 고르고 항목을 적으면 랜덤으로 짝을 지어줘요. 실제 사다리를 그려서 경로까지 보여줍니다.</p>
        </a>
        <a class="ch-card" href="#/games/roulette">
          <span class="ch-ico teal" aria-hidden="true">🍽️</span>
          <span class="ch-name">메뉴 룰렛</span>
          <p class="ch-desc">후보 메뉴를 넣고 휠을 돌리세요. 메뉴는 자유롭게 고칠 수 있어요.</p>
        </a>
        <a class="ch-card" href="#/games/balance">
          <span class="ch-ico lavender" aria-hidden="true">⚖️</span>
          <span class="ch-name">밸런스 게임</span>
          <p class="ch-desc">직장인용 질문 세 개. 투표하면 비율 막대로 결과를 보여줘요.</p>
        </a>
      </div>
    `;
  }

  /* ==========================================================
     10. 사다리타기
     ========================================================== */

  function ensureLadderState() {
    if (!state.ladder) {
      state.ladder = { members: [], items: LADDER_DEFAULT_ITEMS.slice(), result: null };
    }
    // 팀에서 빠진 멤버가 선택 목록에 남지 않도록 정리
    const ids = state.team.members.map((m) => m.id);
    state.ladder.members = state.ladder.members.filter((id) => ids.includes(id));
    return state.ladder;
  }

  function renderLadder() {
    const L = ensureLadderState();
    const picked = L.members.length;
    const items = L.items.length;
    const ready = picked >= 2 && picked === items;

    const countHint = picked < 2
      ? `<span class="no">참가자를 2명 이상 선택해 주세요. (지금 ${picked}명)</span>`
      : picked === items
        ? `<span class="ok">참가자 ${picked}명 · 항목 ${items}개 — 준비 완료</span>`
        : `<span class="no">참가자 ${picked}명 · 항목 ${items}개 — 항목을 ${
            picked > items ? `${picked - items}개 더 추가` : `${items - picked}개 삭제`
          }해 주세요.</span>`;

    return `
      <p class="tiny"><a href="#/games">← 게임 목록</a></p>
      <h1 class="page-title">사다리타기</h1>
      <p class="page-lede">참가자와 항목 수를 똑같이 맞춘 뒤 실행하세요.</p>

      <div class="split">
        <section class="card" aria-labelledby="ld-mem">
          <h2 class="section-title" id="ld-mem" style="margin-bottom:16px">참가자 고르기</h2>
          ${state.team.members.length < 2 ? `
            <p class="notice" style="margin-bottom:16px">
              <b>팀원이 한 명뿐이에요.</b>
              사다리를 타려면 2명 이상 필요합니다. <a href="#/team">우리팀</a>에서 함께할 사람을 먼저 추가해 주세요.
            </p>` : ""}
          <fieldset>
            <legend class="visually-hidden">참가자 선택</legend>
            <div class="chip-group">
              ${state.team.members.map((m) => `
                <label class="chip">
                  <input type="checkbox" data-action="ladder-toggle" value="${esc(m.id)}"
                         ${L.members.includes(m.id) ? "checked" : ""}>
                  <span>${esc(m.nickname)}</span>
                </label>
              `).join("")}
            </div>
          </fieldset>
        </section>

        <section class="card" aria-labelledby="ld-item">
          <h2 class="section-title" id="ld-item" style="margin-bottom:16px">항목 (메뉴·벌칙)</h2>
          <ul class="edit-list">
            ${L.items.map((it, i) => `
              <li>
                <span class="item-idx" aria-hidden="true">${i + 1}</span>
                <span class="item-name">${esc(it)}</span>
                <button type="button" class="icon-btn" data-action="ladder-del-item" data-index="${i}"
                        aria-label="${esc(it)} 항목 삭제">✕</button>
              </li>
            `).join("")}
          </ul>
          ${L.items.length === 0 ? `<p class="empty tiny">항목을 추가해 주세요.</p>` : ""}
          <form class="inline-form" data-action="ladder-add-item">
            <label class="visually-hidden" for="ld-new">추가할 항목</label>
            <input type="text" id="ld-new" name="item" maxlength="14" placeholder="예: 커피 쏘기">
            <button type="submit" class="btn btn-sm">추가</button>
          </form>
        </section>
      </div>

      <div style="margin-top:24px">
        <p class="count-hint" id="ld-hint">${countHint}</p>
        <p class="form-error" id="ld-error" role="alert"></p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-action="ladder-run" id="ld-run">사다리 실행</button>
          ${L.result ? `<button type="button" class="btn" data-action="ladder-share">팀 피드에 공유</button>` : ""}
        </div>
        <div id="ld-stage" class="ladder-stage">${L.result ? ladderStageHtml(L.result) : ""}</div>
      </div>
    `;
  }

  /* 실제 사다리를 만든다: 세로줄 n개 + 가로 가로대(rung)를 무작위로 놓고 경로를 추적 */
  function buildLadder(n) {
    const rows = n * 2 + 2;
    const rungs = [];
    for (let r = 0; r < rows; r++) {
      const row = new Array(n - 1).fill(false);
      let prev = false;
      for (let c = 0; c < n - 1; c++) {
        // 같은 높이에서 가로대가 연달아 붙으면 경로가 애매해지므로 한 칸 띄운다
        const put = !prev && Math.random() < 0.42;
        row[c] = put;
        prev = put;
      }
      rungs.push(row);
    }

    const COL = 80;
    const ROW = 36;
    const PAD = 20;
    const W = n * COL;
    const H = PAD * 2 + (rows - 1) * ROW;
    const colX = (c) => c * COL + COL / 2;
    const rowY = (r) => PAD + r * ROW;

    const paths = [];
    for (let start = 0; start < n; start++) {
      let c = start;
      const pts = [[colX(c), 0]];
      for (let r = 0; r < rows; r++) {
        const y = rowY(r);
        if (rungs[r][c]) {
          pts.push([colX(c), y]); c += 1; pts.push([colX(c), y]);
        } else if (c > 0 && rungs[r][c - 1]) {
          pts.push([colX(c), y]); c -= 1; pts.push([colX(c), y]);
        }
      }
      pts.push([colX(c), H]);
      paths.push({ start: start, end: c, pts: pts });
    }

    return { n, rows, rungs, W, H, COL, ROW, PAD, colX, rowY, paths };
  }

  function ladderStageHtml(result) {
    const g = result.geom;
    const cols = `grid-template-columns:repeat(${g.n},minmax(0,1fr))`;

    const gridLines = [];
    for (let c = 0; c < g.n; c++) {
      gridLines.push(`<line class="grid-line" x1="${g.colX(c)}" y1="0" x2="${g.colX(c)}" y2="${g.H}"/>`);
    }
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.n - 1; c++) {
        if (g.rungs[r][c]) {
          gridLines.push(`<line class="grid-line" x1="${g.colX(c)}" y1="${g.rowY(r)}" x2="${g.colX(c + 1)}" y2="${g.rowY(r)}"/>`);
        }
      }
    }

    const traces = g.paths.map((p, i) => {
      const d = "M " + p.pts.map((pt) => pt[0] + " " + pt[1]).join(" L ");
      return `<path class="trace" data-trace="${i}" d="${d}" stroke="${TRACE_COLORS[i % TRACE_COLORS.length]}"/>`;
    }).join("");

    return `
      <div class="card">
        <ul class="ladder-cols" style="list-style:none;margin:0;padding:0;${cols}">
          ${result.names.map((nm, i) => `<li class="ladder-cap"><span class="visually-hidden">참가자 </span>${esc(nm)}</li>`).join("")}
        </ul>

        <svg class="ladder-svg" viewBox="0 0 ${g.W} ${g.H}" role="img"
             aria-label="사다리 그림. 결과는 아래 목록에 글로 정리되어 있습니다.">
          ${gridLines.join("")}
          ${traces}
        </svg>

        <ul class="ladder-cols bottom" style="list-style:none;margin:8px 0 0;padding:0;${cols}">
          ${result.slots.map((it) => `<li class="ladder-cap"><span class="visually-hidden">항목 </span>${esc(it)}</li>`).join("")}
        </ul>

        <h3 class="section-title" style="margin:24px 0 8px">결과</h3>
        <ul class="result-list" id="ld-result" ${result.revealed ? "" : 'hidden'}>
          ${result.pairs.map((p, i) => `
            <li>
              <span class="swatch" aria-hidden="true" style="background:${TRACE_COLORS[i % TRACE_COLORS.length]}"></span>
              <span>${esc(p.name)}</span>
              <span class="result-arrow" aria-hidden="true">→</span>
              <span class="result-to">${esc(p.item)}</span>
            </li>
          `).join("")}
        </ul>
        <p class="tiny muted" id="ld-running" ${result.revealed ? 'hidden' : ""}>사다리를 타는 중…</p>
      </div>
    `;
  }

  function runLadder() {
    const L = ensureLadderState();
    const errorBox = $("#ld-error");
    errorBox.textContent = "";

    if (L.members.length < 2) {
      errorBox.textContent = "참가자를 2명 이상 선택해 주세요.";
      return;
    }
    if (L.members.length !== L.items.length) {
      errorBox.textContent = `참가자 ${L.members.length}명과 항목 ${L.items.length}개의 수가 달라요. 수를 맞춰 주세요.`;
      return;
    }

    const names = L.members.map((id) => {
      const m = state.team.members.find((x) => x.id === id);
      return m ? m.nickname : "알 수 없음";
    });
    const slots = shuffleInPlace(L.items.slice());
    const geom = buildLadder(names.length);

    L.result = {
      geom: geom,
      names: names,
      slots: slots,
      pairs: geom.paths.map((p, i) => ({ name: names[i], item: slots[p.end] })),
      revealed: false
    };

    // 전체를 다시 그리면 방금 누른 버튼의 포커스를 잃으므로 결과 영역만 갈아끼운다
    const stage = $("#ld-stage");
    if (!stage) return;
    stage.innerHTML = ladderStageHtml(L.result);

    // 결과가 처음 나왔다면 공유 버튼을 옆에 붙여준다
    if (!document.querySelector('[data-action="ladder-share"]')) {
      const row = document.getElementById("ld-run");
      if (row && row.parentElement) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        btn.dataset.action = "ladder-share";
        btn.textContent = "팀 피드에 공유";
        row.parentElement.appendChild(btn);
      }
    }

    const reduce = prefersReducedMotion();
    const traces = stage.querySelectorAll(".trace");

    traces.forEach((path) => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = reduce ? 0 : len;
    });

    if (!reduce) {
      // 다음 프레임에 offset을 0으로 바꿔야 transition이 걸린다
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          traces.forEach((path) => { path.style.strokeDashoffset = 0; });
        });
      });
    }

    window.setTimeout(() => {
      L.result.revealed = true;
      const list = $("#ld-result");
      const running = $("#ld-running");
      if (list) list.hidden = false;
      if (running) running.hidden = true;
      announce("사다리타기 결과가 나왔어요. " + L.result.pairs.map((p) => `${p.name}은 ${p.item}`).join(", "));
    }, reduce ? 0 : 1500);
  }

  function shareLadder() {
    const L = state.ladder;
    if (!L || !L.result) return;
    const body = L.result.pairs.map((p) => `${p.name} → ${p.item}`).join(" / ");
    addFeed("ladder", "사다리타기 결과", body);
    announce("팀 피드에 공유했어요.");
    openModal("공유했어요", "<p>팀 피드에 결과를 붙였어요.</p>", [
      { label: "피드 보러 가기", kind: "btn-primary", action: "go-home" },
      { label: "닫기" }
    ]);
  }

  /* ==========================================================
     11. 메뉴 룰렛
     ========================================================== */

  function ensureRouletteState() {
    if (!state.roulette) {
      state.roulette = {
        menus: ROULETTE_DEFAULT_MENUS.slice(),
        rotation: 0,
        spinning: false,
        last: null
      };
    }
    return state.roulette;
  }

  function wheelHtml(menus, rotation) {
    const n = menus.length;
    const slice = 360 / n;
    const colors = ["var(--wheel-1)", "var(--wheel-2)", "var(--wheel-3)", "var(--wheel-4)"];

    const stops = menus.map((_, i) => {
      // 조각 수가 4의 배수+1이면 첫/마지막 색이 붙으므로 한 칸 밀어준다
      let ci = i % 4;
      if (i === n - 1 && ci === 0 && n > 1) ci = 2;
      return `${colors[ci]} ${(i * slice).toFixed(3)}deg ${((i + 1) * slice).toFixed(3)}deg`;
    }).join(",");

    const labels = menus.map((m, i) => {
      const mid = (i + 0.5) * slice;
      // 회전 → 바깥으로 이동 → 다시 반대로 회전해서 글자는 늘 수평
      const t = `rotate(${mid.toFixed(3)}deg) translate(0, -33%) rotate(${(-mid).toFixed(3)}deg) translate(-50%, -50%)`;
      return `<span class="wheel-label" style="transform:${t}">${esc(m)}</span>`;
    }).join("");

    return `
      <div class="wheel-wrap">
        <div class="wheel-pin" aria-hidden="true"></div>
        <div class="wheel" id="wheel" aria-hidden="true"
             style="background:conic-gradient(${stops});transform:rotate(${rotation}deg)">
          ${labels}
        </div>
        <span class="wheel-hub" aria-hidden="true">오늘<br>뭐먹지</span>
      </div>
    `;
  }

  function renderRoulette() {
    const R = ensureRouletteState();

    return `
      <p class="tiny"><a href="#/games">← 게임 목록</a></p>
      <h1 class="page-title">메뉴 룰렛</h1>
      <p class="page-lede">후보를 넣고 휠을 돌리세요. 결과는 팀 피드에 남길 수 있어요.</p>

      <div class="split">
        <section aria-labelledby="rl-wheel">
          <h2 class="visually-hidden" id="rl-wheel">룰렛 휠</h2>
          ${R.menus.length >= 2
            ? wheelHtml(R.menus, R.rotation)
            : `<p class="empty card">메뉴를 2개 이상 넣어야 휠이 돌아가요.</p>`}

          <div class="btn-row" style="justify-content:center">
            <button type="button" class="btn btn-primary" data-action="roulette-spin"
                    id="rl-spin" ${R.menus.length < 2 ? "disabled" : ""}>돌리기</button>
            ${R.last ? `<button type="button" class="btn" data-action="roulette-share">팀 피드에 공유</button>` : ""}
          </div>

          <div id="rl-out" aria-live="polite">
            ${R.last ? `
              <div class="big-result" style="margin-top:24px">
                <p class="label">오늘의 메뉴</p>
                <p class="value">${esc(R.last)}</p>
              </div>` : ""}
          </div>
        </section>

        <section class="card" aria-labelledby="rl-menu">
          <h2 class="section-title" id="rl-menu" style="margin-bottom:16px">메뉴 편집</h2>
          <ul class="edit-list">
            ${R.menus.map((m, i) => `
              <li>
                <span class="item-idx" aria-hidden="true">${i + 1}</span>
                <span class="item-name">${esc(m)}</span>
                <button type="button" class="icon-btn" data-action="roulette-del" data-index="${i}"
                        aria-label="${esc(m)} 메뉴 삭제">✕</button>
              </li>
            `).join("")}
          </ul>
          <form class="inline-form" data-action="roulette-add">
            <label class="visually-hidden" for="rl-new">추가할 메뉴</label>
            <input type="text" id="rl-new" name="menu" maxlength="10" placeholder="예: 마라탕">
            <button type="submit" class="btn btn-sm">추가</button>
          </form>
          <p class="field-hint" style="margin-top:8px">최대 8개까지 넣을 수 있어요. 이름은 10자 이내를 권해요.</p>
        </section>
      </div>
    `;
  }

  function spinRoulette() {
    const R = ensureRouletteState();
    if (R.spinning || R.menus.length < 2) return;

    const wheel = $("#wheel");
    const spinBtn = $("#rl-spin");
    if (!wheel) return;

    const n = R.menus.length;
    const slice = 360 / n;
    const winner = Math.floor(Math.random() * n);

    // 당첨 조각의 한가운데가 위쪽 바늘에 오도록 최종 각도를 역산한다
    const want = (360 - (winner + 0.5) * slice) % 360;
    const curMod = ((R.rotation % 360) + 360) % 360;
    let delta = want - curMod;
    if (delta < 0) delta += 360;

    const reduce = prefersReducedMotion();
    const turns = reduce ? 0 : 5;
    R.rotation = R.rotation + turns * 360 + delta;
    R.spinning = true;
    if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = "돌리는 중…"; }

    wheel.style.transform = `rotate(${R.rotation}deg)`;

    const duration = reduce ? 0 : 4000;
    window.setTimeout(() => {
      R.spinning = false;
      R.last = R.menus[winner];
      const out = $("#rl-out");
      if (out) {
        out.innerHTML = `
          <div class="big-result" style="margin-top:24px">
            <p class="label">오늘의 메뉴</p>
            <p class="value">${esc(R.last)}</p>
          </div>`;
      }
      if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = "다시 돌리기"; }
      // 공유 버튼이 아직 없으면 그려준다
      if (!document.querySelector('[data-action="roulette-share"]')) {
        const row = spinBtn && spinBtn.parentElement;
        if (row) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn";
          btn.dataset.action = "roulette-share";
          btn.textContent = "팀 피드에 공유";
          row.appendChild(btn);
        }
      }
    }, duration + 80);
  }

  function shareRoulette() {
    const R = state.roulette;
    if (!R || !R.last) return;
    addFeed("roulette", `오늘 점심은 ${R.last}!`, `후보 ${R.menus.length}개 중에서 뽑혔어요.`);
    announce("팀 피드에 공유했어요.");
    openModal("공유했어요", "<p>팀 피드에 결과를 붙였어요.</p>", [
      { label: "피드 보러 가기", kind: "btn-primary", action: "go-home" },
      { label: "닫기" }
    ]);
  }

  /* ==========================================================
     12. 밸런스 게임
     ========================================================== */

  function renderBalance() {
    const votes = Repo.getBalanceVotes(state.team.code);

    return `
      <p class="tiny"><a href="#/games">← 게임 목록</a></p>
      <h1 class="page-title">밸런스 게임</h1>
      <p class="page-lede">노트북 하나를 돌려가며 투표해 보세요. 표는 이 탭을 닫으면 사라지는 <b>세션 한정</b>이에요.</p>

      ${BALANCE_QUESTIONS.map((q) => {
        const v = votes[q.id] || { a: 0, b: 0 };
        const total = v.a + v.b;
        const pa = total ? Math.round((v.a / total) * 100) : 0;
        const pb = total ? 100 - pa : 0;

        return `
          <section class="card balance-q" aria-labelledby="bq-${esc(q.id)}">
            <h2 class="section-title" id="bq-${esc(q.id)}" style="font-size:24px;margin:0 0 16px">${esc(q.text)}</h2>
            <div class="balance-opts">
              <button type="button" class="balance-btn a" data-action="balance-vote" data-q="${esc(q.id)}" data-opt="a">A. ${esc(q.a)}</button>
              <button type="button" class="balance-btn b" data-action="balance-vote" data-q="${esc(q.id)}" data-opt="b">B. ${esc(q.b)}</button>
            </div>

            ${total > 0 ? `
              <div class="bar-row">
                <p class="bar-head"><span>A ${pa}%</span><span>${pb}% B</span></p>
                <div class="bar" role="img"
                     aria-label="A ${esc(q.a)} ${v.a}표(${pa} 퍼센트), B ${esc(q.b)} ${v.b}표(${pb} 퍼센트)">
                  <span class="seg a" style="width:${pa}%"></span>
                  <span class="seg b" style="width:${pb}%"></span>
                </div>
                <p class="bar-legend">
                  <span>A ${esc(q.a)} — ${v.a}표</span>
                  <span>B ${esc(q.b)} — ${v.b}표</span>
                </p>
              </div>` : `<p class="field-hint" style="margin-top:16px">아직 표가 없어요. 먼저 골라보세요.</p>`}
          </section>
        `;
      }).join("")}

      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-action="balance-reset">투표 초기화</button>
      </div>
    `;
  }

  function voteBalance(qid, opt) {
    const votes = Repo.getBalanceVotes(state.team.code);
    if (!votes[qid]) votes[qid] = { a: 0, b: 0 };
    votes[qid][opt] += 1;
    Repo.saveBalanceVotes(state.team.code, votes);

    const q = BALANCE_QUESTIONS.find((x) => x.id === qid);
    render({ keepFocus: true });
    announce(`${opt === "a" ? "A" : "B"} ${q ? q[opt] : ""}에 투표했어요.`);
    // 다시 그려진 같은 자리의 버튼으로 포커스를 돌려준다
    const again = document.querySelector(`[data-action="balance-vote"][data-q="${qid}"][data-opt="${opt}"]`);
    if (again) again.focus();
  }

  /* ==========================================================
     13. 챌린지
     ========================================================== */

  function challengeStats(challengeId) {
    const list = Repo.getCheckins(state.team.code, challengeId);
    const today = todayKey();
    const counts = {};
    let todayCount = 0;

    list.forEach((entry) => {
      counts[entry.memberId] = (counts[entry.memberId] || 0) + 1;
      if (entry.date === today) todayCount += 1;
    });

    const doneToday = list.some(
      (e) => e.date === today && state.profile && e.memberId === state.profile.id
    );

    const ranking = state.team.members
      .map((m) => ({ id: m.id, nickname: m.nickname, score: counts[m.id] || 0 }))
      .filter((r) => r.score > 0)
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.nickname.localeCompare(b.nickname, "ko")));

    return { total: list.length, todayCount, doneToday, ranking };
  }

  function renderChallengeList() {
    return `
      <h1 class="page-title">챌린지</h1>
      <p class="page-lede">하루 한 번 인증하면 10포인트. 작은 걸 오래 하는 쪽이 이겨요.</p>

      <div class="game-grid">
        ${CHALLENGES.map((c) => {
          const s = challengeStats(c.id);
          return `
            <a class="ch-card" href="#/challenge/${esc(c.id)}">
              <span class="ch-ico ${esc(c.color)}" aria-hidden="true">${c.emoji}</span>
              <span class="ch-name">${esc(c.name)}</span>
              <p class="ch-desc">${esc(c.short)}</p>
              <p class="ch-stat">오늘 ${s.todayCount}명 인증 · 누적 ${s.total}회${
                s.doneToday ? " · 내 인증 완료" : ""
              }</p>
            </a>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderChallengeDetail(id) {
    const c = CHALLENGES.find((x) => x.id === id);
    if (!c) {
      location.hash = "#/challenge";
      return "";
    }
    const s = challengeStats(c.id);

    return `
      <p class="tiny"><a href="#/challenge">← 챌린지 목록</a></p>
      <h1 class="page-title"><span aria-hidden="true">${c.emoji}</span> ${esc(c.name)}</h1>
      <p class="page-lede">${esc(c.detail)}</p>

      <div class="card" style="margin-bottom:32px">
        <p class="form-error" id="ch-error" role="alert"></p>
        ${s.doneToday
          ? `<p class="done-badge"><span aria-hidden="true">✓</span> 오늘 인증을 마쳤어요</p>
             <p class="field-hint" style="margin-top:16px">인증은 하루에 한 번만 됩니다. 내일 다시 만나요.</p>`
          : `<button type="button" class="btn btn-primary" data-action="challenge-checkin" data-id="${esc(c.id)}">
               오늘 인증하기 +10P
             </button>
             <p class="field-hint" style="margin-top:16px">하루에 한 번만 인증할 수 있어요.</p>`}
      </div>

      <section class="section" aria-labelledby="ch-rank">
        <div class="section-head">
          <h2 class="section-title" id="ch-rank">챌린지 랭킹</h2>
          <p class="section-note">누적 인증 횟수 기준</p>
        </div>
        ${rankListHtml(s.ranking, "회")}
      </section>
    `;
  }

  function doCheckin(challengeId) {
    const c = CHALLENGES.find((x) => x.id === challengeId);
    if (!c || !state.profile) return;

    const today = todayKey();
    const list = Repo.getCheckins(state.team.code, challengeId);
    // 중복 방지 — 저장 직전에 한 번 더 확인한다 (다른 탭에서 먼저 눌렀을 수 있다)
    if (list.some((e) => e.date === today && e.memberId === state.profile.id)) {
      // 먼저 다시 그린 뒤 메시지를 넣는다. 순서가 반대면 innerHTML 교체로 지워진다.
      render({ keepFocus: true });
      const box = $("#ch-error");
      if (box) box.textContent = "오늘은 이미 인증했어요.";
      announce("오늘은 이미 인증했어요.");
      return;
    }

    Repo.addCheckin(state.team.code, challengeId, {
      memberId: state.profile.id,
      date: today,
      at: new Date().toISOString()
    });

    const member = me();
    if (member) {
      member.points += 10;
      Repo.saveTeam(state.team);
    }

    addFeed("challenge", `${c.name} 인증!`, `${state.profile.nickname}님이 오늘 챌린지를 완료했어요. +10P`);
    announce("인증했어요. 10포인트를 얻었습니다.");
    render({ keepFocus: true }); // 바로 뒤에서 모달이 포커스를 가져간다

    openModal(
      "인증 완료!",
      `<p><b>${esc(c.name)}</b> 오늘 몫을 끝냈어요.</p><p>10포인트를 받았습니다. 현재 ${member ? member.points : 0}P.</p>`,
      [{ label: "확인", kind: "btn-primary" }]
    );
  }

  /* ==========================================================
     14. 우리팀
     ========================================================== */

  function renderTeam() {
    const ranking = sortedMembers().map((m) => ({ id: m.id, nickname: m.nickname, score: m.points }));

    return `
      <h1 class="page-title">${esc(state.team.name)}</h1>
      <p class="page-lede">그룹 코드를 동료에게 알려주면 같은 팀으로 합류할 수 있어요.</p>

      <div class="code-box">
        <div>
          <p class="tiny" style="margin:0 0 4px;font-weight:700">그룹 코드</p>
          <p class="code-value" id="team-code">${esc(state.team.code)}</p>
        </div>
        <button type="button" class="btn" data-action="copy-code">코드 복사</button>
      </div>

      <p class="notice" style="margin-bottom:32px">
        <b>같은 코드를 넣어도 다른 기기에서는 이 팀이 보이지 않아요.</b>
        데이터가 브라우저 안(localStorage)에만 저장되기 때문이에요.
        지금은 노트북 한 대를 함께 쓰는 방식으로 즐겨주세요.
      </p>

      <section class="section" aria-labelledby="tm-add">
        <div class="section-head"><h2 class="section-title" id="tm-add">팀원 추가</h2></div>
        <form class="card inline-form" data-action="member-add">
          <label class="visually-hidden" for="tm-new">추가할 팀원 닉네임</label>
          <input type="text" id="tm-new" name="nickname" maxlength="12" placeholder="예: 박과장">
          <button type="submit" class="btn btn-sm btn-primary">추가</button>
        </form>
        <p class="field-hint" style="margin-top:8px">
          사다리타기는 2명 이상부터 돌아가요. 함께 놀 동료를 여기에 등록해 두세요.
        </p>
      </section>

      <section class="section" aria-labelledby="tm-rank">
        <div class="section-head">
          <h2 class="section-title" id="tm-rank">멤버 랭킹</h2>
          <p class="section-note">챌린지 인증으로 포인트가 쌓여요</p>
        </div>
        ${rankListHtml(ranking, "P")}
      </section>

      <section class="section" aria-labelledby="tm-manage">
        <div class="section-head"><h2 class="section-title" id="tm-manage">멤버 관리</h2></div>
        <ul class="edit-list">
          ${state.team.members.map((m) => `
            <li>
              <span class="item-name">${esc(m.nickname)}${
                state.profile && m.id === state.profile.id ? ' <span class="tiny muted">(나)</span>' : ""
              }</span>
              ${state.profile && m.id === state.profile.id
                ? '<span class="tiny muted">삭제 불가</span>'
                : `<button type="button" class="icon-btn" data-action="member-del" data-id="${esc(m.id)}"
                           aria-label="${esc(m.nickname)} 팀원 삭제">✕</button>`}
            </li>
          `).join("")}
        </ul>
      </section>
    `;
  }

  function copyCode() {
    const code = state.team.code;
    const done = () => announce(`그룹 코드 ${code.split("").join(" ")}를 복사했어요.`);

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(done, fallback);
    } else {
      fallback();
    }

    // http나 구형 브라우저에서는 임시 입력창을 통해 복사한다
    function fallback() {
      const temp = document.createElement("textarea");
      temp.value = code;
      temp.setAttribute("readonly", "");
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand("copy");
        done();
      } catch (err) {
        announce("복사에 실패했어요. 코드를 직접 적어주세요.");
      }
      document.body.removeChild(temp);
    }
  }

  /* ==========================================================
     15. 마이
     ========================================================== */

  function renderMe() {
    const member = me();
    const points = member ? member.points : 0;
    const rank = sortedMembers().findIndex((m) => m.id === state.profile.id) + 1;
    const totalCheckins = CHALLENGES.reduce((sum, c) => {
      return sum + Repo.getCheckins(state.team.code, c.id)
        .filter((e) => e.memberId === state.profile.id).length;
    }, 0);

    return `
      <h1 class="page-title">마이</h1>
      <p class="page-lede">${esc(state.profile.nickname)} · ${esc(state.team.name)}</p>

      <div class="stat-grid">
        <div class="stat"><p class="k">내 포인트</p><p class="v">${points}</p></div>
        <div class="stat"><p class="k">팀 내 순위</p><p class="v">${rank || "-"}</p></div>
        <div class="stat"><p class="k">챌린지 인증</p><p class="v">${totalCheckins}</p></div>
      </div>

      <section class="section" aria-labelledby="my-badge">
        <div class="section-head">
          <h2 class="section-title" id="my-badge">뱃지</h2>
          <p class="section-note">포인트가 쌓이면 자동으로 열려요</p>
        </div>
        <ul class="badge-list">
          ${BADGES.map((b) => {
            const unlocked = points >= b.min;
            return `
              <li class="badge ${unlocked ? "" : "locked"}">
                <span class="emo" aria-hidden="true">${b.emoji}</span>
                <span class="nm">${esc(b.name)}</span>
                <span class="cond">${unlocked ? "획득함" : `잠김 · ${b.min}P 필요`}</span>
              </li>
            `;
          }).join("")}
        </ul>
      </section>

      <section class="section" aria-labelledby="my-leave">
        <div class="section-head"><h2 class="section-title" id="my-leave">팀 나가기</h2></div>
        <div class="card">
          <p style="margin-top:0">
            나가면 이 브라우저에서 로그아웃되고 온보딩 화면으로 돌아가요.
            팀 데이터 자체는 남아 있어서, 같은 그룹 코드로 다시 합류할 수 있습니다.
          </p>
          <button type="button" class="btn" data-action="leave-team">팀 나가기</button>
        </div>
      </section>
    `;
  }

  /* ==========================================================
     16. 라우팅 · 렌더
     ========================================================== */

  const TITLES = {
    home: "홈", games: "게임", challenge: "챌린지", team: "우리팀", me: "마이"
  };

  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, "");
    return raw ? raw.split("/").filter(Boolean) : ["home"];
  }

  function setNavActive(top) {
    document.querySelectorAll("#app-nav a[data-nav]").forEach((a) => {
      if (a.dataset.nav === top) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function viewHtml() {
    const [top, sub] = state.route;

    switch (top) {
      case "games":
        if (sub === "ladder") return renderLadder();
        if (sub === "roulette") return renderRoulette();
        if (sub === "balance") return renderBalance();
        return renderGames();
      case "challenge":
        return sub ? renderChallengeDetail(sub) : renderChallengeList();
      case "team":
        return renderTeam();
      case "me":
        return renderMe();
      default:
        return renderHome();
    }
  }

  // opts.keepFocus: 화면 일부만 갱신하는 상황(투표, 항목 추가 등)에서
  // 본문으로 포커스를 끌어오거나 맨 위로 스크롤하지 않게 한다.
  function render(opts) {
    const keepFocus = Boolean(opts && opts.keepFocus === true);
    const view = $("#view");
    state.route = parseRoute();

    // 프로필이 없으면 어떤 주소로 들어와도 온보딩부터
    if (!state.profile || !state.team) {
      document.body.classList.add("is-onboarding");
      $("#head-team").textContent = "";
      setNavActive(null);
      view.innerHTML = renderOnboarding();
      document.title = "오피스타임 — sogeul";
      if (!keepFocus) focusView();
      return;
    }

    document.body.classList.remove("is-onboarding");
    $("#head-team").textContent = `${state.team.name} · ${state.team.code}`;

    const top = state.route[0] || "home";
    setNavActive(TITLES[top] ? top : "home");
    view.innerHTML = viewHtml();
    document.title = `${TITLES[top] || "홈"} · 오피스타임 — sogeul`;
    if (!keepFocus) focusView();
  }

  // 화면이 바뀌면 본문으로 포커스를 옮긴다. 단, 첫 진입에서는 포커스를 뺏지 않는다.
  function focusView() {
    if (state.firstRender) {
      state.firstRender = false;
      return;
    }
    const view = $("#view");
    view.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  /* ==========================================================
     17. 이벤트 위임
     ========================================================== */

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-action]");
    if (!trigger || trigger.tagName === "FORM") return;
    const action = trigger.dataset.action;

    switch (action) {
      case "modal-close":
        closeModal();
        break;

      case "go-home":
        closeModal();
        location.hash = "#/home";
        break;

      case "ladder-del-item": {
        const L = ensureLadderState();
        const removed = L.items.splice(Number(trigger.dataset.index), 1)[0];
        L.result = null;
        // 지운 버튼이 사라지므로 포커스가 붕 뜬다 — 목록 바로 아래 입력칸으로 옮겨준다
        render({ keepFocus: true });
        announce(`${removed} 항목을 삭제했어요.`);
        const next = $("#ld-new");
        if (next) next.focus();
        break;
      }

      case "ladder-run":
        runLadder();
        break;

      case "ladder-share":
        shareLadder();
        break;

      case "roulette-del": {
        const R = ensureRouletteState();
        const removed = R.menus.splice(Number(trigger.dataset.index), 1)[0];
        R.last = null;
        render({ keepFocus: true });
        announce(`${removed} 메뉴를 삭제했어요.`);
        const next = $("#rl-new");
        if (next) next.focus();
        break;
      }

      case "roulette-spin":
        spinRoulette();
        break;

      case "roulette-share":
        shareRoulette();
        break;

      case "balance-vote":
        voteBalance(trigger.dataset.q, trigger.dataset.opt);
        break;

      case "balance-reset": {
        Repo.saveBalanceVotes(state.team.code, {});
        render({ keepFocus: true });
        announce("투표를 초기화했어요.");
        const again = document.querySelector('[data-action="balance-reset"]');
        if (again) again.focus();
        break;
      }

      case "challenge-checkin":
        doCheckin(trigger.dataset.id);
        break;

      case "copy-code":
        copyCode();
        break;

      case "member-del": {
        const id = trigger.dataset.id;
        const target = state.team.members.find((m) => m.id === id);
        if (!target) break;
        openModal(
          "팀원을 삭제할까요?",
          `<p><b>${esc(target.nickname)}</b> 님을 팀에서 뺍니다. 쌓인 포인트도 함께 사라져요.</p>`,
          [
            { label: "삭제", kind: "btn-primary", action: "member-del-confirm" },
            { label: "취소" }
          ]
        );
        state.pendingDelete = id;
        break;
      }

      case "member-del-confirm": {
        const id = state.pendingDelete;
        state.team.members = state.team.members.filter((m) => m.id !== id);
        Repo.saveTeam(state.team);
        state.pendingDelete = null;
        closeModal();
        render({ keepFocus: true });
        announce("팀원을 삭제했어요.");
        const back = $("#tm-new");
        if (back) back.focus();
        break;
      }

      case "leave-team":
        openModal(
          "팀에서 나갈까요?",
          `<p>이 브라우저에서 로그아웃돼요. 그룹 코드 <b>${esc(state.team.code)}</b> 로 다시 들어올 수 있습니다.</p>`,
          [
            { label: "나가기", kind: "btn-primary", action: "leave-confirm" },
            { label: "취소" }
          ]
        );
        break;

      case "leave-confirm":
        Repo.clearProfile();
        state.profile = null;
        state.team = null;
        state.ladder = null;
        state.roulette = null;
        closeModal();
        location.hash = "";
        render();
        break;

      default:
        break;
    }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target.closest("form[data-action]");
    if (!form) return;
    e.preventDefault();

    switch (form.dataset.action) {
      case "onboard":
        handleOnboard(form);
        break;

      case "ladder-add-item": {
        const input = form.item;
        const value = input.value.trim();
        if (!value) { input.focus(); return; }
        const L = ensureLadderState();
        L.items.push(value);
        L.result = null;
        render({ keepFocus: true });
        const next = $("#ld-new");
        if (next) next.focus();
        break;
      }

      case "roulette-add": {
        const input = form.menu;
        const value = input.value.trim();
        if (!value) { input.focus(); return; }
        const R = ensureRouletteState();
        if (R.menus.length >= 8) {
          announce("메뉴는 최대 8개까지 넣을 수 있어요.");
          return;
        }
        R.menus.push(value);
        R.last = null;
        render({ keepFocus: true });
        const next = $("#rl-new");
        if (next) next.focus();
        break;
      }

      case "member-add": {
        const input = form.nickname;
        const value = input.value.trim();
        if (!value) { input.focus(); return; }
        state.team.members.push({
          id: uid("m"),
          nickname: value,
          points: 0,
          joinedAt: new Date().toISOString()
        });
        Repo.saveTeam(state.team);
        render({ keepFocus: true });
        announce(`${value} 님을 팀에 추가했어요.`);
        const next = $("#tm-new");
        if (next) next.focus();
        break;
      }

      default:
        break;
    }
  });

  document.addEventListener("change", (e) => {
    // 온보딩 모드 전환 (합류 ↔ 새 팀 만들기)
    if (e.target.name === "mode") {
      const join = e.target.value === "join";
      const joinField = $("#ob-join-field");
      const createField = $("#ob-create-field");
      if (joinField) joinField.hidden = !join;
      if (createField) createField.hidden = join;
      const focusTarget = join ? $("#ob-code") : $("#ob-team");
      if (focusTarget) focusTarget.focus();
      return;
    }

    // 사다리 참가자 체크박스
    const toggle = e.target.closest('[data-action="ladder-toggle"]');
    if (toggle) {
      const L = ensureLadderState();
      const id = toggle.value;
      if (toggle.checked) {
        if (!L.members.includes(id)) L.members.push(id);
      } else {
        L.members = L.members.filter((x) => x !== id);
      }
      L.result = null;

      // 체크박스는 다시 그리지 않고 안내 문구만 갱신한다 (포커스를 잃지 않게)
      const hint = $("#ld-hint");
      if (hint) {
        const picked = L.members.length;
        const items = L.items.length;
        hint.innerHTML = picked < 2
          ? `<span class="no">참가자를 2명 이상 선택해 주세요. (지금 ${picked}명)</span>`
          : picked === items
            ? `<span class="ok">참가자 ${picked}명 · 항목 ${items}개 — 준비 완료</span>`
            : `<span class="no">참가자 ${picked}명 · 항목 ${items}개 — 항목을 ${
                picked > items ? `${picked - items}개 더 추가` : `${items - picked}개 삭제`
              }해 주세요.</span>`;
      }
      const stage = $("#ld-stage");
      if (stage) stage.innerHTML = "";
      // 지난 결과가 사라졌으니 그에 딸린 공유 버튼도 같이 걷어낸다
      const stale = document.querySelector('[data-action="ladder-share"]');
      if (stale) stale.remove();
    }
  });

  // 대화상자를 어떤 방식으로 닫든(Esc 포함) 뒷정리를 한 곳에서 한다
  $("#modal").addEventListener("close", () => {
    if (typeof state.modalOnClose === "function") {
      const fn = state.modalOnClose;
      state.modalOnClose = null;
      fn();
    }
  });

  window.addEventListener("hashchange", render);

  /* ==========================================================
     18. 시작
     ========================================================== */

  function init() {
    const profile = Repo.getProfile();
    if (profile && profile.code) {
      const team = Repo.getTeam(profile.code);
      // 팀은 있는데 내가 멤버 목록에 없다면(수동 삭제 등) 프로필을 버린다
      if (team && team.members.some((m) => m.id === profile.id)) {
        state.profile = profile;
        state.team = team;
      } else {
        Repo.clearProfile();
      }
    }
    render();
  }

  init();
})();
