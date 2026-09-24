/* Scenvyn: visar det som kontrollpanelen (eller fjärrkontrollen) styr. */
(function () {
  const { store, actions, sound, confetti, PEOPLE } = VAO;
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.has('preview');
  if (PREVIEW) document.documentElement.classList.add('preview');

  const body = document.body;
  const scene = document.getElementById('scene');
  const progress = document.getElementById('progress');
  const pause = document.getElementById('pause');
  const hint = document.getElementById('hint');
  const portraits = {
    tilda: document.querySelector('.portrait[data-person="tilda"]'),
    oliver: document.querySelector('.portrait[data-person="oliver"]')
  };

  let lastKey = null;
  let lastContent = null;
  let lastEffect = null;
  let countdownTimer = null;
  let card = null;

  // ---------- Porträtt ----------
  Object.entries(portraits).forEach(([who, fig]) => {
    const p = PEOPLE[who];
    const img = fig.querySelector('img');
    fig.querySelector('.monogram').textContent = p.monogram;
    fig.querySelector('.name').textContent = p.name;
    img.style.objectPosition = p.photoPosition || '50% 25%';
    // Prova vanliga filändelser tills någon finns
    const exts = /\.\w{3,4}$/.test(p.photo) ? [''] : ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG'];
    let n = 0;
    img.onerror = () => {
      if (++n < exts.length) img.src = p.photo + exts[n];
      else fig.classList.add('no-photo');
    };
    img.onload = () => {
      fig.classList.remove('no-photo');
      if (p.zoom) zoomPhoto(img, p.zoom, p.focus || [0.5, 0.3]);
    };
    img.src = p.photo + exts[0];
  });

  // Förstora bilden så att ansiktet (focus) hamnar centrerat i valvet
  function zoomPhoto(img, zoom, [fx, fy]) {
    const ratio = img.naturalHeight / img.naturalWidth;   // bildens höjd/bredd
    const w = zoom * 100;                                  // % av valvets bredd
    const h = w * ratio / (4 / 3);                         // % av valvets höjd
    let left = 50 - fx * w;
    let top = 30 - fy * h;
    left = Math.min(0, Math.max(100 - w, left));           // inga tomma kanter
    top = Math.min(0, Math.max(100 - h, top));
    img.classList.add('zoomed');
    Object.assign(img.style, { width: w + '%', height: h + '%', left: left + '%', top: top + '%' });
  }

  // ---------- Kronblad i bakgrunden ----------
  (function petals() {
    const wrap = document.getElementById('petals');
    const colors = ['var(--tilda-soft)', 'var(--gold-3)', 'var(--oliver-soft)', 'var(--tilda)', 'var(--gold-2)'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      s.className = 'petal';
      s.style.left = (Math.random() * 100) + 'vw';
      s.style.setProperty('--s', (0.6 + Math.random() * 0.9).toFixed(2) + 'vw');
      s.style.setProperty('--c', colors[i % colors.length]);
      const d = 16 + Math.random() * 14;
      s.style.setProperty('--d', d.toFixed(1) + 's');
      s.style.setProperty('--delay', (-Math.random() * d).toFixed(1) + 's');
      wrap.appendChild(s);
    }
  })();

  // ---------- Hjälpare ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function words(text) {
    return esc(text).split(/\s+/).filter(Boolean)
      .map((w, i) => `<span class="word" style="--i:${i}">${w}</span>`).join(' ');
  }

  function fitText(el, box, max, min) {
    let size = max;
    el.style.fontSize = `calc(var(--u) * ${size})`;
    const avail = () => box.clientHeight - 8;
    while (size > min && (el.scrollHeight > avail() || el.scrollWidth > box.clientWidth)) {
      size -= 0.1;
      el.style.fontSize = `calc(var(--u) * ${size.toFixed(2)})`;
    }
  }

  function fitCard() {
    if (!card) return;
    const st = card.querySelector('.statement');
    const box = card.querySelector('.statement-box');
    if (st && box) fitText(st, box, 4.2, 1.8);
  }

  function revealCopy(q, s) {
    const who = q.who;
    if (who === 'none') {
      return `<div class="reveal-kicker">Ingen av dem – det var</div><div class="stamp">Påhittat!</div>`;
    }
    const name = who === 'both' ? 'Båda två!' : `${esc(PEOPLE[who].name)}!`;
    const cue = who === 'both' ? 'Ordet till brudparet' : `Ordet till ${esc(PEOPLE[who].name)}`;
    return `
      <div class="reveal-kicker">Det var</div>
      <div class="reveal-name script gold-text">${name}</div>
      ${q.punchline ? `<div class="punchline">${esc(q.punchline)}</div>` : ''}
      ${s.settings.showMicCue && !q.punchline ? `<div class="mic"><svg><use href="#mic"/></svg>${cue}</div>` : ''}
    `;
  }

  function buildQuestion(q, s) {
    const list = store.playlist(s);
    const n = list.findIndex(x => x.id === q.id) + 1;
    const el = document.createElement('section');
    el.className = 'card question';
    el.innerHTML = `
      <div class="kicker">
        <span>Påstående <b>${n || '–'}</b>${n ? ` av ${list.length}` : ''}</span>
        <svg class="flourish" viewBox="0 0 200 20"><use href="#flourish"/></svg>
      </div>
      <div class="statement-box"><p class="statement">${words(q.text)}</p></div>
      <div class="slot">
        <div class="ask">
          <div class="ask-line"><span class="arrow">←</span><span class="t">${esc(PEOPLE.tilda.name)}</span> eller <span class="o">${esc(PEOPLE.oliver.name)}</span><span class="arrow">→</span></div>
        </div>
        <div class="vote">
          <div class="vote-prompt">${esc(s.settings.votePrompt)}</div>
          <div class="count"><span></span></div>
        </div>
        <div class="reveal">${revealCopy(q, s)}</div>
      </div>`;
    return el;
  }

  function buildHero(kind, s) {
    const el = document.createElement('section');
    el.className = 'card hero';
    if (kind === 'intro') {
      el.innerHTML = `
        <div class="eyebrow">${esc(PEOPLE.oliver.name)} &amp; ${esc(PEOPLE.tilda.name)} presenterar</div>
        <h1 class="script gold-text">Vem av oss?</h1>
        <p class="lede">Lyssna på påståendet – och peka på den ni tror att det gäller.</p>`;
    } else {
      el.innerHTML = `
        <div class="eyebrow">Alla hemligheter är avslöjade</div>
        <h1 class="script gold-text">Skål för brudparet!</h1>
        <p class="lede">Nu vet ni precis vad ni har att vänta er.</p>`;
    }
    return el;
  }

  function swapCard(next) {
    if (card) {
      const old = card;
      old.classList.add('leaving');
      setTimeout(() => old.remove(), 600);
    }
    card = next;
    if (next) {
      scene.appendChild(next);
      requestAnimationFrame(fitCard);
    }
  }

  // ---------- Nedräkning ----------
  function stopCountdown() { clearInterval(countdownTimer); countdownTimer = null; }

  function startCountdown(t0, secs, silent) {
    stopCountdown();
    const box = card && card.querySelector('.count');
    if (!box) return;
    const span = box.querySelector('span');
    let shown = null;
    const step = () => {
      const left = secs - Math.floor((Date.now() - t0) / 1000);
      const val = left > 0 ? String(left) : 'Peka!';
      if (val === shown) return;
      const late = Date.now() - t0 > secs * 1000 + 1500;
      shown = val;
      span.textContent = val;
      box.classList.toggle('go', left <= 0);
      box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
      if (!silent && !late) left > 0 ? sound.tick() : sound.go();
      if (left <= 0) stopCountdown();
    };
    step();
    countdownTimer = setInterval(step, 100);
  }

  // ---------- Firande ----------
  function celebrate(s, q) {
    if (PREVIEW) return;
    if (s.live.screen === 'outro') {
      sound.fanfare();
      confetti.cannons([cssVar('--gold'), cssVar('--gold-2'), cssVar('--gold-3'), cssVar('--tilda'), cssVar('--oliver'), '#ffffff']);
      return;
    }
    if (!q) return;
    if (q.who === 'none') { sound.fake(); return; }
    sound.reveal();
    const who = q.who === 'both' ? ['tilda', 'oliver'] : [q.who];
    who.forEach(w => {
      const colors = [cssVar('--' + w), cssVar('--' + w), cssVar('--gold'), cssVar('--gold-2'), cssVar('--gold-3'), '#ffffff'];
      setTimeout(() => confetti.fromElement(portraits[w].querySelector('.arch'), colors), 250);
    });
  }

  // ---------- Rendering ----------
  function render(s) {
    const live = s.live;
    document.documentElement.dataset.theme = s.settings.theme || 'light';
    sound.enabled = !!s.settings.sound && !PREVIEW;

    const q = store.current(s);
    const screen = live.screen === 'question' && !q ? 'intro' : live.screen;
    const phase = screen === 'question' ? (live.phase === 'vote' && !s.settings.countdown ? 'ask' : live.phase) : 'ask';

    body.dataset.screen = screen;
    body.dataset.phase = phase;

    // Kort i mitten
    const key = screen === 'question' ? 'q:' + q.id : screen;
    const content = screen === 'question'
      ? JSON.stringify([q.text, q.punchline, q.who, s.settings.votePrompt, s.settings.showMicCue, store.playlist(s).map(x => x.id)])
      : screen;
    if (key !== lastKey) {
      lastKey = key;
      lastContent = content;
      swapCard(screen === 'question' ? buildQuestion(q, s) : buildHero(screen, s));
    } else if (content !== lastContent && screen === 'question') {
      // Texten ändrades medan den visades – byt utan stor övergång
      lastContent = content;
      const next = buildQuestion(q, s);
      next.style.animation = 'none';
      next.querySelectorAll('.word').forEach(w => (w.style.animation = 'none', w.style.opacity = 1, w.style.transform = 'none', w.style.filter = 'none'));
      if (card) card.remove();
      card = next;
      scene.appendChild(next);
      fitCard();
    }
    if (card) card.dataset.phase = phase;

    // Vinnare / förlorare
    let winners = [];
    if (screen === 'question' && phase === 'reveal') {
      winners = q.who === 'both' ? ['tilda', 'oliver'] : q.who === 'none' ? [] : [q.who];
    }
    const revealing = screen === 'question' && phase === 'reveal';
    Object.entries(portraits).forEach(([who, fig]) => {
      fig.classList.toggle('win', (revealing && winners.includes(who)) || screen === 'outro');
      fig.classList.toggle('lose', revealing && !winners.includes(who));
    });
    body.dataset.winner = revealing && winners.length === 1 ? winners[0] : '';

    // Räkning till avslutningen
    const list = store.playlist(s);
    ['tilda', 'oliver'].forEach(w => {
      const n = list.filter(x => x.who === w || x.who === 'both').length;
      portraits[w].querySelector('.tally').innerHTML = `<b>${n}</b> ${n === 1 ? 'avslöjande' : 'avslöjanden'}`;
    });

    // Förlopp
    const idx = q ? list.findIndex(x => x.id === q.id) : -1;
    progress.classList.toggle('on', !!s.settings.showProgress && list.length <= 30);
    progress.innerHTML = list.map((x, i) => {
      let cls = 'dot';
      if (i < idx || (i === idx && phase === 'reveal')) cls += ' done-' + x.who;
      if (i === idx) cls += ' now';
      return `<span class="${cls}"></span>`;
    }).join('');

    // Paus
    pause.classList.toggle('on', !!live.paused);

    // Effekter som bara ska köras en gång per ändring
    const effect = [key, phase, live.t, live.paused].join('|');
    if (effect !== lastEffect) {
      const first = lastEffect === null;
      lastEffect = effect;
      stopCountdown();
      if (!live.paused) {
        if (screen === 'question' && phase === 'vote') {
          startCountdown(live.t, Math.max(1, s.settings.countdownSeconds | 0), first);
        }
        if (!first && ((screen === 'question' && phase === 'reveal') || screen === 'outro')) {
          setTimeout(() => celebrate(s, q), 150);
        }
      }
    }
  }

  store.subscribe(render);
  render(store.get());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitCard);
  window.addEventListener('resize', () => { clearTimeout(window.__fit); window.__fit = setTimeout(fitCard, 80); });

  if (PREVIEW) return;

  // ---------- Tangentbord / fjärrkontroll ----------
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
  }

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    sound.unlock();
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); actions.next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); actions.prev(); }
    else if (k === 'f' || k === 'F' || k === 'F5') { e.preventDefault(); toggleFullscreen(); }
    else if (k === 'b' || k === 'B' || k === '.' || k === 'p' || k === 'P') { actions.togglePause(); }
    else if (k === 'Home') { actions.showScreen('intro'); }
    else if (k === 'End') { actions.showScreen('outro'); }
    else if (k === 'r' || k === 'R') { actions.replay(); }
  });

  document.addEventListener('dblclick', toggleFullscreen);
  document.addEventListener('pointerdown', () => sound.unlock());

  // Visa tips och muspekare när musen rör sig
  let idleTimer;
  function wake() {
    body.classList.remove('idle');
    hint.classList.add('on');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { body.classList.add('idle'); hint.classList.remove('on'); }, 2500);
  }
  document.addEventListener('mousemove', wake);
  wake();
})();
