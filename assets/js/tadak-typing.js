const PASSAGES = {
  short: [
    "창밖으로 비가 내리기 시작했다. 우산을 챙기지 못한 것이 못내 아쉬웠다.",
    "아침에 마시는 커피 한 잔이 하루의 기분을 결정한다. 오늘도 향이 좋다.",
    "고양이가 창틀에 앉아 오래도록 바깥을 바라보았다. 무엇을 보고 있었을까."
  ],
  medium: [
    "퇴근길 지하철 창문 너머로 노을이 번지고 있었다. 하루 종일 모니터만 바라보던 눈이 오랜만에 먼 곳을 향했다. 붉게 물든 하늘을 보니 오늘 하루도 나쁘지 않았다는 생각이 들었다.",
    "책상 위에는 다 마신 커피잔과 메모지 몇 장이 흩어져 있었다. 종일 붙들고 씨름하던 문제가 실마리가 잡히자 조금씩 풀리기 시작했다. 아직 갈 길은 멀었지만 마음은 한결 가벼워졌다.",
    "느티나무 그늘 아래 늦여름 매미 소리가 가득했다. 걷는 속도를 조금 늦추고 나무 그늘을 따라 걸었다. 바쁘게 지나치던 길이 오늘따라 유난히 길게 느껴졌다."
  ],
  long: [
    "새벽 다섯 시, 아직 어스름이 가시지 않은 골목을 지나 문을 연 빵집으로 향했다. 갓 구운 빵 냄새가 골목 끝까지 퍼져 있었다. 주인은 매일 같은 시각에 반죽을 시작한다고 했다. 손에 익은 동작으로 반죽을 치대는 모습에는 오랜 시간이 쌓인 리듬이 있었다. 손님이 하나둘 늘어나는 여섯 시가 넘어서야 그는 잠시 손을 멈추고 창밖을 바라보았다. 매일 반복되는 일이지만 지겹지 않냐고 묻자, 그는 웃으며 매일 다른 반죽이라 그렇다고 답했다.",
    "이사한 지 한 달이 지나서야 동네 지리가 조금씩 눈에 익기 시작했다. 처음에는 낯설던 골목길도 몇 번 지나다니다 보니 어느새 지름길이 되어 있었다. 근처 카페 주인은 이제 얼굴을 기억하고 먼저 인사를 건넨다. 작은 동네였지만 하루하루 새로운 풍경이 눈에 들어왔다. 계절이 바뀌면 이 거리도 또 다른 모습을 보여주겠지. 낯선 곳이 익숙한 곳으로 변해가는 과정이 생각보다 오래 걸리지 않는다는 것을, 이번에 다시 한번 깨달았다."
  ]
};

let currentText = "";
let currentLevel = "short";
let startTime = null;
let timerInterval = null;
let finished = false;
let lastResult = null;
let cardObjectUrl = null;
let lastFocusedBeforeCard = null;

const screenHome = document.getElementById('screen-home');
const screenType = document.getElementById('screen-type');
const screenResult = document.getElementById('screen-result');
const passageDisplay = document.getElementById('passageDisplay');
const typer = document.getElementById('typer');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const liveTime = document.getElementById('liveTime');
const liveAcc = document.getElementById('liveAcc');
const cardOverlay = document.getElementById('cardOverlay');
const cardImage = document.getElementById('cardImage');

// 화면 전환 시 포커스를 새 화면의 제목으로 옮긴다.
// 그러지 않으면 스크린리더 사용자는 화면이 바뀐 사실을 알 수 없다.
function showScreen(el, focusTargetId){
  [screenHome, screenType, screenResult].forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  if(focusTargetId){
    const target = document.getElementById(focusTargetId);
    if(target) target.focus();
  }
}

function pickPassage(level){
  const list = PASSAGES[level];
  return list[Math.floor(Math.random() * list.length)];
}

function renderPassage(text){
  passageDisplay.innerHTML = text.split('').map((ch, i) =>
    `<span class="ch${i===0 ? ' current' : ''}" data-i="${i}">${ch}</span>`
  ).join('');
}

function setProgress(percent){
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  progressFill.style.width = value + "%";
  progressBar.setAttribute('aria-valuenow', String(value));
}

