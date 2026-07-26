(function(){
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.25;
  masterGain.connect(ctx.destination);

  const whiteNotes = ['C','D','E','F','G','A','B'];
  const blackMap = { C:'C#', D:'D#', F:'F#', G:'G#', A:'A#' };
  const noteIndexMap = { C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11 };
  const koreanName = {
    C:'도', 'C#':'도 샾', D:'레', 'D#':'레 샾', E:'미', F:'파', 'F#':'파 샾',
    G:'솔', 'G#':'솔 샾', A:'라', 'A#':'라 샾', B:'시'
  };

  function noteLabel(note, octave){
    return koreanName[note] + ' ' + note + octave;
  }

  function noteFreq(note, octave){
    const midi = (octave + 1) * 12 + noteIndexMap[note];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  const activeOscillators = {};

  function playNote(id, freq){
    if(activeOscillators[id]) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    const gain = ctx.createGain();
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.15;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.9, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.25);
    osc1.connect(gain); osc2.connect(osc2Gain); osc2Gain.connect(gain);
    gain.connect(filter); filter.connect(masterGain);
    osc1.start(now); osc2.start(now);
    activeOscillators[id] = { osc1, osc2, gain };
  }

  function stopNote(id, sustainFlag, sustainedIdsSet){
    const voice = activeOscillators[id];
    if(!voice) return;
    if(sustainFlag){ sustainedIdsSet.add(id); return; }
    const now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    voice.osc1.stop(now + 0.4); voice.osc2.stop(now + 0.4);
    delete activeOscillators[id];
  }

  function forceStopNote(id){
    const voice = activeOscillators[id];
    if(!voice) return;
    const now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    voice.osc1.stop(now + 0.35); voice.osc2.stop(now + 0.35);
    delete activeOscillators[id];
  }

  /* ---------- generic piano builder (used for both free play and learn) ---------- */
  function buildPianoInto(containerEl, totalWhiteKeys, opts){
    containerEl.innerHTML = '';
    const els = [];
    for(let i = 0; i < totalWhiteKeys; i++){
      const noteName = whiteNotes[i % 7];
      const octaveOffset = Math.floor(i / 7);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'key white';
      el.dataset.note = noteName;
      el.dataset.octaveOffset = octaveOffset;
      el.dataset.index = i;
      containerEl.appendChild(el);
      els.push(el);
      opts.attach(el, noteName, octaveOffset);

      if(blackMap[noteName]){
        const blackNote = blackMap[noteName];
        const bEl = document.createElement('button');
        bEl.type = 'button';
        bEl.className = 'key black';
        bEl.dataset.note = blackNote;
        bEl.dataset.octaveOffset = octaveOffset;
        bEl.dataset.afterIndex = i;
        containerEl.appendChild(bEl);
        opts.attach(bEl, blackNote, octaveOffset);
      }
    }
    repositionBlackKeys(containerEl);
    return els;
  }

  function repositionBlackKeys(containerEl){
    const whiteKeys = [...containerEl.querySelectorAll('.white')];
    const blackKeys = [...containerEl.querySelectorAll('.black')];
    const rect = containerEl.getBoundingClientRect();
    if(rect.width === 0) return;
    blackKeys.forEach(bEl => {
      const afterIndex = Number(bEl.dataset.afterIndex);
      const whiteEl = whiteKeys[afterIndex];
      if(!whiteEl) return;
      const wRect = whiteEl.getBoundingClientRect();
      const blackWidth = rect.width * 0.039;
      bEl.style.left = ((wRect.right - rect.left) - blackWidth / 2) + 'px';
    });
  }

  function setKeyActive(el, isActive){ if(el) el.classList.toggle('active', isActive); }

  /* 건반은 button이므로 Enter/Space로도 눌리게 한다.
     기본 동작(click)을 막고 누름/뗌을 직접 짝지어야 소리가 계속 나지 않는다. */
  function attachKeyboardPress(el, trigger, release){
    let held = false;
    el.addEventListener('keydown', (e) => {
      if(e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      if(e.repeat || held) return;
      held = true;
      trigger();
    });
    el.addEventListener('keyup', (e) => {
      if(e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      if(!held) return;
      held = false;
      release();
    });
    el.addEventListener('blur', () => { if(held){ held = false; release(); } });
  }

  /* ================= FREE PLAY ================= */
  (function freePlay(){
    const container = document.getElementById('pianoFree');
    const octDisplay = document.getElementById('octDisplay');
    let baseOctave = 4;
    let sustain = false;
    const sustainedIds = new Set();
    const TOTAL = 16;
    const labelTargets = [];

    function idFor(note, octaveOffset){ return note + '_' + (baseOctave + octaveOffset); }

    function relabel(){
      labelTargets.forEach(({ el, note, octaveOffset }) => {
        el.setAttribute('aria-label', noteLabel(note, baseOctave + octaveOffset));
      });
    }

    function attach(el, note, octaveOffset){
      labelTargets.push({ el, note, octaveOffset });
      const trigger = (e) => {
        if(e) e.preventDefault();
        ctx.resume();
        const id = idFor(note, octaveOffset);
        playNote(id, noteFreq(note, baseOctave + octaveOffset));
        setKeyActive(el, true);
      };
      const release = (e) => {
        if(e) e.preventDefault();
        const id = idFor(note, octaveOffset);
        setKeyActive(el, false);
        stopNote(id, sustain, sustainedIds);
      };
      el.addEventListener('mousedown', trigger);
      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', release);
      el.addEventListener('touchstart', trigger, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
      attachKeyboardPress(el, () => trigger(), () => release());
    }

    buildPianoInto(container, TOTAL, { attach });
    relabel();
    window.addEventListener('resize', () => repositionBlackKeys(container));

    document.getElementById('octDown').addEventListener('click', () => {
      if(baseOctave <= 1) return;
      baseOctave--; octDisplay.textContent = baseOctave; relabel();
    });
    document.getElementById('octUp').addEventListener('click', () => {
      if(baseOctave >= 6) return;
      baseOctave++; octDisplay.textContent = baseOctave; relabel();
    });
    document.getElementById('sustainToggle').addEventListener('change', (e) => {
      sustain = e.target.checked;
      if(!sustain){ sustainedIds.forEach(id => stopNote(id, false, sustainedIds)); sustainedIds.clear(); }
    });
  })();

  /* ================= LEARN MODE ================= */
  const songs = [
    { id:'twinkle', title:'반짝반짝 작은 별', emoji:'⭐', notes: [
      'C','C','G','G','A','A','G:2',
      'F','F','E','E','D','D','C:2',
      'G','G','F','F','E','E','D:2',
      'G','G','F','F','E','E','D:2',
      'C','C','G','G','A','A','G:2',
      'F','F','E','E','D','D','C:2'
    ]},
    { id:'schoolbell', title:'학교종', emoji:'🔔', notes: [
      'G','G','A','A','G','G','E:2',
      'G','G','A','A','G','E','D:2',
      'E','E','D','D','C','D','E:2',
      'G','A','G','F','E','D','C:2'
    ]},
    { id:'butterfly', title:'나비야', emoji:'🦋', notes: [
      'G','E','E','F','D','D','C:2',
      'D','E','F','G','G','G:2',
      'G','E','E','F','D','D','C:2',
      'D','E','C','C:3'
    ]}
  ];

  function parseSong(song){
    return song.notes.map(token => {
      const [n, d] = token.split(':');
      return { note: n, octave: 4, dur: d ? Number(d) : 1 };
    });
  }

  const container = document.getElementById('pianoLearn');
  const TOTAL = 16;
  const keyEls = {}; // "note_octaveOffset" -> element (octaveOffset relative, base fixed at 4)
  const BASE_OCTAVE_LEARN = 4;

  let sequence = [];
  let cursor = 0;
  let mode = 'practice'; // 'practice' | 'demo'
  let demoTimer = null;

  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const practiceHint = document.getElementById('practiceHint');

  buildPianoInto(container, TOTAL, {
    attach(el, note, octaveOffset){
      keyEls[note + '_' + octaveOffset] = el;
      el.setAttribute('aria-label', noteLabel(note, BASE_OCTAVE_LEARN + octaveOffset));
      el.addEventListener('mousedown', (e) => { e.preventDefault(); handleLearnPress(note, octaveOffset, el); });
      el.addEventListener('touchstart', (e) => { e.preventDefault(); handleLearnPress(note, octaveOffset, el); }, { passive: false });
      el.addEventListener('mouseup', () => releaseLearnKey(note, octaveOffset));
      el.addEventListener('mouseleave', () => releaseLearnKey(note, octaveOffset));
      el.addEventListener('touchend', () => releaseLearnKey(note, octaveOffset), { passive: false });
      el.addEventListener('touchcancel', () => releaseLearnKey(note, octaveOffset), { passive: false });
      attachKeyboardPress(el,
        () => handleLearnPress(note, octaveOffset, el),
        () => releaseLearnKey(note, octaveOffset));
    }
  });
  window.addEventListener('resize', () => repositionBlackKeys(container));

  function absOctaveOffsetFor(octave){ return octave - BASE_OCTAVE_LEARN; }

  function elFor(note, octave){ return keyEls[note + '_' + absOctaveOffsetFor(octave)]; }

  function clearHighlights(){
    Object.values(keyEls).forEach(el => el.classList.remove('target','correct','wrong'));
  }

  function showTarget(){
    clearHighlights();
    if(cursor >= sequence.length){
      updateProgress();
      practiceHint.textContent = '끝까지 연주했어요. 다시 하려면 처음부터 다시 버튼을 누르세요.';
      return;
    }
    const step = sequence[cursor];
    const el = elFor(step.note, step.octave);
    if(el) el.classList.add('target');
    practiceHint.textContent = '다음 건반: ' + noteLabel(step.note, step.octave)
      + ' (' + (cursor + 1) + '/' + sequence.length + ')';
    updateProgress();
  }

  function updateProgress(){
    const pct = sequence.length ? Math.round((cursor / sequence.length) * 100) : 0;
    progressFill.style.width = pct + '%';
    progressBar.setAttribute('aria-valuenow', pct);
    progressBar.setAttribute('aria-valuetext', pct + '퍼센트');
  }

  function handleLearnPress(note, octaveOffset, el){
    ctx.resume();
    const octave = BASE_OCTAVE_LEARN + octaveOffset;
    const id = note + '_' + octave + '_learn';
    playNote(id, noteFreq(note, octave));
    setKeyActive(el, true);

    if(mode !== 'practice' || cursor >= sequence.length) return;
    const step = sequence[cursor];
    const isCorrect = (step.note === note && step.octave === octave);
    if(isCorrect){
      el.classList.remove('target');
      el.classList.add('correct');
      cursor++;
      setTimeout(() => { el.classList.remove('correct'); showTarget(); }, 160);
    } else {
      el.classList.add('wrong');
      setTimeout(() => el.classList.remove('wrong'), 200);
    }
  }

  function releaseLearnKey(note, octaveOffset){
    const octave = BASE_OCTAVE_LEARN + octaveOffset;
    const id = note + '_' + octave + '_learn';
    const el = keyEls[note + '_' + octaveOffset];
    setKeyActive(el, false);
    forceStopNote(id);
  }

  function stopDemo(){
    if(demoTimer){ clearTimeout(demoTimer); demoTimer = null; }
  }

  function playDemo(){
    stopDemo();
    let i = cursor;
    function step(){
      clearHighlights();
      if(i >= sequence.length){
        updateProgress();
        practiceHint.textContent = '연주가 끝났어요.';
        return;
      }
      const note = sequence[i];
      const el = elFor(note.note, note.octave);
      const id = note.note + '_' + note.octave + '_demo';
      if(el) el.classList.add('target');
      ctx.resume();
      playNote(id, noteFreq(note.note, note.octave));
      setKeyActive(el, true);
      cursor = i;
      updateProgress();
      const holdMs = 300 * note.dur;
      demoTimer = setTimeout(() => {
        forceStopNote(id);
        setKeyActive(el, false);
        i++;
        demoTimer = setTimeout(step, 90);
      }, holdMs);
    }
    step();
  }

  function openSong(song){
    sequence = parseSong(song);
    cursor = 0;
    document.getElementById('practiceTitle').textContent = song.title;
    showInner('viewPractice');
    setMode('practice');
    document.getElementById('practiceTitle').focus();
  }

  function restartSong(){
    stopDemo();
    cursor = 0;
    if(mode === 'demo') playDemo(); else showTarget();
  }

  function setMode(newMode){
    mode = newMode;
    document.getElementById('modePractice').setAttribute('aria-pressed', String(mode === 'practice'));
    document.getElementById('modeDemo').setAttribute('aria-pressed', String(mode === 'demo'));
    stopDemo();
    if(mode === 'demo'){ practiceHint.textContent = '자동 연주 중이에요.'; playDemo(); }
    else { showTarget(); }
  }

  document.getElementById('modePractice').addEventListener('click', () => setMode('practice'));
  document.getElementById('modeDemo').addEventListener('click', () => setMode('demo'));
  document.getElementById('restartSong').addEventListener('click', restartSong);
  document.getElementById('backToList').addEventListener('click', () => {
    stopDemo();
    clearHighlights();
    showInner('viewSelect');
    const first = document.querySelector('#songList .song-card');
    if(first) first.focus();
  });

  /* song list rendering */
  const songListEl = document.getElementById('songList');
  songs.forEach(song => {
    const item = document.createElement('li');
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'song-card';

    const emoji = document.createElement('span');
    emoji.className = 'song-emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = song.emoji;

    const title = document.createElement('span');
    title.className = 'song-title';
    title.textContent = song.title;

    card.append(emoji, title);
    card.addEventListener('click', () => openSong(song));
    item.appendChild(card);
    songListEl.appendChild(item);
  });

  /* ================= VIEW / TAB SWITCHING ================= */
  function refreshLayout(){
    setTimeout(() => {
      repositionBlackKeys(document.getElementById('pianoFree'));
      repositionBlackKeys(document.getElementById('pianoLearn'));
    }, 20);
  }

  function showInner(id){
    document.querySelectorAll('#panelLearn .view-inner').forEach(v => v.classList.toggle('visible', v.id === id));
    if(id !== 'viewPractice') stopDemo();
    refreshLayout();
  }

  const tabs = [document.getElementById('tabFree'), document.getElementById('tabLearn')];
  const panels = { tabFree: 'panelFree', tabLearn: 'panelLearn' };

  function selectTab(tab, moveFocus){
    tabs.forEach(t => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(panels[t.id]).classList.toggle('visible', selected);
    });
    if(tab.id !== 'tabLearn') stopDemo();
    if(moveFocus) tab.focus();
    refreshLayout();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab, false));
    tab.addEventListener('keydown', (e) => {
      let next = null;
      if(e.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      else if(e.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if(e.key === 'Home') next = tabs[0];
      else if(e.key === 'End') next = tabs[tabs.length - 1];
      if(!next) return;
      e.preventDefault();
      selectTab(next, true);
    });
  });

  /* 건반 위 스와이프만 막고, 곡 목록 스크롤은 살려 둔다 */
  document.addEventListener('touchmove', (e) => {
    if(e.target instanceof Element && e.target.closest('.piano')) e.preventDefault();
  }, { passive: false });
})();
