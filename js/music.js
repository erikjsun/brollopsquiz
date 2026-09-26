/*
 * Game show-musik som genereras direkt i webbläsaren (WebAudio).
 * Inga ljudfiler, inga rättigheter, funkar offline.
 *
 * Varje låt renderas en gång till en ljudbuffert (OfflineAudioContext) och
 * loopas sedan sömlöst. Byte mellan låtar sker med en kort övertoning.
 *
 *   theme   – Showtema: glad, snabb dur-låt med studsig bas, blås och melodi
 *   bed     – Bakgrund: lättare och gladlynt, att prata över
 *   tension – Spänning: tickande "tänkmusik" som stiger mot avslöjandet
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

  // ---------------- Låtar ----------------
  // play(ctx, mix, t0, S): mix.ch(pan, reverb) ger en kanal, S = en sextondel i sekunder
  const up = (n, semis) => midi(n) + semis; // transponera (ger midi-nummer)

  const TRACKS = {
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
    const tr = TRACKS[name];
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