function resetTyping(){
  finished = false;
  startTime = null;
  typer.value = "";
  renderPassage(currentText);
  setProgress(0);
  liveTime.textContent = "00:00";
  liveAcc.textContent = "100%";
  clearInterval(timerInterval);
  showScreen(screenType, 'typeTitle');
  setTimeout(() => typer.focus(), 150);
}

function startLevel(level){
  currentLevel = level;
  currentText = pickPassage(level);
  resetTyping();
}

function formatTime(ms){
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updateLiveTimer(){
  if(!startTime) return;
  liveTime.textContent = formatTime(Date.now() - startTime);
}

function computeStats(){
  const typed = typer.value;
  const spans = passageDisplay.querySelectorAll('.ch');
  let correctCount = 0;
  let errorCount = 0;

  spans.forEach((span, i) => {
    span.classList.remove('correct','incorrect','current');
    if(i < typed.length){
      if(typed[i] === currentText[i]){
        span.classList.add('correct');
        correctCount++;
      } else {
        span.classList.add('incorrect');
        errorCount++;
      }
    } else if(i === typed.length){
      span.classList.add('current');
    }
  });

  return { typed, correctCount, errorCount };
}

function handleInput(){
  if(finished) return;
  if(!startTime){
    startTime = Date.now();
    timerInterval = setInterval(updateLiveTimer, 250);
  }
  const { typed, correctCount } = computeStats();

  const liveAccVal = typed.length > 0 ? Math.round((correctCount / typed.length) * 100) : 100;
  liveAcc.textContent = liveAccVal + "%";
  setProgress((typed.length / currentText.length) * 100);

  if(typed.length >= currentText.length){
    finishTyping(correctCount, typed.length);
  }
}

function submitEarly(){
  if(finished || !startTime) return;
  const { typed, correctCount } = computeStats();
  finishTyping(correctCount, typed.length);
}

// 정확도는 전체 글자 수(currentText.length) 기준으로 계산해,
// 다 안 쓰고 제출하거나 오타가 있으면 그만큼 정확도에 그대로 반영된다.
function finishTyping(correctCount, typedLength){
  finished = true;
  clearInterval(timerInterval);
  const elapsedMs = Date.now() - startTime;
  const elapsedMin = Math.max(elapsedMs / 60000, 1/60);
  const speed = Math.round(typedLength / elapsedMin);
  const totalLength = currentText.length;
  const acc = Math.round((correctCount / totalLength) * 100);
  const wrongCount = totalLength - correctCount;
  const timeStr = formatTime(elapsedMs);

  lastResult = { speed, timeStr, acc, chars: typedLength, errors: wrongCount };

  document.getElementById('resultSpeed').textContent = speed;
  document.getElementById('resultTime').textContent = timeStr;
  document.getElementById('resultAcc').textContent = acc + "%";
  document.getElementById('resultChars').textContent = typedLength + "자";
  document.getElementById('resultErrors').textContent = wrongCount + "개";

  setTimeout(() => showScreen(screenResult, 'resultTitle'), 400);
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawStatMini(ctx,x,y,label,value){
  ctx.fillStyle = '#6F6659';
  ctx.font = '500 30px Pretendard';
  ctx.fillText(label, x, y);
  ctx.fillStyle = '#2A2420';
  ctx.font = '700 58px monospace';
  ctx.fillText(value, x, y + 74);
}

async function buildCardCanvas(){
  if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#F6F2EA';
  ctx.fillRect(0,0,1080,1920);

  roundRect(ctx, 60, 190, 960, 1560, 40);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E4DCCC';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#2A2420';
  ctx.font = '800 46px Pretendard';
  ctx.fillText('타닥.', 110, 130);
  const brandWidth = ctx.measureText('타닥.').width;
  ctx.fillStyle = '#6F6659';
  ctx.font = '500 28px Pretendard';
  ctx.fillText('타자 속도 리포트', 110 + brandWidth + 16, 128);

  ctx.fillStyle = '#6F6659';
  ctx.font = '600 32px Pretendard';
  ctx.fillText('오늘의 타이핑 결과', 130, 320);

  ctx.fillStyle = '#2A2420';
  ctx.font = '700 250px monospace';
  ctx.fillText(String(lastResult.speed), 130, 640);
  const numWidth = ctx.measureText(String(lastResult.speed)).width;
  ctx.fillStyle = '#6F6659';
  ctx.font = '600 42px Pretendard';
  ctx.fillText('타/분', 130 + numWidth + 20, 640);

  drawStatMini(ctx, 130, 900, '정확도', lastResult.acc + '%');
  drawStatMini(ctx, 630, 900, '소요 시간', lastResult.timeStr);
  drawStatMini(ctx, 130, 1090, '입력 글자 수', lastResult.chars + '자');
  drawStatMini(ctx, 630, 1090, '틀린 글자', lastResult.errors + '개');

  const dateStr = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' });
  ctx.fillStyle = '#6F6659';
  ctx.font = '500 30px Pretendard';
  ctx.fillText(dateStr, 130, 1650);
  ctx.fillStyle = '#8F5C10';
  ctx.font = '600 30px Pretendard';
  ctx.fillText('#타닥  #타자연습  #타자속도측정', 130, 1700);

  return canvas;
}

// 카드는 이미지라서 화면에 보이는 숫자를 alt로 다시 읽어줘야 한다.
function cardAltText(){
  return `타자 속도 리포트 카드. 분당 ${lastResult.speed}타, 정확도 ${lastResult.acc}퍼센트, `
    + `소요 시간 ${lastResult.timeStr}, 입력 글자 수 ${lastResult.chars}자, 틀린 글자 ${lastResult.errors}개.`;
}

function getCardFocusables(){
  return Array.from(cardOverlay.querySelectorAll('button'));
}

function closeCardOverlay(){
  cardOverlay.classList.remove('active');
  if(lastFocusedBeforeCard) lastFocusedBeforeCard.focus();
}

// 모달이 열려 있는 동안 Tab이 배경으로 새어나가지 않게 가둔다.
function trapCardFocus(e){
  if(!cardOverlay.classList.contains('active')) return;
  if(e.key === 'Escape'){
    e.preventDefault();
    closeCardOverlay();
    return;
  }
  if(e.key !== 'Tab') return;
  const items = getCardFocusables();
  if(!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if(e.shiftKey && document.activeElement === first){
    e.preventDefault();
    last.focus();
  } else if(!e.shiftKey && document.activeElement === last){
    e.preventDefault();
    first.focus();
  }
}

async function openCardOverlay(){
  lastFocusedBeforeCard = document.activeElement;
  const canvas = await buildCardCanvas();
  canvas.toBlob((blob) => {
    if(cardObjectUrl) URL.revokeObjectURL(cardObjectUrl);
    cardObjectUrl = URL.createObjectURL(blob);
    cardImage.src = cardObjectUrl;
    cardImage.alt = cardAltText();
    cardOverlay.classList.add('active');
    document.getElementById('cardCloseBtn').focus();
    document.getElementById('cardShareBtn').onclick = async () => {
      const file = new File([blob], '타닥-리포트.png', { type: 'image/png' });
      if(navigator.canShare && navigator.canShare({ files: [file] })){
        try{
          await navigator.share({ files: [file], title: '타닥 타자 속도 리포트', text: `내 타자 속도는 분당 ${lastResult.speed}타!` });
        }catch(e){ /* 사용자가 취소한 경우 등은 무시 */ }
      } else {
        const a = document.createElement('a');
        a.href = cardObjectUrl;
        a.download = '타닥-리포트.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    };
  }, 'image/png');
}

document.querySelectorAll('.level-card').forEach(card => {
  card.addEventListener('click', () => startLevel(card.dataset.level));
});
document.getElementById('exitBtn').addEventListener('click', () => {
  clearInterval(timerInterval);
  showScreen(screenHome, 'homeTitle');
});
document.getElementById('retryBtn').addEventListener('click', resetTyping);
document.getElementById('homeBtn').addEventListener('click', () => showScreen(screenHome, 'homeTitle'));

typer.addEventListener('input', handleInput);
document.getElementById('submitBtn').addEventListener('click', submitEarly);
document.getElementById('makeCardBtn').addEventListener('click', openCardOverlay);
document.getElementById('cardCloseBtn').addEventListener('click', closeCardOverlay);
document.addEventListener('keydown', trapCardFocus);
