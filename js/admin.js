/* Kontrollpanelen för toastmastern. */
(function () {
  const { store, actions, PEOPLE } = VAO;
  const $ = s => document.querySelector(s);
  const WHO = ['tilda', 'oliver', 'both', 'none'];
  const WHO_LABEL = { tilda: PEOPLE.tilda.name, oliver: PEOPLE.oliver.name, both: 'Båda', none: 'Påhittat' };
  const PHASE_LABEL = { ask: 'Påstående visas', vote: 'Nedräkning', reveal: 'Avslöjat' };

  let filter = 'all';
  let editingId = null;
  let dragId = null;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tag = who => `<span class="tag ${who}">${esc(WHO_LABEL[who])}</span>`;

  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('on'), 1800);
  }

  // ---------- Förhandsvisning ----------
  const wrap = $('#preview-wrap');
  const frame = $('#preview');
  const fitPreview = () => { frame.style.transform = `scale(${wrap.clientWidth / 1600})`; };
  new ResizeObserver(fitPreview).observe(wrap);
  fitPreview();

  // ---------- Livepanel ----------
  function describeStep(step, s) {
    if (!step) return '–';
    if (step.screen === 'intro') return 'Intro';
    if (step.screen === 'outro') return 'Avslutning';
    const list = store.playlist(s);
    const n = list.findIndex(x => x.id === step.id) + 1;
    if (step.phase === 'ask') return `Påstående ${n}`;
    if (step.phase === 'vote') return 'Nedräkning';
    return 'Avslöja';
  }

  function renderLive(s) {
    const l = s.live;
    const q = store.current(s);
    const list = store.playlist(s);
    const now = $('#now');
    if (l.screen === 'question' && q) {
      const n = list.findIndex(x => x.id === q.id) + 1;
      now.innerHTML = `
        <div class="label">${n ? `Påstående ${n} av ${list.length}` : 'Påstående (bortvalt)'} · ${PHASE_LABEL[l.phase] || ''}${l.paused ? ' · <b>PAUS</b>' : ''}</div>
        <div class="q">${esc(q.text)}</div>
        <div class="ans">Rätt svar: ${tag(q.who)}${q.punchline ? ` <em>– ${esc(q.punchline)}</em>` : ''}</div>`;
    } else {
      now.innerHTML = `
        <div class="label">${l.screen === 'intro' ? 'Intro' : 'Avslutning'}${l.paused ? ' · <b>PAUS</b>' : ''}</div>
        <div class="q">${l.screen === 'intro' ? 'Välkomstskärmen visas' : 'Tackskärmen visas'}</div>`;
    }

    const steps = store.steps(s);
    const i = store.stepIndex(s);
    const nextStep = l.paused ? null : (i === -1 ? steps[1] : steps[i + 1]);
    $('#next-label').textContent = l.paused ? 'Avsluta paus' : nextStep ? `Nästa: ${describeStep(nextStep, s)}` : 'Slut';
    $('#next').disabled = !l.paused && !nextStep;

    document.querySelectorAll('#phases .chip').forEach(b => {
      b.classList.toggle('on', l.screen === 'question' && l.phase === b.dataset.phase);
      b.disabled = l.screen !== 'question' || (b.dataset.phase === 'vote' && !s.settings.countdown);
    });
    document.querySelectorAll('.screens [data-screen]').forEach(b => b.classList.toggle('on', l.screen === b.dataset.screen));
    $('#pause-btn').classList.toggle('on', !!l.paused);

    // Nästa påstående
    const idx = q ? list.findIndex(x => x.id === q.id) : -1;
    const upcoming = l.screen === 'intro' ? list[0] : l.screen === 'question' ? list[idx + 1] : null;
    $('#upnext').innerHTML = upcoming
      ? `Därefter: <b>${esc(upcoming.text)}</b> ${tag(upcoming.who)}`
      : l.screen === 'question' ? 'Därefter: <b>Avslutning</b>' : 'Inga fler påståenden.';
  }

  // ---------- Lista ----------
  const tpl = $('#row-tpl');

  function renderList(s) {
    const list = store.playlist(s);
    const current = store.current(s);
    const curIdx = current ? list.findIndex(x => x.id === current.id) : (s.live.screen === 'outro' ? list.length : -1);
    const tally = { tilda: 0, oliver: 0 };
    list.forEach(x => { if (x.who === 'tilda' || x.who === 'oliver') tally[x.who]++; });
    $('#count').textContent = `${list.length} med · ${PEOPLE.tilda.name} ${tally.tilda} · ${PEOPLE.oliver.name} ${tally.oliver}`;

    if (editingId) return; // bygg inte om medan någon skriver

    const ol = $('#list');
    ol.innerHTML = '';
    s.statements.forEach(q => {
      if (filter === 'tilda' && q.who !== 'tilda') return;
      if (filter === 'oliver' && q.who !== 'oliver') return;
      if (filter === 'off' && q.enabled) return;
      const li = tpl.content.firstElementChild.cloneNode(true);
      const n = list.findIndex(x => x.id === q.id);
      li.dataset.id = q.id;
      li.dataset.who = q.who;
      li.classList.toggle('off', !q.enabled);
      li.classList.toggle('live', !!current && current.id === q.id);
      li.classList.toggle('done', n > -1 && n < curIdx);
      li.querySelector('.toggle input').checked = q.enabled;
      li.querySelector('.num').textContent = n > -1 ? n + 1 : '';
      li.querySelector('.text').textContent = q.text;
      li.querySelector('.punch').textContent = q.punchline || '';
      const who = li.querySelector('.who');
      who.dataset.who = q.who;
      who.textContent = WHO_LABEL[q.who];
      ol.appendChild(li);
    });
    if (!ol.children.length) {
      ol.innerHTML = '<li class="item" style="grid-template-columns:1fr;color:var(--ink-soft)">Inga påståenden här.</li>';
    }
  }

  function startEdit(li) {
    if (editingId && editingId !== li.dataset.id) finishEdit(true);
    editingId = li.dataset.id;
    li.classList.add('editing');
    li.draggable = false;
    const text = li.querySelector('.text');
    const punch = li.querySelector('.punch');
    [text, punch].forEach(el => { el.contentEditable = 'true'; });
    text.focus();
    const r = document.createRange(); r.selectNodeContents(text); r.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }

  function finishEdit(save) {
    if (!editingId) return;
    const li = document.querySelector(`.item[data-id="${editingId}"]`);
    const id = editingId;
    editingId = null;
    if (li && save) {
      const text = li.querySelector('.text').textContent.trim().replace(/\s+/g, ' ');
      const punchline = li.querySelector('.punch').textContent.trim().replace(/\s+/g, ' ');
      if (text) { actions.updateStatement(id, { text, punchline }); toast('Sparat'); return; }
    }
    renderList(store.get());
  }

  const ol = $('#list');
  ol.addEventListener('click', e => {
    const li = e.target.closest('.item');
    if (!li || !li.dataset.id) return;
    const id = li.dataset.id;
    const s = store.get();
    const q = s.statements.find(x => x.id === id);
    if (e.target.closest('.who')) {
      actions.updateStatement(id, { who: WHO[(WHO.indexOf(q.who) + 1) % WHO.length] });
    } else if (e.target.closest('.go')) {
      if (!q.enabled) actions.updateStatement(id, { enabled: true });
      actions.goto(id, 'ask');
    } else if (e.target.closest('.edit')) {
      if (editingId === id) finishEdit(true); else startEdit(li);
    } else if (e.target.closest('.up')) {
      actions.move(id, -1);
    } else if (e.target.closest('.down')) {
      actions.move(id, 1);
    } else if (e.target.closest('.del')) {
      if (confirm(`Ta bort påståendet?\n\n”${q.text}”`)) actions.removeStatement(id);
    } else if (e.target.closest('.text, .punch') && !editingId) {
      startEdit(li);
    }
  });
  ol.addEventListener('change', e => {
    const li = e.target.closest('.item');
    if (li && e.target.matches('.toggle input')) actions.updateStatement(li.dataset.id, { enabled: e.target.checked });
  });
  ol.addEventListener('keydown', e => {
    if (!editingId) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishEdit(true); }
    if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
  });
  ol.addEventListener('focusout', e => {
    if (!editingId) return;
    setTimeout(() => {
      const li = document.querySelector(`.item[data-id="${editingId}"]`);
      if (li && !li.contains(document.activeElement)) finishEdit(true);
    }, 0);
  });

  // Dra och släpp
  ol.addEventListener('dragstart', e => {
    const li = e.target.closest('.item');
    if (!li || editingId) { e.preventDefault(); return; }
    dragId = li.dataset.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
  });
  ol.addEventListener('dragover', e => {
    if (!dragId) return;
    e.preventDefault();
    ol.querySelectorAll('.drop-before').forEach(x => x.classList.remove('drop-before'));
    const li = e.target.closest('.item');
    if (li && li.dataset.id !== dragId) li.classList.add('drop-before');
  });
  ol.addEventListener('drop', e => {
    e.preventDefault();
    const li = e.target.closest('.item');
    const target = li && li.dataset.id !== dragId ? li.dataset.id : null;
    if (dragId && target) actions.moveTo(dragId, target);
  });
  ol.addEventListener('dragend', () => {
    dragId = null;
    ol.querySelectorAll('.dragging, .drop-before').forEach(x => x.classList.remove('dragging', 'drop-before'));
  });

  // Filter & massåtgärder
  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    document.querySelectorAll('#filters .chip').forEach(x => x.classList.toggle('on', x === b));
    renderList(store.get());
  });

  document.querySelector('.toolbar').addEventListener('click', e => {
    const b = e.target.closest('[data-bulk]');
    if (!b) return;
    const who = filter === 'tilda' || filter === 'oliver' ? filter : undefined;
    switch (b.dataset.bulk) {
      case 'all-on': actions.setAllEnabled(true, who); break;
      case 'all-off': actions.setAllEnabled(false, who); break;
      case 'shuffle': actions.shuffle(); toast('Ordningen slumpad'); break;
      case 'interleave': actions.interleave(); toast('Blandat och varvat'); break;
      case 'reset':
        if (confirm('Återställa alla påståenden till originalet? Egna tillägg och ändringar försvinner.')) { actions.resetStatements(); toast('Återställt'); }
        break;
    }
  });

  // Lägg till
  $('#add-form').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#add-text').value.trim();
    if (!text) return;
    const who = document.querySelector('#add-who input:checked').value;
    actions.addStatement({ text, punchline: $('#add-punch').value.trim(), who });
    $('#add-text').value = '';
    $('#add-punch').value = '';
    toast('Tillagt sist i listan');
  });

  // ---------- Livekontroller ----------
  $('#next').addEventListener('click', () => actions.next());
  $('#prev').addEventListener('click', () => actions.prev());
  $('#phases').addEventListener('click', e => {
    const b = e.target.closest('[data-phase]');
    if (b && !b.disabled) actions.setPhase(b.dataset.phase);
  });
  document.querySelectorAll('.screens [data-screen]').forEach(b => b.addEventListener('click', () => actions.showScreen(b.dataset.screen)));
  $('#pause-btn').addEventListener('click', () => actions.togglePause());
  $('#replay').addEventListener('click', () => actions.replay());
  $('#open-stage').addEventListener('click', () => {
    const w = window.open('stage.html', 'vemavoss-stage', 'popup=yes,width=1280,height=720');
    if (!w) location.href = 'stage.html';
    else toast('Dra fönstret till projektorn och tryck F för helskärm');
  });

  document.addEventListener('keydown', e => {
    const t = e.target;
    if (editingId || t.isContentEditable) return;
    if (/^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'radio')) return;
    if (t.tagName === 'BUTTON' && e.key === ' ') return; // låt knappen klickas som vanligt
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); actions.next(); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); actions.prev(); }
    else if (e.key === 'b' || e.key === 'B') actions.togglePause();
  });

  // ---------- Inställningar ----------
  document.querySelectorAll('[data-setting]').forEach(input => {
    const key = input.dataset.setting;
    input.addEventListener('change', () => {
      let v = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Math.max(1, Math.min(10, +input.value || 3)) : input.value;
      actions.updateSettings({ [key]: v });
    });
  });
  $('#theme').addEventListener('click', e => {
    const b = e.target.closest('[data-theme]');
    if (b) actions.updateSettings({ theme: b.dataset.theme });
  });
  $('#reset-all').addEventListener('click', () => {
    if (confirm('Nollställa allt? Alla ändringar, egna påståenden och inställningar försvinner.')) { actions.resetAll(); toast('Nollställt'); }
  });

  function renderSettings(s) {
    document.querySelectorAll('[data-setting]').forEach(input => {
      if (document.activeElement === input) return;
      const v = s.settings[input.dataset.setting];
      if (input.type === 'checkbox') input.checked = !!v; else input.value = v;
    });
    document.querySelectorAll('#theme [data-theme]').forEach(b => b.classList.toggle('on', b.dataset.theme === s.settings.theme));
  }

  // ---------- Status ----------
  function renderStatus() {
    $('#status').textContent = 'Synkas med scenfönster i den här webbläsaren';
  }

  function render(s) {
    renderLive(s);
    renderList(s);
    renderSettings(s);
  }

  store.subscribe(render);
  render(store.get());
  renderStatus();
})();
