/* Konfetti (canvas) och små ljudeffekter (WebAudio) – inga externa filer. */
(function () {
  // ---------------- Konfetti ----------------
  let canvas, ctx, parts = [], running = false, dpr = 1;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.getElementById('confetti');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti';
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }

  function heart(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.3);
    c.bezierCurveTo(0, 0, -s * 0.5, 0, -s * 0.5, s * 0.3);
    c.bezierCurveTo(-s * 0.5, s * 0.6, 0, s * 0.8, 0, s);
    c.bezierCurveTo(0, s * 0.8, s * 0.5, s * 0.6, s * 0.5, s * 0.3);
    c.bezierCurveTo(s * 0.5, 0, 0, 0, 0, s * 0.3);
    c.fill();
  }

  function spawn(opts) {
    const { x, y, count = 120, colors, spread = Math.PI * 2, angle = -Math.PI / 2, power = 1, hearts = 0.25 } = opts;
    const unit = Math.min(innerWidth, innerHeight) / 100;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = (0.6 + Math.random() * 1.1) * unit * 1.9 * power;
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        size: unit * (0.7 + Math.random() * 1.1),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        tilt: Math.random() * Math.PI,
        vt: 0.05 + Math.random() * 0.12,
        color: colors[(Math.random() * colors.length) | 0],
        shape: Math.random() < hearts ? 'heart' : Math.random() < 0.5 ? 'rect' : 'circle',
        life: 0,
        max: 160 + Math.random() * 120
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function tick() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    const unit = Math.min(innerWidth, innerHeight) / 100;
    parts = parts.filter(p => p.life < p.max && p.y < innerHeight + 50);
    for (const p of parts) {
      p.life++;
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + unit * 0.045;
      p.x += p.vx + Math.sin(p.life * 0.05 + p.tilt) * 0.4;
      p.y += p.vy;
      p.rot += p.vr;
      p.tilt += p.vt;
      const fade = Math.min(1, (p.max - p.life) / 40);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'heart') {
        heart(ctx, p.size * 1.4);
      } else if (p.shape === 'rect') {
        ctx.scale(1, Math.cos(p.tilt));
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.scale(Math.cos(p.tilt), 1);
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  const GOLD = ['#b08a45', '#d9bb7f', '#f1dfb4', '#fffaf0'];

  VAO.confetti = {
    burst(x, y, colors = GOLD, opts = {}) {
      ensureCanvas();
      spawn({ x, y, colors, ...opts });
    },
    fromElement(el, colors, opts = {}) {
      ensureCanvas();
      const r = el.getBoundingClientRect();
      spawn({ x: r.left + r.width / 2, y: r.top + r.height * 0.35, colors, count: 140, ...opts });
    },
    cannons(colors = GOLD) {
      ensureCanvas();
      spawn({ x: 0, y: innerHeight, colors, count: 120, angle: -Math.PI / 3, spread: 0.7, power: 1.5 });
      spawn({ x: innerWidth, y: innerHeight, colors, count: 120, angle: -Math.PI * 2 / 3, spread: 0.7, power: 1.5 });
    },
    clear() { parts = []; }
  };

  // ---------------- Ljud ----------------
  // Delar AudioContext med musiken (js/music.js) så att ett klick låser upp båda.
  function ac() {
    const a = VAO.music ? VAO.music.context() : null;
    if (a && a.state === 'suspended') a.resume().catch(() => {});
    return a;
  }

  function bell(freq, when, dur = 1.6, vol = 0.18, type = 'sine') {
    const a = ac(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator();
    const o2 = a.createOscillator();
    const g = a.createGain();
    o.type = type; o.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2.01;
    const g2 = a.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(a.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  // Spela ett instrument från musikmotorn direkt till högtalarna
  function inst(name, when, ...args) {
    const a = ac(); if (!a || !VAO.music) return;
    const out = a.createGain(); out.gain.value = 1.6; out.connect(a.destination);
    VAO.music.I[name](a, out, a.currentTime + when, ...args);
  }

  VAO.sound = {
    enabled: true,
    unlock() { ac(); },
    tick() { if (this.enabled) bell(880, 0, 0.25, 0.12, 'triangle'); },
    go() {
      if (!this.enabled) return;
      bell(1318.5, 0, 0.5, 0.14, 'triangle');
      inst('snare', 0, 0.6); inst('kick', 0, 1);
    },
    // "Ta-daa!" – blåsackord + klockor
    reveal() {
      if (!this.enabled) return;
      inst('brass', 0, ['G4', 'C5', 'E5'], 0.12, 1.4);
      inst('brass', 0.16, ['C5', 'E5', 'G5', 'C6'], 1.1, 1.6);
      inst('kick', 0.16, 1);
      inst('snare', 0.16, 0.7);
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, 0.2 + i * 0.07, 1.6, 0.07));
    },
    // Sorglig trombon för påhittade påståenden
    fake() {
      if (!this.enabled) return;
      [['G3', 'G3', 0.42], ['F#3', 'F#3', 0.42], ['F3', 'F3', 0.42], ['E3', 'D#3', 1.3]]
        .reduce((w, [a, b, d]) => { inst('trombone', w, a, b, d, 1.2); return w + d + 0.06; }, 0);
    },
    fanfare() {
      if (!this.enabled) return;
      [[['C5', 'E5', 'G5'], 0, 0.14], [['C5', 'E5', 'G5'], 0.18, 0.14], [['C5', 'E5', 'G5'], 0.36, 0.14],
       [['C5', 'F5', 'A5'], 0.54, 0.5], [['D5', 'G5', 'B5'], 1.08, 0.3], [['E5', 'G5', 'C6'], 1.44, 1.4]]
        .forEach(([n, w, d]) => inst('brass', w, n, d, 1.5));
      [0, 0.36, 0.54, 1.08, 1.44].forEach(w => inst('kick', w, 0.9));
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, 1.44 + i * 0.08, 1.8, 0.06));
    }
  };
})();
