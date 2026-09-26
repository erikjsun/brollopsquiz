/*
 * Game show-musik som genereras direkt i webbläsaren (WebAudio).
 * Inga ljudfiler, inga rättigheter, funkar offline.
 *
 * Varje låt renderas en gång till en ljudbuffert (OfflineAudioContext) och
 * loopas sedan sömlöst. Byte mellan låtar sker med en kort övertoning.
 *
 * Fem musikstilar (se PACKS längre ner), var och en med tre låtar:
 *   theme   – Showtema (intro och avslutning)
 *   bed     – Bakgrund att prata över (medan påståendet läses)
 *   tension – Spänning (medan gästerna viftar)
 */
(function () {
  // ---------------- Noter ----------------
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function midi(n) {
    const m = /^([A-G][b#]?)(-?\d)$/.exec(n);
    return (+m[2] + 1) * 12 + NOTE[m[1]];
  }
  const hz = n => 440 * Math.pow(2, ((typeof n === 'number' ? n : midi(n)) - 69) / 12);

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

  function noise(ctx, out, t, { type = 'highpass', freq = 7000, q = 0.7, vol = 0.3, dur = 0.05 }) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
    n.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(out); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.02);
  }

  const I = {
    kick(ctx, out, t, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
      noise(ctx, out, t, { type: 'highpass', freq: 3000, vol: vol * 0.12, dur: 0.012 }); // klick i anslaget
    },
    snare(ctx, out, t, vol = 1) {
      noise(ctx, out, t, { type: 'bandpass', freq: 2200, q: 0.6, vol: vol * 0.7, dur: 0.17 });
      const o = ctx.createOscillator(), g2 = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
      g2.gain.setValueAtTime(vol * 0.45, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g2).connect(out); o.start(t); o.stop(t + 0.12);
    },
    clap(ctx, out, t, vol = 1) {
      [0, 0.011, 0.023].forEach(d => noise(ctx, out, t + d, { type: 'bandpass', freq: 1300, q: 1.2, vol: vol * 0.55, dur: 0.02 }));
      noise(ctx, out, t + 0.03, { type: 'bandpass', freq: 1300, q: 1, vol: vol * 0.45, dur: 0.16 });
    },
    rim(ctx, out, t, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'square'; o.frequency.value = 1700; f.type = 'bandpass'; f.frequency.value = 1700;
      g.gain.setValueAtTime(vol * 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 0.05);
    },
    hat(ctx, out, t, vol = 1, open = false) {
      noise(ctx, out, t, { freq: 8000, vol: vol * 0.3, dur: open ? 0.2 : 0.04 });
    },
    shaker(ctx, out, t, vol = 1) {
      noise(ctx, out, t, { type: 'bandpass', freq: 6500, q: 0.8, vol: vol * 0.22, dur: 0.06 });
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
      lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(420, t + 0.12);
      const sg = ctx.createGain(); sg.gain.value = 0.8;
      o.connect(lp).connect(g); s.connect(sg).connect(g); g.connect(out);
      env(g, t, 0.006, vol * 0.4, Math.max(0.04, dur * 0.8), 0.03);
      o.start(t); s.start(t); o.stop(t + dur + 0.3); s.stop(t + dur + 0.3);
    },
    brass(ctx, out, t, notes, dur, vol = 1) {
      notes.forEach(n => {
        const f0 = hz(n);
        [-9, 0, 9].forEach(det => {
          const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = f0; o.detune.value = det;
          // liten "fall-in" uppåt i tonhöjd som riktiga blås
          o.detune.setValueAtTime(det - 40, t); o.detune.linearRampToValueAtTime(det, t + 0.04);
          lp.type = 'lowpass'; lp.Q.value = 1.5;
          lp.frequency.setValueAtTime(700, t);
          lp.frequency.exponentialRampToValueAtTime(5200, t + 0.035);
          lp.frequency.exponentialRampToValueAtTime(2200, t + 0.22);
          o.connect(lp).connect(g).connect(out);
          env(g, t, 0.012, vol * 0.042, dur, 0.05);
          o.start(t); o.stop(t + dur + 0.4);
        });
      });
    },
    keys(ctx, out, t, notes, dur, vol = 1) {
      notes.forEach(n => {
        const f0 = hz(n);
        const o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f0;
        m.type = 'sine'; m.frequency.value = f0 * 2; mg.gain.setValueAtTime(f0 * 1.2, t); mg.gain.exponentialRampToValueAtTime(f0 * 0.15, t + 0.3);
        m.connect(mg).connect(o.frequency);
        o.connect(g).connect(out);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * 0.09, t + 0.008);
        g.gain.exponentialRampToValueAtTime(vol * 0.03, t + 0.3);
        g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
        o.start(t); m.start(t); o.stop(t + dur + 0.5); m.stop(t + dur + 0.5);
      });
    },
    // Marimba/pluck – ljus och studsig
    marimba(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      [[1, 1, 0.5], [4, 0.25, 0.08], [10, 0.06, 0.03]].forEach(([mul, amp, dec]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f0 * mul;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * 0.2 * amp, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur + 0.1, 0.25) + dec);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.8);
      });
    },
    lead(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(6500, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.2);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.01, t + Math.min(dur, 0.35));
      lfo.connect(lg);
      // två lätt osynkade fyrkantsvågor + en oktav sinus ovanpå = ljus, glad lead
      [[-7, 'square', 1], [7, 'square', 1], [0, 'sine', 0.6]].forEach(([det, type, amp], i) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; o.frequency.value = i === 2 ? f0 * 2 : f0; o.detune.value = det;
        lg.connect(o.frequency);
        og.gain.value = amp;
        o.connect(og).connect(lp);
        o.start(t); o.stop(t + dur + 0.3);
      });
      lp.connect(g).connect(out);
      env(g, t, 0.006, vol * 0.05, dur * 0.9, 0.035);
      lfo.start(t); lfo.stop(t + dur + 0.3);
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

  // ---------------- Knasiga instrument ----------------
  Object.assign(I, {
    // Oompah-tuba: mjuk, fet och lite "blöt" i anslaget
    tuba(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      const o = ctx.createOscillator(), s = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; s.type = 'sine';
      [o, s].forEach(x => { x.frequency.setValueAtTime(f0 * 0.94, t); x.frequency.exponentialRampToValueAtTime(f0, t + 0.05); });
      lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.04); lp.frequency.exponentialRampToValueAtTime(420, t + 0.2);
      const sg = ctx.createGain(); sg.gain.value = 0.7;
      o.connect(lp).connect(g); s.connect(sg).connect(g); g.connect(out);
      env(g, t, 0.02, vol * 0.45, dur * 0.75, 0.04);
      o.start(t); s.start(t); o.stop(t + dur + 0.3); s.stop(t + dur + 0.3);
    },
    // Kazoo: surrig, nasal melodi med "scoop" upp till tonen
    kazoo(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), sum = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'square';
      [o, o2].forEach(x => { x.frequency.setValueAtTime(f0 * 0.93, t); x.frequency.exponentialRampToValueAtTime(f0, t + 0.045); });
      o2.detune.value = 12;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 7; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.025, t + Math.min(dur, 0.25));
      lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      const o2g = ctx.createGain(); o2g.gain.value = 0.5;
      o.connect(sum); o2.connect(o2g).connect(sum);
      // formanter = "näsa"
      [[650, 4, 1], [1250, 5, 0.8], [2600, 6, 0.5]].forEach(([f, q, a]) => {
        const bp = ctx.createBiquadFilter(), bg = ctx.createGain();
        bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; bg.gain.value = a;
        sum.connect(bp).connect(bg).connect(g);
      });
      g.connect(out);
      env(g, t, 0.015, vol * 0.5, dur * 0.88, 0.03);
      [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.3); });
    },
    // Honky-tonk-piano: två lite ostämda strängar per ton
    honky(ctx, out, t, notes, dur, vol = 1) {
      notes.forEach(n => {
        const f0 = hz(n);
        [-14, 12].forEach(det => {
          const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
          o.type = 'triangle'; o.frequency.value = f0; o.detune.value = det;
          lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
          o.connect(lp).connect(g).connect(out);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(vol * 0.07, t + 0.004);
          g.gain.exponentialRampToValueAtTime(vol * 0.015, t + 0.25);
          g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
          o.start(t); o.stop(t + dur + 0.4);
        });
      });
    },
    // Fagott: studsig, staccato "bopp"
    bassoon(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(f0 * 1.03, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.03);
      lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 3;
      bp.type = 'peaking'; bp.frequency.value = 500; bp.gain.value = 8;
      o.connect(lp).connect(bp).connect(g).connect(out);
      env(g, t, 0.01, vol * 0.22, dur * 0.6, 0.03);
      o.start(t); o.stop(t + dur + 0.3);
    },
    // Visselglidare (slide whistle)
    slide(ctx, out, t, from, to, dur, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
      lfo.frequency.value = 9; lg.gain.value = from * 0.02; lfo.connect(lg).connect(o.frequency);
      o.connect(g).connect(out);
      env(g, t, 0.03, vol * 0.22, dur, 0.04);
      noise(ctx, out, t, { type: 'bandpass', freq: Math.sqrt(from * to), q: 2, vol: vol * 0.05, dur }); // lite luft
      [o, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.2); });
    },
    // Boing! – fjäder/mungiga
    boing(ctx, out, t, freq = 220, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq * 0.6, t);
      o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(freq, t + 0.5);
      lfo.frequency.setValueAtTime(22, t); lfo.frequency.exponentialRampToValueAtTime(8, t + 0.6);
      lg.gain.setValueAtTime(freq * 0.25, t); lg.gain.exponentialRampToValueAtTime(freq * 0.02, t + 0.6);
      lfo.connect(lg).connect(o.frequency);
      o.connect(g).connect(out);
      g.gain.setValueAtTime(vol * 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      [o, lfo].forEach(x => { x.start(t); x.stop(t + 0.7); });
    },
    // Cykeltuta
    honk(ctx, out, t, vol = 1, pitch = 1) {
      const g = ctx.createGain(), bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.2;
      [392, 415].forEach(f => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(f * pitch * 0.9, t); o.frequency.linearRampToValueAtTime(f * pitch, t + 0.04);
        o.connect(bp); o.start(t); o.stop(t + 0.22);
      });
      bp.connect(g).connect(out);
      env(g, t, 0.01, vol * 0.4, 0.14, 0.03);
    },
    // Gnisslig gummileksak
    squeak(ctx, out, t, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(2800, t + 0.05); o.frequency.exponentialRampToValueAtTime(1900, t + 0.12);
      o.connect(g).connect(out);
      env(g, t, 0.008, vol * 0.18, 0.1, 0.02);
      o.start(t); o.stop(t + 0.2);
    },
    woodblock(ctx, out, t, vol = 1, freq = 1000) {
      const o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.setValueAtTime(freq * 1.2, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.01);
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
      o.connect(bp).connect(g).connect(out);
      g.gain.setValueAtTime(vol * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.start(t); o.stop(t + 0.08);
    },
    // Snabb xylofon-glissando
    gliss(ctx, out, t, notes, step, vol = 1) {
      notes.forEach((n, i) => I.marimba(ctx, out, t + i * step, n, step * 2, vol));
    }
  });

  // ---------------- Låtar ----------------
  // play(ctx, mix, t0, S): mix.ch(pan, reverb) ger en kanal, S = en sextondel i sekunder
  const up = (n, semis) => midi(n) + semis; // transponera (ger midi-nummer)
  const C_UP = ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'];

  const CIRCUS = {
    // Cirkuspolka med kazoo, tuba och honky-tonk-piano
    theme: {
      bpm: 160, bars: 8, reverb: 0.18,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const tubaCh = mix.ch(0, 0), pianoL = mix.ch(-0.3, 0.2), pianoR = mix.ch(0.3, 0.2), kazooCh = mix.ch(0.05, 0.22);
        const drums = mix.ch(0, 0.06), blockL = mix.ch(-0.6, 0.1), blockR = mix.ch(0.6, 0.1), sfxL = mix.ch(-0.5, 0.25), sfxR = mix.ch(0.5, 0.25);
        const C = { bass: ['C2', 'G1'], chord: ['E4', 'G4', 'C5'] };
        const G7 = { bass: ['G1', 'D2'], chord: ['F4', 'G4', 'B4', 'D5'] };
        const F = { bass: ['F1', 'C2'], chord: ['F4', 'A4', 'C5'] };
        const bars = [C, G7, G7, C, C, F, G7, C];
        bars.forEach((b, bar) => {
          const b0 = bar * 16;
          // OOM-pah OOM-pah
          // grundton på ett och tre, kvint på två och fyra
          [0, 4, 8, 12].forEach((s, i) => I.tuba(ctx, tubaCh, at(b0 + s), b.bass[i % 2], S * 2.2, i % 2 ? 0.8 : 1));
          [2, 6, 10, 14].forEach((s, i) => I.honky(ctx, i % 2 ? pianoR : pianoL, at(b0 + s), b.chord, S * 1.2, 1));
          [0, 8].forEach(s => I.kick(ctx, drums, at(b0 + s), 0.6));
          [4, 12].forEach(s => I.snare(ctx, drums, at(b0 + s), 0.35));
          // klipp-klopp på träblock
          [2, 7, 10, 15].forEach((s, i) => I.woodblock(ctx, i % 2 ? blockR : blockL, at(b0 + s), 0.5, i % 2 ? 1250 : 850));
        });
        const mel = [
          [0, 'E5', 2], [2, 'D#5', 1], [3, 'E5', 1], [4, 'G5', 2], [6, 'E5', 2], [8, 'C5', 2], [10, 'D5', 2], [12, 'E5', 4],
          [16, 'F5', 2], [18, 'E5', 1], [19, 'F5', 1], [20, 'A5', 2], [22, 'F5', 2], [24, 'D5', 2], [26, 'E5', 2], [28, 'F5', 4],
          [32, 'G5', 2], [34, 'F#5', 1], [35, 'G5', 1], [36, 'B5', 2], [38, 'G5', 2], [40, 'F5', 2], [42, 'D5', 2], [44, 'B4', 2], [46, 'D5', 2],
          [48, 'C5', 4],
          [64, 'E5', 2], [66, 'G5', 2], [68, 'C6', 2], [70, 'G5', 2], [72, 'A5', 1], [73, 'G5', 1], [74, 'F#5', 1], [75, 'G5', 1], [76, 'E5', 4],
          [80, 'F5', 2], [82, 'A5', 2], [84, 'C6', 2], [86, 'A5', 2], [88, 'G#5', 2], [90, 'A5', 2], [92, 'F5', 4],
          [96, 'D5', 1], [97, 'E5', 1], [98, 'F5', 1], [99, 'F#5', 1], [100, 'G5', 2], [102, 'B5', 2], [104, 'D6', 2], [106, 'B5', 2], [108, 'G5', 2], [110, 'F5', 2],
          [112, 'E5', 2], [114, 'G5', 2], [116, 'C6', 3]
        ];
        mel.forEach(([s, n, l]) => I.kazoo(ctx, kazooCh, at(s), n, l * S, 1));
        // Knasiga ljud i pauserna
        I.slide(ctx, sfxL, at(52), 500, 1600, S * 7, 1);        // uuuiiip!
        I.boing(ctx, sfxR, at(60), 260, 1);                     // boing!
        I.slide(ctx, sfxR, at(119), 1500, 450, S * 3, 0.9);     // nedåt
        I.honk(ctx, sfxL, at(122), 0.9);                        // tut
        I.honk(ctx, sfxL, at(123.5), 0.9, 1.06);                // tut!
        I.gliss(ctx, sfxR, at(125), C_UP, S / 2.8, 0.7);        // xylofon upp
      }
    },

    // Smygande tå-dans med fagott och pizzicato – lekfull men lugn att prata över
    bed: {
      bpm: 120, bars: 8, swing: 0.14, reverb: 0.26,
      play(ctx, mix, t0, S, swing) {
        const at = s => t0 + s * S + (Math.floor(s) % 4 === 2 ? swing * S * 2 : 0);
        const bassCh = mix.ch(0, 0.05), pizz = mix.ch(-0.3, 0.3), toy = mix.ch(0.35, 0.4), drums = mix.ch(0, 0.1), sfx = mix.ch(0.4, 0.3);
        const bassline = [['C2', 'E2', 'G2', 'E2'], ['A1', 'C#2', 'E2', 'C#2'], ['D2', 'F#2', 'A2', 'F#2'], ['G1', 'B1', 'D2', 'F2']];
        for (let bar = 0; bar < 8; bar++) {
          const b0 = bar * 16;
          bassline[bar % 4].forEach((n, i) => I.bassoon(ctx, bassCh, at(b0 + i * 4), n, S * 1.6, 1));
          [4, 12].forEach(s => I.clap(ctx, drums, at(b0 + s), 0.22));
          for (let s = 0; s < 16; s += 2) I.shaker(ctx, drums, at(b0 + s), s % 4 ? 0.5 : 0.25);
        }
        // Tå-på-tå-melodi med kromatiska smygsteg
        const tiptoe = [
          [0, 'E4', 1], [2, 'F4', 1], [3, 'F#4', 1], [4, 'G4', 2], [8, 'C5', 1], [10, 'G4', 1], [12, 'E4', 2],
          [16, 'C#5', 1], [18, 'D5', 1], [19, 'D#5', 1], [20, 'E5', 2], [24, 'G5', 1], [26, 'E5', 1], [28, 'C#5', 2],
          [32, 'F#4', 1], [34, 'G4', 1], [35, 'G#4', 1], [36, 'A4', 2], [40, 'C5', 1], [42, 'A4', 1], [44, 'F#4', 2],
          [48, 'B4', 1], [50, 'D5', 1], [52, 'F5', 1], [54, 'A5', 1], [56, 'G5', 2]
        ];
        tiptoe.forEach(([s, n, l]) => I.marimba(ctx, pizz, at(s), n, l * S, 0.9));
        // andra varvet: leksakspiano en oktav upp, och ett kromatiskt fall på slutet
        tiptoe.slice(0, 21).forEach(([s, n, l]) => I.glock(ctx, toy, at(s + 64), up(n, 12), l * S * 2, 0.7));
        ['G5', 'F#5', 'F5', 'E5', 'D#5', 'D5'].forEach((n, i) => I.marimba(ctx, pizz, at(112 + i * 2), n, S, 0.9));
        I.boing(ctx, sfx, at(60), 330, 0.55);
        I.squeak(ctx, sfx, at(124), 0.8);
        I.squeak(ctx, sfx, at(125.5), 0.8);
      }
    },

    // Tick-tack-klocka, kromatiskt klättrande och en visselglidare mot toppen
    tension: {
      bpm: 140, bars: 4, reverb: 0.16,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const bassCh = mix.ch(0, 0), tickL = mix.ch(-0.6, 0.1), tickR = mix.ch(0.6, 0.1), pizz = mix.ch(-0.25, 0.25);
        const brassCh = mix.ch(0.25, 0.2), drums = mix.ch(0, 0.05), sfx = mix.ch(0.3, 0.3);
        const roots = ['C2', 'C#2', 'D2', 'D#2'];
        roots.forEach((r, bar) => {
          const b0 = bar * 16;
          for (let s = 0; s < 16; s += 2) I.bassoon(ctx, bassCh, at(b0 + s), up(r, s % 4 ? 12 : 0), S * 1.2, 1);
          for (let s = 0; s < 16; s++) I.marimba(ctx, pizz, at(b0 + s), up(r, [24, 31, 28, 31][s % 4]), S, s % 4 ? 0.3 : 0.45);
          for (let s = 0; s < 16; s += 2) I.woodblock(ctx, s % 4 ? tickR : tickL, at(b0 + s), 0.8, s % 4 ? 900 : 1300); // tick-tack
          [0, 4, 8, 12].forEach(s => I.kick(ctx, drums, at(b0 + s), 0.6));
          I.brass(ctx, brassCh, at(b0), [up(r, 28), up(r, 31), up(r, 36)], S * 1.5, 0.8);
        });
        for (let s = 48; s < 64; s++) I.snare(ctx, drums, at(s), 0.1 + (s - 48) * 0.028);
        I.slide(ctx, sfx, at(48), 400, 1900, S * 15, 0.8);
        I.squeak(ctx, sfx, at(14), 0.6);
        I.boing(ctx, sfx, at(30), 300, 0.45);
      }
    }
  };

  // ---------------- Glad frågesport ----------------
  const HAPPY = {
    theme: {
      bpm: 148, bars: 8, reverb: 0.22,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const drums = mix.ch(0, 0.08), bassCh = mix.ch(0, 0), brassL = mix.ch(-0.35, 0.25), brassR = mix.ch(0.35, 0.25);
        const leadCh = mix.ch(0.08, 0.3), glockCh = mix.ch(-0.2, 0.4), hatCh = mix.ch(0.3, 0.05), marCh = mix.ch(-0.4, 0.2);
        // I – vi – IV – V: den gladaste ackordföljden som finns
        const bars = [
          { root: 'C2', chord: ['E4', 'G4', 'C5'], arp: ['C5', 'E5', 'G5', 'E5'] },
          { root: 'A1', chord: ['E4', 'A4', 'C5'], arp: ['A4', 'C5', 'E5', 'C5'] },
          { root: 'F1', chord: ['F4', 'A4', 'C5'], arp: ['A4', 'C5', 'F5', 'C5'] },
          { root: 'G1', chord: ['D4', 'G4', 'B4'], arp: ['G4', 'B4', 'D5', 'B4'] },
          { root: 'C2', chord: ['E4', 'G4', 'C5'], arp: ['C5', 'E5', 'G5', 'E5'] },
          { root: 'A1', chord: ['E4', 'A4', 'C5'], arp: ['A4', 'C5', 'E5', 'C5'] },
          { root: 'F1', chord: ['F4', 'A4', 'C5'], arp: ['A4', 'C5', 'F5', 'C5'], half: { root: 'G1', chord: ['D4', 'G4', 'B4'] } },
          { root: 'G1', chord: ['D4', 'F4', 'G4', 'B4'], arp: ['G4', 'B4', 'D5', 'F5'] }
        ];
        bars.forEach((b, bar) => {
          const b0 = bar * 16;
          for (let i = 0; i < 8; i++) {
            const c = b.half && i >= 4 ? b.half : b;
            // studsig oktavbas: låg-hög-låg-hög, kvinten innan nästa ackord
            const n = i === 7 ? up(c.root, 19) : up(c.root, i % 2 ? 12 : 0);
            I.bass(ctx, bassCh, at(b0 + i * 2), n, S * 1.5, i % 2 ? 0.8 : 1);
          }
          // blås på alla "och"-slag – ger det där glada, hoppiga
          [2, 6, 10, 14].forEach((s, k) => {
            const c = b.half && s >= 8 ? b.half : b;
            I.brass(ctx, k % 2 ? brassR : brassL, at(b0 + s), c.chord, S * 0.9, k === 0 ? 1 : 0.85);
          });
          if (bar % 4 === 0) I.brass(ctx, brassL, at(b0), b.chord.map(n => up(n, 12)), S * 3, 0.7);
          // marimba-arpeggio i sextondelar (tyst, glittrig)
          for (let s = 0; s < 16; s++) I.marimba(ctx, marCh, at(b0 + s), b.arp[s % 4], S, s % 4 ? 0.35 : 0.5);
          // trummor: kick på varje slag, handklapp på 2 och 4, shaker i sextondelar
          [0, 4, 8, 12].forEach(s => I.kick(ctx, drums, at(b0 + s), 0.85));
          [4, 12].forEach(s => { I.clap(ctx, drums, at(b0 + s), 0.8); I.snare(ctx, drums, at(b0 + s), 0.3); });
          for (let s = 0; s < 16; s++) I.shaker(ctx, hatCh, at(b0 + s), s % 2 ? 0.6 : 1);
          [2, 6, 10, 14].forEach(s => I.hat(ctx, hatCh, at(b0 + s), 0.55, true));
        });
        // Melodi: [steg, ton, längd i sextondelar]
        const mel = [
          [0, 'G5', 2], [2, 'E5', 2], [4, 'G5', 2], [6, 'C6', 4], [10, 'B5', 2], [12, 'C6', 2], [14, 'D6', 2],
          [16, 'E6', 4], [20, 'C6', 2], [22, 'A5', 4], [26, 'G5', 2], [28, 'A5', 4],
          [32, 'F5', 2], [34, 'A5', 2], [36, 'C6', 2], [38, 'F6', 4], [42, 'E6', 2], [44, 'D6', 2], [46, 'C6', 2],
          [48, 'D6', 4], [52, 'B5', 2], [54, 'G5', 4], [58, 'A5', 2], [60, 'B5', 4],
          [64, 'C6', 2], [66, 'G5', 2], [68, 'E5', 2], [70, 'G5', 2], [72, 'C6', 4], [76, 'E6', 4],
          [80, 'D6', 2], [82, 'C6', 2], [84, 'A5', 4], [88, 'C6', 2], [90, 'E6', 6],
          [96, 'F6', 2], [98, 'E6', 2], [100, 'C6', 2], [102, 'A5', 2], [104, 'B5', 2], [106, 'D6', 2], [108, 'G6', 4],
          [112, 'F6', 2], [114, 'E6', 2], [116, 'D6', 2], [118, 'B5', 2], [120, 'G5', 2], [122, 'A5', 2], [124, 'B5', 2], [126, 'D6', 2]
        ];
        mel.forEach(([s, n, l]) => {
          I.lead(ctx, leadCh, at(s), n, l * S, 1);
          if (s >= 64) I.glock(ctx, glockCh, at(s), up(n, 12), l * S, 0.55); // klockspel dubblar andra halvan
        });
        // trumvirvel in i loopen igen
        [120, 122, 124, 125, 126, 127].forEach((s, i) => I.snare(ctx, drums, at(s), 0.35 + i * 0.08));
      }
    },

    bed: {
      bpm: 116, bars: 8, swing: 0.12, reverb: 0.28,
      play(ctx, mix, t0, S, swing) {
        const at = s => t0 + s * S + (s % 4 === 2 ? swing * S * 2 : 0);
        const drums = mix.ch(0, 0.1), bassCh = mix.ch(0, 0), marL = mix.ch(-0.35, 0.3), keysR = mix.ch(0.3, 0.3);
        const glockCh = mix.ch(0.15, 0.45), shakeCh = mix.ch(0.35, 0.05);
        // I – IV – V – I, glatt och enkelt
        const bars = [
          { root: 'C2', chord: ['E4', 'G4', 'C5'], arp: ['C5', 'G4', 'E5', 'G4'] },
          { root: 'F1', chord: ['F4', 'A4', 'C5'], arp: ['C5', 'A4', 'F5', 'A4'] },
          { root: 'G1', chord: ['D4', 'G4', 'B4'], arp: ['B4', 'G4', 'D5', 'G4'] },
          { root: 'C2', chord: ['E4', 'G4', 'C5'], arp: ['C5', 'G4', 'E5', 'G4'] },
          { root: 'A1', chord: ['E4', 'A4', 'C5'], arp: ['C5', 'A4', 'E5', 'A4'] },
          { root: 'F1', chord: ['F4', 'A4', 'C5'], arp: ['C5', 'A4', 'F5', 'A4'] },
          { root: 'D2', chord: ['F4', 'A4', 'D5'], arp: ['D5', 'A4', 'F5', 'A4'] },
          { root: 'G1', chord: ['D4', 'F4', 'B4'], arp: ['B4', 'G4', 'D5', 'F5'] }
        ];
        bars.forEach((b, bar) => {
          const b0 = bar * 16;
          // hoppig bas: ett, (och-två), tre, fyra upp
          [[0, 0, 1], [6, 0, 0.6], [8, 7, 0.9], [12, 12, 0.7]].forEach(([s, semi, v]) => I.bass(ctx, bassCh, at(b0 + s), up(b.root, semi), S * 1.6, v * 0.85));
          // marimba i åttondelar
          for (let s = 0; s < 16; s += 2) I.marimba(ctx, marL, at(b0 + s), b.arp[(s / 2) % 4], S * 2, s % 4 ? 0.5 : 0.7);
          // lätta ackord på baktakten
          [4, 12].forEach(s => I.keys(ctx, keysR, at(b0 + s), b.chord, S * 1.4, 0.8));
          I.kick(ctx, drums, at(b0), 0.5);
          I.kick(ctx, drums, at(b0 + 8), 0.4);
          [4, 12].forEach(s => I.clap(ctx, drums, at(b0 + s), 0.35));
          for (let s = 0; s < 16; s += 2) I.shaker(ctx, shakeCh, at(b0 + s), s % 4 ? 0.8 : 0.45);
        });
        // Små klockspelsfraser – glad frågesportsstämning
        [[24, 'G5'], [26, 'C6'], [28, 'E6'], [30, 'G6'],
         [56, 'A5'], [58, 'C6'], [60, 'F6'],
         [88, 'E6'], [90, 'D6'], [92, 'C6'], [94, 'E6'],
         [120, 'D6'], [122, 'F6'], [124, 'G6'], [126, 'B6']].forEach(([s, n]) => I.glock(ctx, glockCh, at(s), n, S * 2, 0.8));
      }
    },

    tension: {
      bpm: 136, bars: 4, reverb: 0.18,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const drums = mix.ch(0, 0.05), bassCh = mix.ch(0, 0), tickL = mix.ch(-0.5, 0.1), tickR = mix.ch(0.5, 0.1);
        const pluck = mix.ch(-0.25, 0.25), brassCh = mix.ch(0.25, 0.25), glockCh = mix.ch(0, 0.4);
        // Stiger ett steg per takt: C – D – E – G, spänningen byggs upp
        const bars = [
          { root: 'C2', chord: ['E4', 'G4', 'C5'], arp: ['C5', 'G4', 'E5', 'G4'] },
          { root: 'D2', chord: ['F#4', 'A4', 'D5'], arp: ['D5', 'A4', 'F#5', 'A4'] },
          { root: 'E2', chord: ['G#4', 'B4', 'E5'], arp: ['E5', 'B4', 'G#5', 'B4'] },
          { root: 'G1', chord: ['D4', 'G4', 'B4'], arp: ['G5', 'D5', 'B5', 'D5'] }
        ];
        bars.forEach((b, bar) => {
          const b0 = bar * 16;
          for (let s = 0; s < 16; s += 2) I.bass(ctx, bassCh, at(b0 + s), up(b.root, s % 4 ? 12 : 0), S * 1.2, 0.8);
          for (let s = 0; s < 16; s++) I.marimba(ctx, pluck, at(b0 + s), b.arp[s % 4], S, s % 4 ? 0.3 : 0.45);
          for (let s = 0; s < 16; s += 2) I.tick(ctx, s % 4 ? tickR : tickL, at(b0 + s), 0.9, s % 4 ? 1700 : 2400);
          [0, 4, 8, 12].forEach(s => I.kick(ctx, drums, at(b0 + s), 0.75));
          [4, 12].forEach(s => I.clap(ctx, drums, at(b0 + s), 0.45));
          I.brass(ctx, brassCh, at(b0), b.chord, S * 2, 0.9);
          I.brass(ctx, brassCh, at(b0 + 10), b.chord, S * 1, 0.7);
        });
        // Virvel som växer mot slutet av loopen
        for (let s = 48; s < 64; s++) I.snare(ctx, drums, at(s), 0.12 + (s - 48) * 0.03);
        [[14, 'G6'], [30, 'A6'], [46, 'B6'], [62, 'D7']].forEach(([s, n]) => I.glock(ctx, glockCh, at(s), n, S * 2, 0.7));
      }
    }
  };

  // ---------------- Instrument för 8-bit, disco och swing ----------------
  function pulseWave(ctx, duty) {
    ctx.__pw = ctx.__pw || {};
    if (ctx.__pw[duty]) return ctx.__pw[duty];
    const N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    return (ctx.__pw[duty] = ctx.createPeriodicWave(re, im));
  }

  Object.assign(I, {
    // NES-liknande pulsvåg (duty 0.125 / 0.25 / 0.5)
    chip(ctx, out, t, note, dur, vol = 1, duty = 0.25) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.setPeriodicWave(pulseWave(ctx, duty)); o.frequency.value = hz(note);
      o.connect(g).connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * 0.075, t + 0.003);
      g.gain.setValueAtTime(vol * 0.075, t + dur * 0.85);
      g.gain.linearRampToValueAtTime(0.0001, t + dur * 0.95);
      o.start(t); o.stop(t + dur + 0.02);
    },
    chipTri(ctx, out, t, note, dur, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = hz(note);
      o.connect(g).connect(out);
      g.gain.setValueAtTime(vol * 0.35, t);
      g.gain.setValueAtTime(vol * 0.35, t + dur * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + dur * 0.9);
      o.start(t); o.stop(t + dur);
    },
    chipKick(ctx, out, t, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
      g.gain.setValueAtTime(vol * 0.7, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.13);
    },
    chipNoise(ctx, out, t, dur, vol = 1, freq = 6000) {
      noise(ctx, out, t, { type: 'highpass', freq, vol: vol * 0.35, dur });
    },
    // "Pling!" – mynt
    coin(ctx, out, t, vol = 1) {
      I.chip(ctx, out, t, 'B5', 0.07, vol * 1.2, 0.5);
      I.chip(ctx, out, t + 0.07, 'E6', 0.35, vol * 1.2, 0.5);
    },
    // "Hopp" – pulsvåg som sveper uppåt
    jump(ctx, out, t, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.setPeriodicWave(pulseWave(ctx, 0.5));
      o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(1200, t + 0.18);
      g.gain.setValueAtTime(vol * 0.07, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.22);
    },
    // Stråkar: tre lätt ostämda sågtandsvågor per ton
    strings(ctx, out, t, notes, dur, vol = 1, attack = 0.04) {
      notes.forEach(n => {
        const f0 = hz(n);
        [-11, 0, 10].forEach(det => {
          const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = f0; o.detune.value = det;
          lp.type = 'lowpass'; lp.frequency.value = 3800;
          o.connect(lp).connect(g).connect(out);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(vol * 0.03, t + attack);
          g.gain.setValueAtTime(vol * 0.03, t + Math.max(attack, dur));
          g.gain.setTargetAtTime(0.0001, t + Math.max(attack, dur), 0.08);
          o.start(t); o.stop(t + dur + 0.6);
        });
      });
    },
    // Funkgitarr – "tjicka"
    chick(ctx, out, t, vol = 1, note = 'E4') {
      const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz(note);
      bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2.5;
      o.connect(bp).connect(g).connect(out);
      g.gain.setValueAtTime(vol * 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      o.start(t); o.stop(t + 0.06);
      noise(ctx, out, t, { type: 'bandpass', freq: 3000, q: 2, vol: vol * 0.12, dur: 0.03 });
    },
    // Swing: ridecymbal, visp, kontrabas, tom-tom och saxofon
    ride(ctx, out, t, vol = 1) {
      noise(ctx, out, t, { type: 'bandpass', freq: 8500, q: 1.5, vol: vol * 0.16, dur: 0.35 });
      [5200, 7400].forEach(f => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(vol * 0.012, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.42);
      });
    },
    brush(ctx, out, t, vol = 1) {
      noise(ctx, out, t, { type: 'bandpass', freq: 3500, q: 0.7, vol: vol * 0.18, dur: 0.14 });
    },
    upright(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'triangle'; o2.type = 'sine';
      o.frequency.value = f0; o2.frequency.value = f0 * 2;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.1);
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.55, t + 0.008);
      g.gain.exponentialRampToValueAtTime(vol * 0.18, t + 0.15);
      g.gain.setTargetAtTime(0.0001, t + dur * 0.9, 0.05);
      [o, o2].forEach(x => { x.start(t); x.stop(t + dur + 0.3); });
    },
    tom(ctx, out, t, freq = 110, vol = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
      g.gain.setValueAtTime(vol * 0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.42);
      noise(ctx, out, t, { type: 'lowpass', freq: 1200, vol: vol * 0.15, dur: 0.06 });
    },
    sax(ctx, out, t, note, dur, vol = 1) {
      const f0 = hz(note);
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * 0.96, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.015, t + Math.min(dur, 0.4));
      lfo.connect(lg).connect(o.frequency);
      lp.type = 'lowpass'; lp.Q.value = 1.5;
      lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.06); lp.frequency.linearRampToValueAtTime(1700, t + 0.3);
      pk.type = 'peaking'; pk.frequency.value = 1100; pk.gain.value = 6; pk.Q.value = 1.5;
      o.connect(lp).connect(pk).connect(g).connect(out);
      env(g, t, 0.025, vol * 0.13, dur * 0.9, 0.05);
      [o, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.3); });
    }
  });

  // Swing-tid: "och"-åttondelarna kommer lite sent
  const swingAt = (t0, S, sw) => s => t0 + s * S + (Math.floor(s) % 4 === 2 ? sw * S * 2 : 0);

  // ---------------- Retro 8-bit ----------------
  const CHIP = {
    theme: {
      bpm: 150, bars: 8, reverb: 0.1,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const lead = mix.ch(0.1, 0.15), arp = mix.ch(-0.35, 0.1), bass = mix.ch(0, 0), drums = mix.ch(0, 0.05), fx = mix.ch(0.4, 0.2);
        const C = ['C5', 'E5', 'G5'], G = ['B4', 'D5', 'G5'], Am = ['C5', 'E5', 'A5'], F = ['C5', 'F5', 'A5'];
        const bars = [[C, 'C2'], [G, 'G1'], [Am, 'A1'], [F, 'F1'], [C, 'C2'], [G, 'G1'], [Am, 'A1'], [F, 'F1', G, 'G1']];
        bars.forEach(([ch, root, ch2, root2], bar) => {
          const b0 = bar * 16;
          for (let s = 0; s < 16; s++) {
            const c = ch2 && s >= 8 ? ch2 : ch;
            I.chip(ctx, arp, at(b0 + s), c[s % 3], S, 0.45, 0.125);
          }
          for (let s = 0; s < 16; s += 2) {
            const r = root2 && s >= 8 ? root2 : root;
            I.chipTri(ctx, bass, at(b0 + s), up(r, s % 4 ? 12 : 0), S * 1.8, 1);
          }
          [0, 8].forEach(s => I.chipKick(ctx, drums, at(b0 + s), 1));
          [4, 12].forEach(s => I.chipNoise(ctx, drums, at(b0 + s), 0.1, 1, 2500));
          [2, 6, 10, 14].forEach(s => I.chipNoise(ctx, drums, at(b0 + s), 0.03, 0.6, 8000));
        });
        const mel = [
          [0, 'G5', 2], [2, 'C6', 2], [4, 'E6', 3], [7, 'D6', 1], [8, 'C6', 2], [10, 'G5', 2], [12, 'E5', 4],
          [16, 'D6', 2], [18, 'B5', 2], [20, 'G5', 2], [22, 'B5', 2], [24, 'D6', 4], [28, 'G6', 4],
          [32, 'E6', 2], [34, 'C6', 2], [36, 'A5', 3], [39, 'B5', 1], [40, 'C6', 2], [42, 'E6', 2], [44, 'A6', 4],
          [48, 'G6', 2], [50, 'F6', 2], [52, 'E6', 2], [54, 'D6', 2], [56, 'C6', 4],
          [64, 'C6', 1], [65, 'E6', 1], [66, 'G6', 2], [68, 'E6', 2], [70, 'C6', 2], [72, 'D6', 2], [74, 'E6', 2], [76, 'G6', 4],
          [80, 'B5', 2], [82, 'D6', 2], [84, 'G6', 2], [86, 'F#6', 1], [87, 'G6', 1], [88, 'A6', 4], [92, 'G6', 4],
          [96, 'E6', 2], [98, 'C6', 2], [100, 'A5', 2], [102, 'C6', 2], [104, 'E6', 2], [106, 'A6', 2], [108, 'G6', 4],
          [112, 'F6', 2], [114, 'E6', 2], [116, 'D6', 2], [118, 'C6', 2], [120, 'D6', 1], [121, 'E6', 1], [122, 'F6', 1], [123, 'G6', 1], [124, 'B6', 3]
        ];
        mel.forEach(([s, n, l]) => I.chip(ctx, lead, at(s), n, l * S, 1, 0.25));
        I.jump(ctx, fx, at(60), 0.9);
        I.coin(ctx, fx, at(127), 0.8);
      }
    },
    bed: {
      bpm: 112, bars: 8, reverb: 0.15,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const arp = mix.ch(-0.3, 0.15), bass = mix.ch(0, 0), mel = mix.ch(0.3, 0.25), drums = mix.ch(0, 0.05);
        const bars = [[['C5', 'E5', 'G5', 'E5'], 'C2'], [['A4', 'C5', 'E5', 'C5'], 'A1'], [['A4', 'C5', 'F5', 'C5'], 'F1'], [['B4', 'D5', 'G5', 'D5'], 'G1']];
        for (let bar = 0; bar < 8; bar++) {
          const [ch, root] = bars[bar % 4], b0 = bar * 16;
          for (let s = 0; s < 16; s += 2) I.chip(ctx, arp, at(b0 + s), ch[(s / 2) % 4], S * 1.5, 0.35, 0.125);
          [0, 6, 8, 12].forEach((s, i) => I.chipTri(ctx, bass, at(b0 + s), up(root, i === 3 ? 12 : i === 2 ? 7 : 0), S * 1.8, 0.8));
          I.chipKick(ctx, drums, at(b0), 0.6);
          [4, 12].forEach(s => I.chipNoise(ctx, drums, at(b0 + s), 0.05, 0.45, 4000));
        }
        [[24, 'G5'], [26, 'A5'], [28, 'C6'], [56, 'B5'], [58, 'D6'], [60, 'G6'], [88, 'E6'], [90, 'D6'], [92, 'C6'], [120, 'D6'], [122, 'B5'], [124, 'G5']]
          .forEach(([s, n]) => I.chip(ctx, mel, at(s), n, S * 1.8, 0.6, 0.5));
        I.coin(ctx, mel, at(62), 0.4);
      }
    },
    tension: {
      bpm: 144, bars: 4, reverb: 0.1,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const bass = mix.ch(0, 0), arp = mix.ch(-0.3, 0.1), drums = mix.ch(0, 0.05), fx = mix.ch(0.3, 0.2);
        ['C2', 'C#2', 'D2', 'D#2'].forEach((r, bar) => {
          const b0 = bar * 16;
          for (let s = 0; s < 16; s++) I.chipTri(ctx, bass, at(b0 + s), up(r, s % 2 ? 12 : 0), S, 0.9);
          for (let s = 0; s < 16; s++) I.chip(ctx, arp, at(b0 + s), up(r, [24, 31, 36, 31][s % 4]), S, 0.5, 0.25);
          for (let s = 0; s < 16; s++) I.chipNoise(ctx, drums, at(b0 + s), 0.025, 0.3 + bar * 0.12, 9000);
          [0, 4, 8, 12].forEach(s => I.chipKick(ctx, drums, at(b0 + s), 0.9));
        });
        for (let s = 48; s < 64; s += 0.5) I.chipNoise(ctx, drums, at(s), 0.04, 0.3 + (s - 48) * 0.04, 2500);
        I.jump(ctx, fx, at(62), 1);
      }
    }
  };

  // ---------------- Disco ----------------
  const DISCO = {
    theme: {
      bpm: 122, bars: 8, reverb: 0.25,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const drums = mix.ch(0, 0.06), hats = mix.ch(0.3, 0.05), bass = mix.ch(0, 0), gtr = mix.ch(-0.45, 0.1);
        const strL = mix.ch(-0.3, 0.35), strR = mix.ch(0.3, 0.35), lead = mix.ch(0.05, 0.3), glock = mix.ch(0.2, 0.4);
        const Dm7 = { root: 'D2', chord: ['F4', 'A4', 'C5', 'E5'] }, G7 = { root: 'G1', chord: ['F4', 'G4', 'B4', 'D5'] };
        const Cmaj7 = { root: 'C2', chord: ['E4', 'G4', 'B4', 'D5'] }, Am7 = { root: 'A1', chord: ['E4', 'G4', 'A4', 'C5'] };
        const A7 = { root: 'A1', chord: ['E4', 'G4', 'A4', 'C#5'] };
        [Dm7, G7, Cmaj7, Am7, Dm7, G7, Cmaj7, A7].forEach((b, bar) => {
          const b0 = bar * 16;
          [0, 4, 8, 12].forEach(s => I.kick(ctx, drums, at(b0 + s), 1));
          [4, 12].forEach(s => I.clap(ctx, drums, at(b0 + s), 0.8));
          [2, 6, 10, 14].forEach(s => I.hat(ctx, hats, at(b0 + s), 0.9, true));
          for (let s = 1; s < 16; s += 2) I.hat(ctx, hats, at(b0 + s), 0.35);
          for (let s = 0; s < 16; s += 2) I.bass(ctx, bass, at(b0 + s), up(b.root, s % 4 ? 12 : 0), S * 1.4, s % 4 ? 0.85 : 1);
          I.bass(ctx, bass, at(b0 + 15), up(b.root, 12), S * 0.8, 0.5);
          [2, 3, 6, 10, 11, 14].forEach(s => I.chick(ctx, gtr, at(b0 + s), s % 2 ? 0.6 : 1, b.chord[1]));
          I.strings(ctx, strL, at(b0), b.chord, S * 3, 1, 0.02);
          I.strings(ctx, strR, at(b0 + 6), b.chord, S * 1.5, 0.8, 0.01);
        });
        const mel = [
          [0, 'A5', 2], [3, 'C6', 1], [4, 'D6', 2], [6, 'C6', 1], [8, 'A5', 3], [11, 'G5', 1], [12, 'A5', 4],
          [16, 'B5', 2], [19, 'D6', 1], [20, 'F6', 2], [22, 'E6', 1], [24, 'D6', 3], [27, 'B5', 1], [28, 'G5', 4],
          [32, 'E6', 2], [35, 'G6', 1], [36, 'B6', 3], [39, 'A6', 1], [40, 'G6', 2], [42, 'E6', 2], [44, 'C6', 4],
          [48, 'C6', 2], [50, 'E6', 2], [52, 'G6', 2], [54, 'E6', 2], [56, 'A6', 8],
          [64, 'A5', 2], [67, 'C6', 1], [68, 'D6', 2], [70, 'C6', 1], [72, 'A5', 3], [75, 'G5', 1], [76, 'A5', 4],
          [80, 'B5', 2], [83, 'D6', 1], [84, 'F6', 2], [86, 'E6', 1], [88, 'D6', 3], [91, 'B5', 1], [92, 'G5', 4],
          [96, 'E6', 2], [99, 'G6', 1], [100, 'B6', 3], [103, 'A6', 1], [104, 'G6', 2], [106, 'E6', 2], [108, 'C6', 4],
          [112, 'C#6', 2], [114, 'E6', 2], [116, 'G6', 2], [118, 'A6', 2], [120, 'G6', 2], [122, 'E6', 2], [124, 'C#6', 2], [126, 'A5', 2]
        ];
        mel.forEach(([s, n, l]) => {
          I.strings(ctx, lead, at(s), [n, up(n, -12)], l * S * 0.9, 1.6, 0.015);
          if (s >= 64) I.glock(ctx, glock, at(s), up(n, 12), l * S, 0.45);
        });
      }
    },
    bed: {
      bpm: 116, bars: 8, reverb: 0.3,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const drums = mix.ch(0, 0.06), hats = mix.ch(0.3, 0.05), bass = mix.ch(0, 0), gtr = mix.ch(-0.45, 0.1), pad = mix.ch(0, 0.4);
        const bars = [
          { root: 'D2', chord: ['F4', 'A4', 'C5', 'E5'] }, { root: 'G1', chord: ['F4', 'G4', 'B4', 'D5'] },
          { root: 'C2', chord: ['E4', 'G4', 'B4', 'D5'] }, { root: 'A1', chord: ['E4', 'G4', 'A4', 'C5'] }
        ];
        for (let bar = 0; bar < 8; bar++) {
          const b = bars[bar % 4], b0 = bar * 16;
          [0, 4, 8, 12].forEach(s => I.kick(ctx, drums, at(b0 + s), 0.6));
          [4, 12].forEach(s => I.clap(ctx, drums, at(b0 + s), 0.35));
          [2, 6, 10, 14].forEach(s => I.hat(ctx, hats, at(b0 + s), 0.5, true));
          for (let s = 0; s < 16; s += 2) I.bass(ctx, bass, at(b0 + s), up(b.root, s % 4 ? 12 : 0), S * 1.4, 0.8);
          [2, 6, 10, 14].forEach(s => I.chick(ctx, gtr, at(b0 + s), 0.6, b.chord[1]));
          I.strings(ctx, pad, at(b0), b.chord, S * 15, 0.7, 0.4);
        }
      }
    },
    tension: {
      bpm: 126, bars: 4, reverb: 0.25,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const drums = mix.ch(0, 0.05), hats = mix.ch(0.3, 0.05), bass = mix.ch(0, 0), str = mix.ch(0, 0.35), fx = mix.ch(0, 0.3);
        const bars = [['A1', ['A4', 'C5', 'E5']], ['A#1', ['A#4', 'D5', 'F5']], ['B1', ['B4', 'D#5', 'F#5']], ['C2', ['C5', 'E5', 'G5']]];
        bars.forEach(([root, chord], bar) => {
          const b0 = bar * 16;
          [0, 4, 8, 12].forEach(s => I.kick(ctx, drums, at(b0 + s), 1));
          for (let s = 0; s < 16; s++) I.hat(ctx, hats, at(b0 + s), 0.3 + bar * 0.15 + (s % 2 ? 0 : 0.2));
          for (let s = 0; s < 16; s += 2) I.bass(ctx, bass, at(b0 + s), up(root, s % 4 ? 12 : 0), S * 1.4, 0.9);
          I.strings(ctx, str, at(b0), chord, S * 15.5, 0.9, 0.3);
          const snare = bar < 2 ? [4, 12] : bar === 2 ? [4, 8, 12, 14] : [];
          snare.forEach(s => I.clap(ctx, drums, at(b0 + s), 0.6));
        });
        for (let s = 48; s < 64; s++) I.snare(ctx, drums, at(s), 0.15 + (s - 48) * 0.03);
        noise(ctx, fx, at(32), { type: 'bandpass', freq: 3000, q: 0.8, vol: 0.12, dur: S * 32 }); // uppbyggnad
      }
    }
  };

  // ---------------- 60-tals tv-show (storband, swing) ----------------
  const SWING = {
    theme: {
      bpm: 150, bars: 8, swing: 0.3, reverb: 0.3,
      play(ctx, mix, t0, S, sw) {
        const at = swingAt(t0, S, sw);
        const bass = mix.ch(0, 0.05), ride = mix.ch(0.4, 0.15), drums = mix.ch(0, 0.1), piano = mix.ch(-0.3, 0.25);
        const brass = mix.ch(-0.15, 0.3), sax = mix.ch(0.2, 0.3);
        const chords = [
          { walk: ['C2', 'E2', 'G2', 'A2'], comp: ['E4', 'A4', 'C5'], hit: ['E5', 'G5', 'A5', 'C6'] },
          { walk: ['A1', 'C#2', 'E2', 'G2'], comp: ['C#4', 'G4', 'B4'], hit: ['C#5', 'G5', 'A5', 'E6'] },
          { walk: ['D2', 'F2', 'A2', 'B2'], comp: ['F4', 'A4', 'C5'], hit: ['F5', 'A5', 'C6', 'E6'] },
          { walk: ['G1', 'B1', 'D2', 'F2'], comp: ['F4', 'B4', 'E5'], hit: ['F5', 'B5', 'D6', 'G6'] }
        ];
        for (let bar = 0; bar < 8; bar++) {
          const c = chords[bar % 4], b0 = bar * 16;
          c.walk.forEach((n, i) => I.upright(ctx, bass, at(b0 + i * 4), n, S * 3.6, 1));
          [0, 4, 6, 8, 12, 14].forEach(s => I.ride(ctx, ride, at(b0 + s), s % 4 ? 0.7 : 1));
          [4, 12].forEach(s => I.hat(ctx, drums, at(b0 + s), 0.6));
          I.kick(ctx, drums, at(b0), 0.35);
          [0, 6].forEach(s => I.keys(ctx, piano, at(b0 + s), c.comp, S * 1.2, 0.9));
          if (bar % 2 === 0) I.brass(ctx, brass, at(b0), c.hit, S * 2, 1.1);
          if (bar % 2 === 1) { I.brass(ctx, brass, at(b0 + 14), chords[(bar + 1) % 4].hit, S * 1.5, 1); I.snare(ctx, drums, at(b0 + 14), 0.5); }
        }
        const mel = [
          [0, 'E5', 2], [2, 'G5', 2], [4, 'A5', 2], [6, 'C6', 4], [10, 'A5', 2], [12, 'G5', 4],
          [16, 'C#5', 2], [18, 'E5', 2], [20, 'G5', 2], [22, 'Bb5', 4], [26, 'A5', 2], [28, 'E5', 4],
          [32, 'F5', 2], [34, 'A5', 2], [36, 'C6', 2], [38, 'D6', 4], [42, 'C6', 2], [44, 'A5', 4],
          [48, 'B5', 2], [50, 'A5', 2], [52, 'G5', 2], [54, 'F5', 2], [56, 'D5', 4], [60, 'B4', 4],
          [64, 'G5', 2], [66, 'A5', 2], [68, 'C6', 2], [70, 'E6', 4], [74, 'D6', 2], [76, 'C6', 4],
          [80, 'E6', 2], [82, 'C#6', 2], [84, 'A5', 2], [86, 'G5', 4], [90, 'E5', 6],
          [96, 'D6', 2], [98, 'F6', 2], [100, 'E6', 2], [102, 'D6', 2], [104, 'C6', 2], [106, 'A5', 2], [108, 'F5', 4],
          [112, 'G5', 2], [114, 'B5', 2], [116, 'D6', 2], [118, 'F6', 2], [120, 'E6', 2], [122, 'D6', 2], [124, 'B5', 2], [126, 'G5', 2]
        ];
        mel.forEach(([s, n, l]) => I.sax(ctx, sax, at(s), n, l * S, 1));
      }
    },
    bed: {
      bpm: 120, bars: 8, swing: 0.3, reverb: 0.3,
      play(ctx, mix, t0, S, sw) {
        const at = swingAt(t0, S, sw);
        const bass = mix.ch(0, 0.05), ride = mix.ch(0.4, 0.15), drums = mix.ch(0, 0.1), piano = mix.ch(-0.3, 0.3), vib = mix.ch(0.25, 0.45);
        const chords = [
          { walk: ['C2', 'E2', 'G2', 'A2'], comp: ['E4', 'A4', 'D5'] },
          { walk: ['A1', 'C2', 'E2', 'G2'], comp: ['E4', 'G4', 'C5'] },
          { walk: ['D2', 'F2', 'A2', 'C3'], comp: ['F4', 'A4', 'C5', 'E5'] },
          { walk: ['G1', 'B1', 'D2', 'F2'], comp: ['F4', 'B4', 'E5'] }
        ];
        for (let bar = 0; bar < 8; bar++) {
          const c = chords[bar % 4], b0 = bar * 16;
          c.walk.forEach((n, i) => I.upright(ctx, bass, at(b0 + i * 4), n, S * 3.6, 0.9));
          [0, 4, 6, 8, 12, 14].forEach(s => I.ride(ctx, ride, at(b0 + s), s % 4 ? 0.45 : 0.65));
          [4, 12].forEach(s => I.brush(ctx, drums, at(b0 + s), 0.8));
          [0, 6].forEach(s => I.keys(ctx, piano, at(b0 + s), c.comp, S * 1.2, 0.7));
        }
        [[24, 'G5'], [26, 'A5'], [28, 'C6'], [30, 'E6'], [56, 'F5'], [58, 'A5'], [60, 'D6'],
         [88, 'E6'], [90, 'D6'], [92, 'C6'], [94, 'A5'], [120, 'B5'], [122, 'D6'], [124, 'F6'], [126, 'E6']]
          .forEach(([s, n]) => I.glock(ctx, vib, at(s), n, S * 3, 0.8));
      }
    },
    tension: {
      bpm: 160, bars: 4, reverb: 0.25,
      play(ctx, mix, t0, S) {
        const at = s => t0 + s * S;
        const toms = mix.ch(0, 0.15), bass = mix.ch(0, 0), brass = mix.ch(0, 0.3), ride = mix.ch(0.4, 0.1), drums = mix.ch(0, 0.1);
        // djungeltrummor à la "Sing, Sing, Sing"
        const roots = ['D2', 'D#2', 'E2', 'F2'];
        roots.forEach((r, bar) => {
          const b0 = bar * 16;
          [0, 4, 8, 12].forEach((s, i) => I.tom(ctx, toms, at(b0 + s), i % 2 ? 95 : 110, i === 0 ? 1 : 0.75));
          [3, 11].forEach(s => I.tom(ctx, toms, at(b0 + s), 140, 0.45));
          [0, 2, 3, 6, 8, 10, 11, 14].forEach(s => I.upright(ctx, bass, at(b0 + s), up(r, [0, 0, 3, 5, 7, 5, 3, 0][[0, 2, 3, 6, 8, 10, 11, 14].indexOf(s)]), S * 1.5, 0.9));
          for (let s = 0; s < 16; s += 2) I.ride(ctx, ride, at(b0 + s), 0.4);
          I.brass(ctx, brass, at(b0 + 14), [up(r, 24), up(r, 27), up(r, 31)], S * 1.5, 1);
        });
        for (let s = 48; s < 64; s++) I.snare(ctx, drums, at(s), 0.1 + (s - 48) * 0.03);
      }
    }
  };

  // ---------------- Musikstilar ----------------
  // Varje stil har tre låtar: theme (intro/avslutning), bed (under påståendet), tension (medan gästerna viftar)
  const PACKS = {
    circus: { name: 'Cirkus', desc: 'Knasig polka med kazoo, tuba, visselglidare och tutor', tracks: CIRCUS },
    happy:  { name: 'Glad frågesport', desc: 'Pigg dur-låt med blås, klapp och klockspel', tracks: HAPPY },
    chip:   { name: 'Retro 8-bit', desc: 'Tv-spelsmusik med pip, hopp och mynt', tracks: CHIP },
    disco:  { name: 'Disco', desc: 'Dansgolv med stråkar, funkgitarr och oktavbas', tracks: DISCO },
    swing:  { name: '60-tals tv-show', desc: 'Storband med saxofon, kontrabas och djungeltrummor', tracks: SWING }
  };
  const ROLES = ['theme', 'bed', 'tension'];
  const trackOf = key => { const [pack, role] = String(key).split('/'); return (PACKS[pack] || PACKS.circus).tracks[role]; };

  // ---------------- Rendering & uppspelning ----------------
  const cache = {};

  // Syntetiskt rum: brus som klingar av, lite olika i vänster och höger
  function impulse(ctx, secs) {
    const n = Math.round(secs * ctx.sampleRate);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.5);
    }
    return b;
  }

  function render(name, sampleRate) {
    if (cache[name]) return cache[name];
    const tr = trackOf(name);
    const S = 60 / tr.bpm / 4;
    const loopLen = tr.bars * 16 * S;
    const tail = 2;
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new OC(2, Math.ceil((loopLen + tail) * sampleRate), sampleRate);
    // Mixer: kanaler med panorering + gemensam efterklang (reverb) och kompressor
    const comp = off.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.15;
    comp.connect(off.destination);
    const verb = off.createConvolver();
    verb.buffer = impulse(off, 1.6);
    const verbIn = off.createGain(); verbIn.gain.value = tr.reverb || 0.2;
    const verbHp = off.createBiquadFilter(); verbHp.type = 'highpass'; verbHp.frequency.value = 300;
    verbIn.connect(verbHp).connect(verb).connect(comp);
    const mix = {
      ch(pan = 0, send = 0) {
        const g = off.createGain();
        const p = off.createStereoPanner(); p.pan.value = pan;
        g.connect(p).connect(comp);
        if (send) { const s = off.createGain(); s.gain.value = send * 4; g.connect(s).connect(verbIn); }
        return g;
      }
    };
    tr.play(off, mix, 0.001, S, tr.swing || 0);
    cache[name] = off.startRendering().then(buf => {
      // Vik in svansen i början så att loopen blir sömlös
      const n = Math.round(loopLen * sampleRate);
      const out = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate });
      for (let ch = 0; ch < 2; ch++) {
        const src = buf.getChannelData(ch), dst = out.getChannelData(ch);
        dst.set(src.subarray(0, n));
        for (let i = n; i < src.length; i++) dst[i - n] += src[i];
      }
      // Jämna ut ljudstyrkan (RMS) så att låtarna låter lika starka, och
      // runda av topparna mjukt i stället för att klippa
      let sum = 0;
      for (let ch = 0; ch < 2; ch++) {
        const d = out.getChannelData(ch);
        for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      }
      const rms = Math.sqrt(sum / (2 * n));
      const k = rms > 0 ? 0.24 / rms : 1;
      for (let ch = 0; ch < 2; ch++) {
        const d = out.getChannelData(ch);
        for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * k) * 0.95;
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
    g.gain.linearRampToValueAtTime(TRACK_LEVEL[name.split('/')[1]] || 1, now + (old ? 0.35 : 1.2));
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
    packs: Object.entries(PACKS).map(([id, p]) => ({ id, name: p.name, desc: p.desc })),
    roles: ROLES,
    tracks: Object.keys(PACKS).flatMap(p => ROLES.map(r => p + '/' + r)),
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
    preload(pack) { if (ensure()) ROLES.forEach(r => render((PACKS[pack] ? pack : 'circus') + '/' + r, ctx.sampleRate)); },
    // Instrumenten används också av ljudeffekterna
    I, hz,
    render
  };
})();
