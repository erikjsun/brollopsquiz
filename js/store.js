/*
 * Delat tillstånd mellan kontrollpanelen och scenvyn.
 *
 * Allt sparas i localStorage och skickas mellan flikar/fönster i samma
 * webbläsare via BroadcastChannel + storage-eventet. Kör alltså kontrollpanel
 * och scen i samma webbläsare på samma dator (t.ex. laptop + projektor).
 */
(function () {
  const KEY = 'vemavoss-state-v1';
  const CHANNEL = 'vemavoss';

  let state = load();
  const listeners = new Set();
  let channel = null;
  try { channel = new BroadcastChannel(CHANNEL); } catch (e) { /* äldre webbläsare */ }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Slumpad ordning där samma person aldrig kommer mer än två gånger i rad
  // (så långt det går – är det många fler om en person blir det ibland fler).
  function interleaved(list) {
    const key = x => (x.who === 'tilda' || x.who === 'oliver' ? x.who : 'other');
    const buckets = {};
    shuffled(list).forEach(x => (buckets[key(x)] = buckets[key(x)] || []).push(x));
    const out = [];
    while (out.length < list.length) {
      const n = out.length;
      const blocked = n > 1 && key(out[n - 1]) === key(out[n - 2]) ? key(out[n - 1]) : null;
      let pool = Object.entries(buckets).filter(([k, v]) => v.length && k !== blocked);
      if (!pool.length) pool = Object.entries(buckets).filter(([, v]) => v.length);
      // viktat efter hur många som är kvar, så att ingen hamnar i klump på slutet
      let r = Math.random() * pool.reduce((sum, [, v]) => sum + v.length, 0);
      let pick = pool[pool.length - 1][0];
      for (const [k, v] of pool) { r -= v.length; if (r < 0) { pick = k; break; } }
      out.push(buckets[pick].shift());
    }
    return out;
  }

  function defaults() {
    return {
      v: 1,
      statements: interleaved(VAO.DEFAULT_STATEMENTS.map(s => ({ punchline: '', ...clone(s), enabled: true, custom: false }))),
      settings: { theme: 'light', ...clone(VAO.DEFAULT_SETTINGS) },
      live: { screen: 'intro', id: null, phase: 'ask', paused: false, t: Date.now() },
      rev: 0
    };
  }

  function load() {
    const base = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        // Spara direkt så att scen och kontrollpanel får samma slumpade ordning
        localStorage.setItem(KEY, JSON.stringify(base));
        return base;
      }
      const saved = JSON.parse(raw);
      if (!saved || saved.v !== 1) return base;
      return {
        ...base,
        ...saved,
        settings: { ...base.settings, ...(saved.settings || {}) },
        live: { ...base.live, ...(saved.live || {}) }
      };
    } catch (e) {
      return base;
    }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* privat läge e.d. */ }
    if (channel) { try { channel.postMessage(state); } catch (e) {} }
  }

  function emit(remote) { listeners.forEach(fn => fn(state, remote)); }

  function receive(next) {
    if (!next || next.v !== 1) return;
    if (next.rev === state.rev && JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    emit(true);
  }

  if (channel) channel.onmessage = e => receive(e.data);
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    try { receive(JSON.parse(e.newValue)); } catch (err) {}
  });

  function update(mutator) {
    const next = clone(state);
    mutator(next);
    next.rev = (state.rev || 0) + 1;
    state = next;
    persist();
    emit(false);
  }

  // ---------- Hjälpfunktioner ----------
  function playlist(s = state) { return s.statements.filter(x => x.enabled); }

  function steps(s = state) {
    const out = [{ screen: 'intro' }];
    playlist(s).forEach(q => {
      out.push({ screen: 'question', id: q.id, phase: 'ask' });
      if (s.settings.countdown) out.push({ screen: 'question', id: q.id, phase: 'vote' });
      out.push({ screen: 'question', id: q.id, phase: 'reveal' });
    });
    out.push({ screen: 'outro' });
    return out;
  }

  function stepIndex(s = state) {
    const all = steps(s);
    const l = s.live;
    if (l.screen !== 'question') return all.findIndex(x => x.screen === l.screen);
    let i = all.findIndex(x => x.id === l.id && x.phase === l.phase);
    if (i === -1) i = all.findIndex(x => x.id === l.id && x.phase === 'reveal');
    return i;
  }

  function setLive(s, step) {
    s.live = { ...s.live, screen: step.screen, id: step.id || null, phase: step.phase || 'ask', paused: false, t: Date.now() };
  }

  function current(s = state) {
    if (s.live.screen !== 'question') return null;
    return s.statements.find(x => x.id === s.live.id) || null;
  }

  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- Åtgärder ----------
  const actions = {
    next() {
      update(s => {
        if (s.live.paused) { s.live.paused = false; s.live.t = Date.now(); return; }
        const all = steps(s);
        const i = stepIndex(s);
        // Om aktuellt påstående har tagits bort ur listan: gå till första frågan
        const target = i === -1 ? all[1] : all[Math.min(i + 1, all.length - 1)];
        if (target) setLive(s, target);
      });
    },
    prev() {
      update(s => {
        if (s.live.paused) { s.live.paused = false; s.live.t = Date.now(); return; }
        const all = steps(s);
        const i = stepIndex(s);
        const target = i <= 0 ? all[0] : all[i - 1];
        setLive(s, target);
      });
    },
    goto(id, phase = 'ask') {
      update(s => setLive(s, { screen: 'question', id, phase }));
    },
    setPhase(phase) {
      update(s => {
        if (s.live.screen !== 'question') return;
        s.live.phase = phase; s.live.paused = false; s.live.t = Date.now();
      });
    },
    showScreen(screen) { update(s => setLive(s, { screen })); },
    togglePause() { update(s => { s.live.paused = !s.live.paused; s.live.t = Date.now(); }); },
    replay() { update(s => { s.live.t = Date.now(); }); },

    updateStatement(id, patch) {
      update(s => {
        const q = s.statements.find(x => x.id === id);
        if (q) Object.assign(q, patch);
      });
    },
    addStatement(data) {
      const id = uid();
      update(s => s.statements.push({ id, who: 'tilda', text: '', punchline: '', enabled: true, custom: true, ...data }));
      return id;
    },
    removeStatement(id) {
      update(s => { s.statements = s.statements.filter(x => x.id !== id); });
    },
    move(id, delta) {
      update(s => {
        const i = s.statements.findIndex(x => x.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= s.statements.length) return;
        const [item] = s.statements.splice(i, 1);
        s.statements.splice(j, 0, item);
      });
    },
    moveTo(id, beforeId) {
      update(s => {
        const i = s.statements.findIndex(x => x.id === id);
        if (i < 0) return;
        const [item] = s.statements.splice(i, 1);
        const j = beforeId ? s.statements.findIndex(x => x.id === beforeId) : -1;
        if (j < 0) s.statements.push(item); else s.statements.splice(j, 0, item);
      });
    },
    setAllEnabled(value, who) {
      update(s => s.statements.forEach(x => { if (!who || x.who === who) x.enabled = value; }));
    },
    shuffle() {
      update(s => { s.statements = shuffled(s.statements); });
    },
    // Blanda, men varva så att samma person inte kommer för många gånger i rad
    interleave() {
      update(s => { s.statements = interleaved(s.statements); });
    },
    resetStatements() {
      update(s => {
        s.statements = defaults().statements;
        setLive(s, { screen: 'intro' });
      });
    },
    updateSettings(patch) { update(s => Object.assign(s.settings, patch)); },
    resetAll() {
      try { localStorage.removeItem(KEY); } catch (e) {}
      const fresh = defaults();
      update(s => Object.assign(s, fresh));
    }
  };

  VAO.store = {
    get: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    playlist, steps, stepIndex, current
  };
  VAO.actions = actions;
})();
