/*
 * Game show-musik som genereras direkt i webbläsaren (WebAudio).
 * Inga ljudfiler, inga rättigheter, funkar offline.
 *
 * Varje låt renderas en gång till en ljudbuffert (OfflineAudioContext) och
 * loopas sedan sömlöst. Byte mellan låtar sker med en kort övertoning.
 *
 *   theme   – Showtema: studsig boogie med blås och melodi (intro/avslutning)
 *   bed     – Bakgrund: lugnare jazzig variant att prata över (påståenden)
 *   tension – Spänning: tickande nedräkningsmusik (medan gästerna viftar)
 */
(function () {
  // ---------------- Noter ----------------
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function hz(n) {
    const m = /^([A-G][b#]?)(-?\d)$/.exec(n);
    const midi = (+m[2] + 1) * 12 + NOTE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---------------- Instrument ----------------
  // Alla tar (ctx, ut, tid, ...) så att de funkar både live och offline.
  function noiseBuffer(ctx) {
    if (ctx.__noise) return ctx.__noise;
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (ctx.__noise = b);
  }

  function env(g, t, a, peak, dur, rel = 0.05) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(0.0001, t + dur, rel);
  }

  const I = {
    kick(ctx, out, t, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.35);
    },
    snare(ctx, out, t, vol = 1) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + 0.2);
      const o = ctx.createOscillator(), g2 = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      g2.gain.setValueAtTime(vol * 0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g2).connect(out); o.start(t); o.stop(t + 0.12);
    },
    rim(ctx, out, t, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'square'; o.frequency.value = 1700; f.type = 'bandpass'; f.frequency.value = 1700;
      g.gain.setValueAtTime(vol * 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 0.05);
    },
    hat(ctx, out, t, vol = 1, open = false) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
      const g = ctx.createGain(); const d = open ? 0.22 : 0.045;
      g.gain.setValueAtTime(vol * 0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + d + 0.02);
    },
    tick(ctx, out, t, vol = 1, freq = 2200) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol * 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.05);
    },
    bass(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      const o = ctx.createOscillator(), s = ctx.createOscillator();
      const lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f0;
      s.type = 'sine'; s.frequency.value = f0;
      lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(280, t + 0.18);
      const sg = ctx.createGain(); sg.gain.value = 0.9;
      o.connect(lp).connect(g); s.connect(sg).connect(g); g.connect(out);
      env(g, t, 0.008, vol * 0.42, Math.max(0.05, dur * 0.85), 0.04);
      o.start(t); s.start(t); o.stop(t + dur + 0.3); s.stop(t + dur + 0.3);
    },
    brass(ctx, out, t, notes, dur, vol = 1) {
      notes.forEach(n => {
        const f0 = hz(n);
        [-6, 6].forEach(det => {
          const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = f0; o.detune.value = det;
          lp.type = 'lowpass'; lp.Q.value = 1;
          lp.frequency.setValueAtTime(500, t);
          lp.frequency.exponentialRampToValueAtTime(2800, t + 0.05);
          lp.frequency.exponentialRampToValueAtTime(1200, t + 0.25);
          o.connect(lp).connect(g).connect(out);
          env(g, t, 0.02, vol * 0.055, dur, 0.06);
          o.start(t); o.stop(t + dur + 0.4);
        });
      });
    },
    keys(ctx, out, t, notes, dur, vol = 1) {
      notes.forEach(n => {
        const f0 = hz(n);
        const o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f0;
        m.type = 'sine'; m.frequency.value = f0 * 2; mg.gain.setValueAtTime(f0 * 0.9, t); mg.gain.exponentialRampToValueAtTime(f0 * 0.1, t + 0.4);
        m.connect(mg).connect(o.frequency);
        o.connect(g).connect(out);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * 0.09, t + 0.01);
        g.gain.exponentialRampToValueAtTime(vol * 0.03, t + 0.35);
        g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
        o.start(t); m.start(t); o.stop(t + dur + 0.5); m.stop(t + dur + 0.5);
      });
    },
    lead(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'square'; o.frequency.value = f0;
      lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.012, t + Math.min(dur, 0.3));
      lfo.connect(lg).connect(o.frequency);
      lp.type = 'lowpass'; lp.frequency.value = 2600;
      o.connect(lp).connect(g).connect(out);
      env(g, t, 0.01, vol * 0.07, dur * 0.92, 0.04);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.3); lfo.stop(t + dur + 0.3);
    },
    glock(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      [[1, 1], [2.76, 0.3], [5.4, 0.12]].forEach(([mul, amp]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f0 * mul;
        g.gain.setValueAtTime(vol * 0.12 * amp, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.4, dur) * (mul === 1 ? 1.4 : 0.6));
        o.connect(g).connect(out); o.start(t); o.stop(t + dur * 1.5 + 0.5);
      });
    },
    trombone(ctx, out, t, from, to, dur, vol = 1) {
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(hz(from), t); o.frequency.linearRampToValueAtTime(hz(to), t + dur);
      lfo.frequency.value = 6; lg.gain.value = 4; lfo.connect(lg).connect(o.frequency);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1500, t + 0.1); lp.frequency.linearRampToValueAtTime(600, t + dur);
      o.connect(lp).connect(g).connect(out);
      env(g, t, 0.03, vol * 0.2, dur * 0.95, 0.08);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.4); lfo.stop(t + dur + 0.4);
    }
  };

  // ---------------- Låtar ----------------
  // play(ctx, out, t0, S) där S = längd på en sextondel i sekunder
  const TRACKS = {
    theme: {
      bpm: 132, bars: 8,
      play(ctx, out, t0, S) {
        const at = step => t0 + step * S;
        // I7 – VI7 – ii7 – V7, klassiskt frågesport-boogie
        const chords = [
          { bass: ['C2', 'E2', 'G2', 'A2', 'Bb2', 'A2', 'G2', 'E2'], stab: ['E4', 'G4', 'Bb4', 'C5'] },
          { bass: ['A1', 'C#2', 'E2', 'F#2', 'G2', 'F#2', 'E2', 'C#2'], stab: ['C#4', 'E4', 'G4', 'A4'] },
          { bass: ['D2', 'F2', 'A2', 'B2', 'C3', 'B2', 'A2', 'F2'], stab: ['D4', 'F4', 'A4', 'C5'] },
          { bass: ['G1', 'B1', 'D2', 'E2', 'F2', 'E2', 'D2', 'B1'], stab: ['D4', 'F4', 'G4', 'B4'] }
        ];
        for (let bar = 0; bar < 8; bar++) {
          const c = chords[bar % 4], b0 = bar * 16;
          c.bass.forEach((n, i) => I.bass(ctx, out, at(b0 + i * 2), n, S * 1.8, 1));
          I.brass(ctx, out, at(b0), c.stab, S * 1.5, 1.1);
          I.brass(ctx, out, at(b0 + 6), c.stab, S * 1.2, 0.8);
          I.brass(ctx, out, at(b0 + 10), c.stab, S * 1.2, 0.7);
          [0, 8].forEach(s => I.kick(ctx, out, at(b0 + s), 0.9));
          [4, 12].forEach(s => I.snare(ctx, out, at(b0 + s), 0.55));
          for (let s = 0; s < 16; s += 2) I.hat(ctx, out, at(b0 + s), s % 4 ? 0.9 : 0.5, s === 14);
        }
        // Melodi: [steg, ton, längd i sextondelar]
        const mel = [
          [0, 'E5', 2], [2, 'G5', 2], [4, 'A5', 2], [6, 'G5', 2], [8, 'E5', 4], [12, 'C5', 4],
          [16, 'C#5', 2], [18, 'E5', 2], [20, 'A5', 2], [22, 'G5', 2], [24, 'E5', 6],
          [32, 'F5', 2], [34, 'A5', 2], [36, 'C6', 2], [38, 'A5', 2], [40, 'F5', 2], [42, 'D5', 2], [44, 'F5', 4],
          [48, 'G5', 4], [52, 'F5', 2], [54, 'D5', 2], [56, 'B4', 4], [60, 'D5', 4],
          [64, 'E5', 2], [66, 'G5', 2], [68, 'C6', 4], [72, 'Bb5', 2], [74, 'A5', 2], [76, 'G5', 4],
          [80, 'A5', 2], [82, 'G5', 2], [84, 'E5', 2], [86, 'C#5', 2], [88, 'E5', 8],
          [96, 'D6', 2], [98, 'C6', 2], [100, 'A5', 2], [102, 'F5', 2], [104, 'G5', 2], [106, 'A5', 2], [108, 'B5', 4],
          [112, 'D6', 2], [114, 'B5', 2], [116, 'G5', 2], [118, 'F5', 2], [120, 'D5', 2], [122, 'B4', 2], [124, 'D5', 2], [126, 'D#5', 2]
        ];
        mel.forEach(([s, n, l]) => I.lead(ctx, out, at(s), n, l * S, 1));
        // lite glitter i slutet av varje fras
        [[60, 'G6'], [62, 'B6'], [124, 'G6'], [126, 'D7']].forEach(([s, n]) => I.glock(ctx, out, at(s), n, S * 2, 0.8));
      }
    },

    bed: {
      bpm: 104, bars: 8, swing: 0.18,
      play(ctx, out, t0, S, swing) {
        // swing: förskjut "och"-åttondelarna lite
        const at = step => t0 + step * S + (step % 4 === 2 ? swing * S * 2 : 0);
        const chords = [
          { walk: ['C2', 'E2', 'G2', 'A2'], keys: ['E4', 'G4', 'B4', 'D5'] },
          { walk: ['A1', 'C2', 'E2', 'G2'], keys: ['E4', 'G4', 'C5'] },
          { walk: ['D2', 'F2', 'A2', 'C3'], keys: ['F4', 'A4', 'C5', 'E5'] },
          { walk: ['G1', 'B1', 'D2', 'F2'], keys: ['F4', 'B4', 'E5'] }
        ];
        for (let bar = 0; bar < 8; bar++) {
          const c = chords[bar % 4], b0 = bar * 16;
          c.walk.forEach((n, i) => I.bass(ctx, out, at(b0 + i * 4), n, S * 3.2, 0.85));
          I.keys(ctx, out, at(b0 + 4), c.keys, S * 1.6, 1);
          I.keys(ctx, out, at(b0 + 10), c.keys, S * 1.2, 0.7);
          I.kick(ctx, out, at(b0), 0.45);
          I.kick(ctx, out, at(b0 + 10), 0.25);
          [4, 12].forEach(s => I.rim(ctx, out, at(b0 + s), 0.8));
          for (let s = 0; s < 16; s += 2) I.hat(ctx, out, at(b0 + s), s % 4 ? 0.35 : 0.55);
        }
        // Små klockspelsfraser som påminner om frågesport
        [[24, 'G5'], [26, 'E5'], [28, 'C6'],
         [56, 'A5'], [58, 'F5'], [60, 'D6'],
         [88, 'G5'], [90, 'E5'], [92, 'C6'], [94, 'E6'],
         [120, 'D6'], [122, 'B5'], [124, 'G5'], [126, 'F5']].forEach(([s, n]) => I.glock(ctx, out, at(s), n, S * 2, 0.9));
      }
    },

    tension: {
      bpm: 138, bars: 4,
      play(ctx, out, t0, S) {
        const at = step => t0 + step * S;
        const roots = ['A1', 'A1', 'Bb1', 'B1'];
        const chords = [['A3', 'C4', 'E4'], ['A3', 'C4', 'E4'], ['Bb3', 'D4', 'F4'], ['B3', 'D4', 'F4']];
        for (let bar = 0; bar < 4; bar++) {
          const b0 = bar * 16;
          for (let s = 0; s < 16; s++) I.bass(ctx, out, at(b0 + s), roots[bar], S * 0.7, s % 4 ? 0.55 : 0.8);
          for (let s = 0; s < 16; s += 4) I.kick(ctx, out, at(b0 + s), 0.7);
          for (let s = 0; s < 16; s += 2) I.tick(ctx, out, at(b0 + s), s % 4 ? 0.6 : 1, s % 4 ? 1600 : 2300);
          I.brass(ctx, out, at(b0), chords[bar], S * 3, 0.9);
          I.brass(ctx, out, at(b0 + 8), chords[bar], S * 2, 0.6);
        }
        // Virvel som växer mot slutet av loopen
        for (let s = 48; s < 64; s++) I.snare(ctx, out, at(s), 0.15 + (s - 48) * 0.03);
        [[12, 'E6'], [28, 'E6'], [44, 'F6'], [60, 'F#6']].forEach(([s, n]) => I.glock(ctx, out, at(s), n, S * 2, 0.7));
      }
    }
  };

  // ---------------- Rendering & uppspelning ----------------
  const cache = {};

  function render(name, sampleRate) {
    if (cache[name]) return cache[name];
    const tr = TRACKS[name];
    const S = 60 / tr.bpm / 4;
    const loopLen = tr.bars * 16 * S;
    const tail = 2;
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new OC(2, Math.ceil((loopLen + tail) * sampleRate), sampleRate);
    const comp = off.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(off.destination);
    // lite stereobredd: två lätt fördröjda kanaler
    const bus = off.createGain(); bus.gain.value = 0.9;
    const split = off.createChannelMerger(2);
    const dl = off.createDelay(); dl.delayTime.value = 0.011;
    bus.connect(split, 0, 0); bus.connect(dl).connect(split, 0, 1);
    split.connect(comp);
    tr.play(off, bus, 0.001, S, tr.swing || 0);
    cache[name] = off.startRendering().then(buf => {
      // Vik in svansen i början så att loopen blir sömlös
      const n = Math.round(loopLen * sampleRate);
      const out = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate });
      for (let ch = 0; ch < 2; ch++) {
        const src = buf.getChannelData(ch), dst = out.getChannelData(ch);
        dst.set(src.subarray(0, n));
        for (let i = n; i < src.length; i++) dst[i - n] += src[i];
      }
      // Normalisera så att inget klipper och låtarna låter lika starka
      let peak = 0;
      for (let ch = 0; ch < 2; ch++) {
        const d = out.getChannelData(ch);
        for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      }
      const k = peak > 0 ? 0.85 / peak : 1;
      for (let ch = 0; ch < 2; ch++) {
        const d = out.getChannelData(ch);
        for (let i = 0; i < d.length; i++) d[i] *= k;
      }
      return out;
    });
    return cache[name];
  }

  let ctx = null, master = null, current = null, wanted = null, volume = 0.5, duckUntil = 0;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    ctx.onstatechange = () => VAO.music.onstate && VAO.music.onstate(ctx.state);
    return ctx;
  }

  async function switchTo(name) {
    if (!ensure()) return;
    if (current && current.name === name) return;
    const old = current;
    current = name ? { name } : null;
    const t = ctx.currentTime;
    if (old && old.gain) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + 0.6);
      const src = old.src;
      setTimeout(() => { try { src.stop(); } catch (e) {} }, 800);
    }
    if (!name) return;
    const buf = await render(name, ctx.sampleRate);
    if (!current || current.name !== name) return; // bytt igen under tiden
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(TRACK_LEVEL[name] || 1, now + (old ? 0.35 : 1.2));
    src.connect(g).connect(master);
    src.start(now);
    current.src = src; current.gain = g;
  }

  // Bakgrunden ska ligga lite lägre så att man hör toastmastern
  const TRACK_LEVEL = { theme: 1, bed: 0.7, tension: 0.9 };

  function applyVolume() {
    if (!master) return;
    const t = ctx.currentTime;
    const v = Date.now() < duckUntil ? volume * 0.35 : volume;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(v, t, 0.15);
  }

  VAO.music = {
    tracks: Object.keys(TRACKS),
    onstate: null,
    context: ensure,
    get state() { return ctx ? ctx.state : 'none'; },
    unlock() { if (ensure() && ctx.state !== 'running') ctx.resume().catch(() => {}); },
    /** Spela en låt (eller null för tystnad) på given volym 0–1 */
    set(name, vol) {
      volume = Math.max(0, Math.min(1, vol));
      if (name !== wanted) { wanted = name; switchTo(name); }
      applyVolume();
    },
    /** Sänk musiken en stund, t.ex. under avslöjandets fanfar */
    duck(ms = 2500) {
      duckUntil = Date.now() + ms;
      applyVolume();
      setTimeout(applyVolume, ms + 20);
    },
    /** Förrendera låtarna i förväg så att bytena går direkt */
    preload() { if (ensure()) Object.keys(TRACKS).forEach(n => render(n, ctx.sampleRate)); },
    // Instrumenten används också av ljudeffekterna
    I, hz,
    render
  };
})();
