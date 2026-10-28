/* DigitaHinos Coral – leitura de arquivos
 * MXL / MusicXML / MIDI / JSON  →  projeto do compositor (+ partitura escrita para o PDF)
 * A separação das 4 vozes (S A T B) segue o mesmo método usado nos hinários e no Violão Bounce:
 * pauta de cima = soprano (nota de cima) e contralto (nota de baixo); pauta de baixo = tenor e baixo.
 */
(function (global) {
  'use strict';
  const CC = (global.CC = global.CC || {});
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const SATB = ['S', 'A', 'T', 'B'];

  /* ───────────────────────── ZIP (.mxl) ───────────────────────── */

  function zipEntries(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Arquivo .mxl inválido');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      out.push({ name: new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)), method, csize, usize, lho });
      p += 46 + nl + el + cl;
    }
    return { u8, dv, out };
  }
  async function zipRead(z, ent) {
    const { u8, dv } = z, p = ent.lho, start = p + 30 + dv.getUint16(p + 26, true) + dv.getUint16(p + 28, true);
    const data = u8.subarray(start, start + ent.csize);
    if (ent.method === 0) return data;
    if (ent.method !== 8) throw new Error('Compressão não suportada');
    if (typeof DecompressionStream === 'function') {
      try {
        const r = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
        return new Uint8Array(await r.arrayBuffer());
      } catch (e) { /* usa o descompactador próprio */ }
    }
    return inflateRaw(data, ent.usize);
  }
  // descompactador próprio (reserva, para WebViews antigos sem DecompressionStream)
  function inflateRaw(src, usize) {
    const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258],
      LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0],
      DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577],
      DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13],
      ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    let out = new Uint8Array(usize || src.length * 4), op = 0, ip = 0, bit = 0, bc = 0;
    const grow = (n) => { if (op + n > out.length) { const t = new Uint8Array(Math.max(out.length * 2, op + n)); t.set(out); out = t; } };
    const bits = (n) => { while (bc < n) { bit |= src[ip++] << bc; bc += 8; } const v = bit & ((1 << n) - 1); bit >>>= n; bc -= n; return v; };
    const build = (lens) => {
      const count = new Uint16Array(16), symbol = new Uint16Array(lens.length), offs = new Uint16Array(16);
      for (let i = 0; i < lens.length; i++) count[lens[i]]++; count[0] = 0;
      for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
      for (let s = 0; s < lens.length; s++) if (lens[s]) symbol[offs[lens[s]]++] = s;
      return { count, symbol };
    };
    const decode = (h) => {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1); const c = h.count[len];
        if (code - c < first) return h.symbol[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw new Error('inflate');
    };
    let last;
    do {
      last = bits(1); const type = bits(2);
      if (type === 0) { bit = 0; bc = 0; const len = src[ip] | (src[ip + 1] << 8); ip += 4; grow(len); out.set(src.subarray(ip, ip + len), op); op += len; ip += len; }
      else if (type === 3) throw new Error('inflate');
      else {
        let lh, dh;
        if (type === 1) {
          const l = new Uint8Array(288); for (let i = 0; i < 288; i++) l[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8;
          lh = build(l); dh = build(new Uint8Array(30).fill(5));
        } else {
          const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, cl = new Uint8Array(19);
          for (let i = 0; i < nc; i++) cl[ORD[i]] = bits(3);
          const ch = build(cl), lens = new Uint8Array(nl + nd); let i = 0;
          while (i < nl + nd) {
            const s = decode(ch);
            if (s < 16) lens[i++] = s;
            else { let rep, val = 0; if (s === 16) { val = lens[i - 1]; rep = 3 + bits(2); } else if (s === 17) rep = 3 + bits(3); else rep = 11 + bits(7); while (rep--) lens[i++] = val; }
          }
          lh = build(lens.subarray(0, nl)); dh = build(lens.subarray(nl));
        }
        for (;;) {
          const s = decode(lh);
          if (s < 256) { grow(1); out[op++] = s; }
          else if (s === 256) break;
          else { const li = s - 257, len = LB[li] + bits(LE[li]), ds = decode(dh), dist = DB[ds] + bits(DE[ds]); grow(len); for (let k = 0; k < len; k++) { out[op] = out[op - dist]; op++; } }
        }
      }
    } while (!last);
    return out.subarray(0, op);
  }
  function decodeXml(u8) {
    if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8);
    if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8);
    let enc = 'utf-8'; const m = /encoding\s*=\s*["']([\w-]+)/i.exec(String.fromCharCode.apply(null, u8.subarray(0, 200)));
    if (m) enc = m[1];
    try { return new TextDecoder(enc).decode(u8).replace(/^\uFEFF/, ''); } catch (e) { return new TextDecoder('utf-8').decode(u8).replace(/^\uFEFF/, ''); }
  }
  async function readScoreXmlText(buf) {
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0x50 && u8[1] === 0x4B) {
      const z = zipEntries(buf); let target = null;
      const cont = z.out.find((e) => /^META-INF\/container\.xml$/i.test(e.name));
      if (cont) { const m = /full-path\s*=\s*["']([^"']+)["']/.exec(decodeXml(await zipRead(z, cont))); if (m) target = z.out.find((e) => e.name === m[1]); }
      if (!target) target = z.out.find((e) => /\.(xml|musicxml)$/i.test(e.name) && !/^META-INF\//i.test(e.name));
      if (!target) throw new Error('Nenhuma partitura dentro do .mxl');
      return decodeXml(await zipRead(z, target));
    }
    return decodeXml(u8);
  }

  /* ───────────────────────── MusicXML → partitura escrita ───────────────────────── */

  function parseMusicXML(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML inválido');
    const root = doc.documentElement;
    if (root.nodeName === 'score-timewise') throw new Error('MusicXML "timewise" não suportado — exporte como "partwise"');
    if (root.nodeName !== 'score-partwise') throw new Error('Não é um arquivo MusicXML');
    const ch = (el, n) => { const r = []; for (const c of el.children) if (c.nodeName === n) r.push(c); return r; };
    const c1 = (el, n) => { for (const c of el.children) if (c.nodeName === n) return c; return null; };
    const tx = (el, n) => { const c = el && c1(el, n); return c ? c.textContent.trim() : ''; };
    const nm = (el, n, d) => { const v = parseFloat(tx(el, n)); return isFinite(v) ? v : d; };
    const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, SIDX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
    const pnames = {}; const pl = c1(root, 'part-list');
    if (pl) ch(pl, 'score-part').forEach((sp) => { pnames[sp.getAttribute('id')] = tx(sp, 'part-name') || tx(sp, 'part-abbreviation'); });
    const parts = ch(root, 'part'), MI = [], evs = [];
    const tempoOf = (e) => {
      const snd = e.nodeName === 'sound' ? e : c1(e, 'sound');
      if (snd && snd.getAttribute('tempo')) return parseFloat(snd.getAttribute('tempo'));
      const met = e.getElementsByTagName('metronome')[0];
      if (met) {
        const pm = parseFloat(tx(met, 'per-minute'));
        if (pm > 0) { let q = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 }[tx(met, 'beat-unit')] || 1; if (c1(met, 'beat-unit-dot')) q *= 1.5; return pm * q; }
      }
      return 0;
    };
    parts.forEach((part, pi) => {
      let div = 1, beats = 4, bt = 4, trans = 0;
      ch(part, 'measure').forEach((m, mi) => {
        const info = MI[mi] || (MI[mi] = { ext: 0, nom: 4, fwd: false, bwd: false, volta: null, tempos: [], implicit: false, number: m.getAttribute('number') || String(mi + 1) });
        if (m.getAttribute('implicit') === 'yes') info.implicit = true;
        let cur = 0, lastOn = 0, ext = 0;
        for (const e of m.children) {
          const t = e.nodeName;
          if (t === 'attributes') {
            const d = nm(e, 'divisions', 0); if (d > 0) div = d;
            const ti = c1(e, 'time'); if (ti) { beats = parseInt(tx(ti, 'beats')) || beats; bt = parseInt(tx(ti, 'beat-type')) || bt; if (!info.time) info.time = beats + '/' + bt; }
            const k = c1(e, 'key'); if (k && info.fifths === undefined) { const f = parseInt(tx(k, 'fifths')); if (isFinite(f)) info.fifths = f; }
            const tr = c1(e, 'transpose'); if (tr) trans = (parseInt(tx(tr, 'chromatic')) || 0) + 12 * (parseInt(tx(tr, 'octave-change')) || 0);
          } else if (t === 'direction' || t === 'sound') {
            const bpm = tempoOf(e); if (bpm > 0 && pi === 0) info.tempos.push({ pos: cur / div, bpm });
          } else if (t === 'backup') cur -= nm(e, 'duration', 0);
          else if (t === 'forward') { cur += nm(e, 'duration', 0); ext = Math.max(ext, cur); }
          else if (t === 'barline') {
            const rp = c1(e, 'repeat'); if (rp) { if (rp.getAttribute('direction') === 'forward') info.fwd = true; else info.bwd = true; }
            const en = c1(e, 'ending'); if (en) { if (en.getAttribute('type') === 'start') info.endStart = (en.getAttribute('number') || '1').split(/[ ,]+/).map((s) => parseInt(s)).filter((x) => x > 0); else info.endStop = true; }
          } else if (t === 'note') {
            if (c1(e, 'grace')) continue;
            const isChord = !!c1(e, 'chord'), dur = nm(e, 'duration', 0), on = isChord ? lastOn : cur;
            if (!isChord) lastOn = cur;
            const pitch = c1(e, 'pitch');
            if (pitch && !c1(e, 'rest') && !c1(e, 'cue') && dur > 0 && STEP[tx(pitch, 'step')] !== undefined) {
              const stp = tx(pitch, 'step'), al = Math.round(nm(pitch, 'alter', 0)), oc = parseInt(tx(pitch, 'octave'));
              const midi = STEP[stp] + al + (oc + 1) * 12 + trans;
              let ties = ch(e, 'tie').map((x) => x.getAttribute('type'));
              if (!ties.length) { const nt = c1(e, 'notations'); if (nt) ties = ch(nt, 'tied').map((x) => x.getAttribute('type')); }
              let lyr = null;
              ch(e, 'lyric').forEach((l) => {
                let s = ''; for (const c of l.children) { if (c.nodeName === 'text') s += c.textContent; else if (c.nodeName === 'elision') s += ' '; }
                s = s.trim(); if (!s) return;
                (lyr = lyr || {})[l.getAttribute('number') || '1'] = { t: s, sy: tx(l, 'syllabic') };
              });
              const tmn = c1(e, 'time-modification');
              evs.push({
                part: pi, staff: parseInt(tx(e, 'staff')) || 1, voice: parseInt(tx(e, 'voice')) || 1, midi, sp: SIDX[stp], al, oc, mi,
                on: on / div, dur: dur / div, tS: ties.includes('start'), tE: ties.includes('stop'), stem: tx(e, 'stem'),
                lyr, tm: tmn ? [nm(tmn, 'actual-notes', 3), nm(tmn, 'normal-notes', 2)] : null,
              });
            }
            if (!isChord) cur += dur;
            ext = Math.max(ext, cur);
          }
        }
        info.ext = Math.max(info.ext, ext / div); info.nom = beats * 4 / bt; info.beats = beats; info.bt = bt;
      });
    });
    const n = MI.length; if (!n) throw new Error('Nenhum compasso encontrado');
    const len = MI.map((m) => (m.ext > 1e-6 ? m.ext : m.nom));
    let open = null; MI.forEach((m) => { if (m.endStart) open = m.endStart; m.volta = open; if (m.endStop) open = null; });
    // ordem de execução (repetições e casas 1ª/2ª)
    const order = [];
    {
      let i = 0, secStart = 0, pass = 1, jumped = false, guard = 0; const taken = new Set();
      while (i < n && guard++ < n * 12) {
        const m = MI[i];
        if (m.fwd && !(jumped && i === secStart)) { secStart = i; pass = 1; }
        jumped = false;
        if (m.volta && !m.volta.includes(pass)) { i++; continue; }
        order.push(i);
        if (m.bwd) { if (!taken.has(i)) { taken.add(i); i = secStart; pass++; jumped = true; continue; } secStart = i + 1; pass = 1; }
        i++;
      }
    }
    if (!order.length) for (let i = 0; i < n; i++) order.push(i);
    // posição escrita (em semínimas) de cada compasso e de cada nota
    const wstart = []; let wacc = 0; len.forEach((l, i) => { wstart[i] = wacc; wacc += l; });
    evs.forEach((x) => { x.s = wstart[x.mi] + x.on; });

    // ---- Reconhecimento SATB pela pauta (como nos hinários) ----
    const GR = new Map(); evs.forEach((x) => { const k = x.part + '|' + x.staff; if (!GR.has(k)) GR.set(k, { part: x.part, staff: x.staff, notes: [] }); GR.get(k).notes.push(x); });
    const grp = [...GR.values()].sort((a, b) => a.part - b.part || a.staff - b.staff);
    const avgN = (ns) => ns.reduce((a, x) => a + x.midi, 0) / ns.length;
    const splitStaff = (g) => {
      const vs = [...new Set(g.notes.map((x) => x.voice))].sort((a, b) => a - b), topV = vs[0];
      const byOn = new Map(); g.notes.forEach((x) => { const k = x.s.toFixed(3); if (!byOn.has(k)) byOn.set(k, []); byOn.get(k).push(x); });
      const up = [], dn = [], sr = (x) => (x.stem === 'up' ? 0 : x.stem === 'down' ? 2 : 1);
      byOn.forEach((a) => {
        if (a.length >= 2) {
          a.sort((p, q) => q.midi - p.midi || sr(p) - sr(q) || p.voice - q.voice);
          a.forEach((x, i) => { if (i === 0) up.push(x); else if (i === a.length - 1) dn.push(x); else (x.stem === 'down' ? dn : up).push(x); });
        } else {
          const x = a[0];
          if (x.stem === 'double') { up.push(x); dn.push(Object.assign({}, x, { dup: true })); }
          else if (x.stem === 'down') dn.push(x);
          else if (x.stem === 'up') up.push(x);
          else (vs.length > 1 && x.voice !== topV ? dn : up).push(x);
        }
      });
      return [up, dn];
    };
    let lines;
    if (grp.length === 2) {
      if (avgN(grp[1].notes) > avgN(grp[0].notes)) grp.reverse();
      lines = [...splitStaff(grp[0]), ...splitStaff(grp[1])].map((ns) => ({ notes: ns }));
    } else {
      const L = new Map(); evs.forEach((x) => { const k = x.part + '|' + x.staff + '|' + x.voice; if (!L.has(k)) L.set(k, { part: x.part, staff: x.staff, voice: x.voice, notes: [] }); L.get(k).notes.push(x); });
      lines = [...L.values()].sort((a, b) => a.part - b.part || a.staff - b.staff || a.voice - b.voice);
      if (!lines.length) throw new Error('Nenhuma nota encontrada');
      const perPart = {}; lines.forEach((l) => { perPart[l.part] = (perPart[l.part] || 0) + 1; });
      if (lines.length < 4) { // acordes dentro de uma voz → separa por altura
        lines = lines.flatMap((l) => {
          const g = new Map(); l.notes.forEach((x) => { const k = x.s.toFixed(3); if (!g.has(k)) g.set(k, []); g.get(k).push(x); });
          const mx = Math.min(4, Math.max(...[...g.values()].map((a) => a.length)));
          if (mx <= 1) return [l];
          const subs = Array.from({ length: mx }, () => ({ part: l.part, staff: l.staff, voice: l.voice, notes: [], split: true }));
          g.forEach((a) => { a.sort((p, q) => q.midi - p.midi); subs.forEach((s, r) => s.notes.push(Object.assign({}, a[Math.min(r, a.length - 1)], { dup: r >= a.length }))); });
          return subs;
        });
      }
      const avg = (l) => l.notes.reduce((a, x) => a + x.midi, 0) / l.notes.length;
      const cls = (s) => { s = (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); return /sopran/.test(s) ? 0 : /contralt|alto/.test(s) || /^a\.?$/.test(s) ? 1 : /tenor/.test(s) || /^t\.?$/.test(s) ? 2 : /bass|baix/.test(s) || /^b\.?$/.test(s) ? 3 : -1; };
      if (lines.length === 4) {
        const cs = lines.map((l) => (perPart[l.part] === 1 && !l.split ? cls(pnames[parts[l.part].getAttribute('id')]) : -1));
        if (cs.every((c) => c >= 0) && new Set(cs).size === 4) lines = cs.map((c, i) => [c, lines[i]]).sort((a, b) => a[0] - b[0]).map((a) => a[1]);
        else lines.sort((a, b) => avg(b) - avg(a));
      } else lines.sort((a, b) => avg(b) - avg(a));
    }
    lines = lines.filter((l) => l.notes.length);
    if (!lines.length) throw new Error('Nenhuma nota encontrada');
    // mapeia as linhas encontradas nas 4 vozes do coro
    const map4 = (k) => ({ 1: [0], 2: [0, 3], 3: [0, 1, 3], 4: [0, 1, 2, 3] }[k]);
    let vmap;
    if (lines.length <= 4) vmap = map4(lines.length);
    else { // mais de 4 linhas: as 4 maiores viram vozes, as demais entram na voz de altura mais próxima
      const big = lines.map((l, i) => [i, l.notes.length]).sort((a, b) => b[1] - a[1]).slice(0, 4).map((a) => a[0]).sort((a, b) => a - b);
      const avgL = (l) => l.notes.reduce((a, x) => a + x.midi, 0) / l.notes.length;
      lines.forEach((l, i) => {
        if (big.includes(i)) return;
        let best = big[0]; big.forEach((b) => { if (Math.abs(avgL(lines[b]) - avgL(l)) < Math.abs(avgL(lines[best]) - avgL(l))) best = b; });
        lines[best].notes.push(...l.notes);
      });
      lines = big.map((i) => lines[i]); vmap = map4(lines.length);
    }
    const events = [];
    lines.forEach((l, i) => l.notes.forEach((x) => { x.vc = vmap[i]; events.push(x); }));
    events.sort((a, b) => a.s - b.s || a.vc - b.vc);

    const firstMI = (f) => { const m = MI.find((x) => x[f] !== undefined); return m ? m[f] : null; };
    let bpm = 0; for (const m of MI) { if (m.tempos.length) { bpm = m.tempos[0].bpm; break; } }
    const measures = MI.map((m, i) => ({
      i, number: m.number, len: len[i], beats: m.beats || 4, bt: m.bt || 4, time: m.time || null, fifths: m.fifths,
      fwd: m.fwd, bwd: m.bwd, endStart: m.endStart || null, endStop: !!m.endStop, volta: m.volta, implicit: m.implicit, start: wstart[i],
    }));
    return { kind: 'score', title: tx(root.getElementsByTagName('work')[0] || root, 'work-title') || tx(root, 'movement-title') || '', bpm: bpm || 90, fifths: firstMI('fifths') || 0, timeSig: firstMI('time') || '4/4', measures, order, events };
  }

  /* ───────────────────────── partitura → projeto do compositor ───────────────────────── */

  const r3 = (x) => Math.round(x * 1000) / 1000;

  function scoreToProject(score, name) {
    const P = CC.defaultProject();
    P.name = (name || score.title || 'Sem título').slice(0, 80);
    P.bpm = clamp(Math.round(score.bpm || 90), 30, 240);
    // compasso predominante (em semínimas)
    const tally = new Map(); score.measures.forEach((m) => { if (m.implicit) return; const k = Math.round(m.len * 2) / 2; tally.set(k, (tally.get(k) || 0) + 1); });
    let beats = 4, bc = -1; tally.forEach((c, k) => { if (c > bc) { bc = c; beats = k; } });
    P.beats = clamp(beats || 4, 1, 12);
    P.ts = score.timeSig || null;
    P.ks = score.fifths || 0;
    // desenrola as repetições e junta as ligaduras de prolongamento
    const byM = score.measures.map(() => []); score.events.forEach((e) => byM[e.mi].push(e));
    let acc = 0; const abs = [];
    score.order.forEach((mi) => { byM[mi].forEach((e) => abs.push({ e, s: acc + e.on, f: acc + e.on + e.dur })); acc += score.measures[mi].len; });
    abs.sort((a, b) => a.s - b.s);
    const pend = new Map(), merged = [];
    abs.forEach((x) => {
      const k = x.e.vc + '|' + x.e.midi, p = pend.get(k);
      if (x.e.tE && p && Math.abs(p.f - x.s) < 0.06) { p.f = x.f; if (!x.e.tS) pend.delete(k); return; }
      const nn = { v: SATB[x.e.vc], m: clamp(x.e.midi, 0, 127), s: x.s, f: x.f };
      merged.push(nn); if (x.e.tS) pend.set(k, nn); else pend.delete(k);
    });
    const seen = new Set();
    merged.forEach((x) => {
      const key = x.v + '|' + x.m + '|' + x.s.toFixed(3); if (seen.has(key)) return; seen.add(key);
      const d = r3((x.f - x.s) * 4); if (d <= 0) return;
      P.notes.push({ v: x.v, m: x.m, s: r3(x.s * 4), d });
    });
    const spm = P.beats * 4;
    P.measures = clamp(Math.ceil(acc * 4 / spm - 1e-9), 1, 256);
    return P;
  }

  /* ───────────────────────── tonalidade (quando o arquivo não informa) ───────────────────────── */

  function guessFifths(notes) {
    const W = new Float64Array(12); notes.forEach((n) => { W[((n.m % 12) + 12) % 12] += n.d; });
    const major = [0, 2, 4, 5, 7, 9, 11], F = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
    let best = 0, bs = -1e9;
    for (let t = 0; t < 12; t++) {
      let s = 0; major.forEach((x) => { s += W[(t + x) % 12]; });
      s += (W[t] + W[(t + 7) % 12]) * 0.15 - Math.abs(F[t]) * 0.4;
      if (s > bs) { bs = s; best = t; }
    }
    return F[best];
  }

  /* ───────────────────────── MIDI → projeto ───────────────────────── */

  function parseMidi(buf, name) {
    const d = new Uint8Array(buf); let p = 0;
    const r8 = () => d[p++], r16 = () => (d[p++] << 8) | d[p++], r32 = () => ((d[p++] << 24) | (d[p++] << 16) | (d[p++] << 8) | d[p++]) >>> 0;
    const rVL = () => { let v = 0, b; do { b = r8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80 && p < d.length); return v; };
    if (String.fromCharCode(d[0], d[1], d[2], d[3]) !== 'MThd') throw new Error('Não é um arquivo MIDI');
    p = 8; const fmt = r16(), nT = r16(), div = r16();
    const ppq = (div & 0x8000) ? 480 : (div || 480);
    let tempo = 0, num = 0, den = 4, fifths = null, title = '';
    const lines = new Map(); // "trilha|canal" → {name, notes}
    for (let t = 0; t < nT; t++) {
      while (p + 8 <= d.length && String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]) !== 'MTrk') { p += 4; p += r32(); }
      if (p + 8 > d.length) break;
      p += 4; const tl = r32(), te = Math.min(d.length, p + tl);
      let tick = 0, rs = 0, tname = ''; const open = new Map();
      while (p < te) {
        tick += rVL(); let sb = d[p];
        if (sb < 0x80) sb = rs; else { rs = sb; p++; }
        const cmd = sb >> 4, ch = sb & 15;
        if (cmd === 9 || cmd === 8) {
          const note = r8(), vel = r8(), key = ch + '|' + note;
          if (cmd === 9 && vel > 0) { if (!open.has(key)) open.set(key, []); open.get(key).push(tick); }
          else {
            const q = open.get(key);
            if (q && q.length) {
              const t0 = q.shift();
              if (ch !== 9) {
                const lk = t + '|' + ch;
                if (!lines.has(lk)) lines.set(lk, { name: tname, notes: [] });
                lines.get(lk).notes.push({ m: note, t0, t1: tick });
              }
            }
          }
        } else if (cmd === 0xA || cmd === 0xB || cmd === 0xE) { p += 2; }
        else if (cmd === 0xC || cmd === 0xD) { p += 1; }
        else if (sb === 0xFF) {
          const mt = r8(), ml = rVL();
          if (mt === 0x51 && ml === 3 && !tempo) tempo = (d[p] << 16) | (d[p + 1] << 8) | d[p + 2];
          else if (mt === 0x58 && ml >= 2 && !num) { num = d[p]; den = 1 << d[p + 1]; }
          else if (mt === 0x59 && ml >= 2 && fifths === null) { const f = d[p]; fifths = f > 127 ? f - 256 : f; }
          else if (mt === 0x03) { tname = decodeXml(d.subarray(p, p + ml)); if (t === 0 && fmt !== 0 && !title) title = tname; }
          p += ml;
        } else if (sb === 0xF0 || sb === 0xF7) { p += rVL(); }
        else break;
      }
      p = te;
    }
    let L = [...lines.values()].filter((l) => l.notes.length);
    if (!L.length) throw new Error('Nenhuma nota encontrada no MIDI');
    const avg = (l) => l.notes.reduce((a, x) => a + x.m, 0) / l.notes.length;
    const cls = (s) => { s = (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); return /sopran/.test(s) ? 0 : /contralt|alto/.test(s) ? 1 : /tenor/.test(s) ? 2 : /bass|baix/.test(s) ? 3 : -1; };
    // vozes escritas como acorde numa única linha → separa por altura
    if (L.length < 4) {
      L = L.flatMap((l) => {
        const g = new Map(); l.notes.forEach((x) => { const k = Math.round(x.t0 / (ppq / 4)); if (!g.has(k)) g.set(k, []); g.get(k).push(x); });
        const mx = Math.min(4, Math.max(...[...g.values()].map((a) => a.length)));
        if (mx <= 1) return [l];
        const subs = Array.from({ length: mx }, () => ({ name: l.name, notes: [] }));
        g.forEach((a) => { a.sort((x, y) => y.m - x.m); a.forEach((x, r) => subs[Math.min(r, mx - 1)].notes.push(x)); });
        return subs;
      });
    }
    let vmap;
    if (L.length === 4 && L.every((l) => cls(l.name) >= 0) && new Set(L.map((l) => cls(l.name))).size === 4) {
      L.sort((a, b) => cls(a.name) - cls(b.name)); vmap = [0, 1, 2, 3];
    } else {
      L.sort((a, b) => avg(b) - avg(a));
      if (L.length > 4) {
        const big = L.map((l, i) => [i, l.notes.length]).sort((a, b) => b[1] - a[1]).slice(0, 4).map((a) => a[0]).sort((a, b) => a - b);
        L.forEach((l, i) => {
          if (big.includes(i)) return;
          let best = big[0]; big.forEach((b) => { if (Math.abs(avg(L[b]) - avg(l)) < Math.abs(avg(L[best]) - avg(l))) best = b; });
          L[best].notes.push(...l.notes);
        });
        L = big.map((i) => L[i]);
      }
      vmap = ({ 1: [0], 2: [0, 3], 3: [0, 1, 3], 4: [0, 1, 2, 3] })[L.length];
    }
    const P = CC.defaultProject();
    P.name = (name || title || 'MIDI importado').slice(0, 80);
    P.bpm = clamp(Math.round(60000000 / (tempo || 500000)), 30, 240);
    const beatsQ = num ? num * 4 / den : 4;
    P.beats = clamp(Math.round(beatsQ * 2) / 2, 1, 12);
    if (num) P.ts = num + '/' + den;
    const k = 4 / ppq; // ticks → passos (1/16)
    L.forEach((l, i) => l.notes.forEach((x) => {
      const s = Math.round(x.t0 * k), e = Math.max(s + 1, Math.round(x.t1 * k));
      P.notes.push({ v: SATB[vmap[i]], m: clamp(x.m, 0, 127), s, d: e - s });
    }));
    P.ks = fifths !== null ? fifths : guessFifths(P.notes);
    let end = 0; P.notes.forEach((n) => { end = Math.max(end, n.s + n.d); });
    P.measures = clamp(Math.ceil(end / (P.beats * 4)), 1, 256);
    return P;
  }

  /* ───────────────────────── projeto → partitura (para o PDF de projetos livres) ───────────────────────── */

  function projectToScore(P) {
    const spm = P.beats * 4, nm = P.measures || 1;
    const fifths = P.ks != null ? P.ks : guessFifths(P.notes);
    const tsOf = P.ts || (Number.isInteger(P.beats) ? P.beats + '/4' : (P.beats * 2) + '/8');
    const [tn, td] = tsOf.split('/').map(Number);
    const measures = []; for (let i = 0; i < nm; i++) measures.push({ i, number: String(i + 1), len: P.beats, beats: tn, bt: td, time: i === 0 ? tsOf : null, fifths: i === 0 ? fifths : undefined, fwd: false, bwd: false, endStart: null, endStop: false, volta: null, implicit: false, start: i * P.beats });
    const events = [];
    const SI = { 0: [0, 0], 1: [0, 1], 2: [1, 0], 3: [1, 1], 4: [2, 0], 5: [3, 0], 6: [3, 1], 7: [4, 0], 8: [4, 1], 9: [5, 0], 10: [5, 1], 11: [6, 0] };
    const FL = { 1: [1, -1], 3: [2, -1], 6: [4, -1], 8: [5, -1], 10: [6, -1] };
    P.notes.forEach((n) => {
      const vc = SATB.indexOf(n.v); if (vc < 0) return;
      let s = n.s, e = n.s + n.d;
      while (s < e - 1e-6) {
        const mi = Math.min(nm - 1, Math.floor(s / spm + 1e-9)), mEnd = (mi + 1) * spm, cut = Math.min(e, mEnd);
        const pc = ((n.m % 12) + 12) % 12; let sp, al;
        if (SI[pc][1] === 0) { sp = SI[pc][0]; al = 0; } else if (fifths < 0) { sp = FL[pc][0]; al = -1; } else { sp = SI[pc][0]; al = 1; }
        const oc = Math.floor(n.m / 12) - 1 + ((sp === 6 && al === 1) ? 0 : 0);
        events.push({ vc, midi: n.m, sp, al, oc, mi, on: (s - mi * spm) / 4, dur: (cut - s) / 4, tS: cut < e - 1e-6, tE: s > n.s + 1e-6, stem: '', lyr: null, tm: null, s: s / 4 });
        s = cut;
      }
    });
    events.sort((a, b) => a.s - b.s || a.vc - b.vc);
    return { kind: 'score', title: P.name, bpm: P.bpm, fifths, timeSig: tsOf, measures, order: measures.map((m) => m.i), events };
  }

  /* ───────────────────────── Entrada geral ───────────────────────── */

  const isMidi = (u8) => u8[0] === 0x4D && u8[1] === 0x54 && u8[2] === 0x68 && u8[3] === 0x64;

  /** Lê qualquer arquivo suportado. Devolve { project, score|null, kind }. */
  async function importBuffer(buf, filename) {
    const u8 = new Uint8Array(buf);
    const base = String(filename || '').replace(/\.[^.]+$/, '');
    if (isMidi(u8)) return { project: parseMidi(buf, base), score: null, kind: 'mid' };
    const head = String.fromCharCode.apply(null, u8.subarray(0, 4)).trimStart();
    if ((u8[0] === 0x50 && u8[1] === 0x4B) || head[0] === '<' || u8[0] === 0xEF || u8[0] === 0xFF || u8[0] === 0xFE) {
      const score = parseMusicXML(await readScoreXmlText(buf));
      return { project: scoreToProject(score, score.title || base), score, kind: 'xml' };
    }
    if (head[0] === '{' || head[0] === '[') {
      const raw = JSON.parse(decodeXml(u8));
      const project = CC.sanitizeProject(raw.notes ? raw : (raw.data || raw));
      if (!project.name || project.name === 'Sem título') project.name = base || project.name;
      return { project, score: null, kind: 'json' };
    }
    throw new Error('Formato não reconhecido. Use .mid, .mxl, .musicxml, .xml ou .json');
  }

  async function importFile(file) {
    const buf = await file.arrayBuffer();
    return importBuffer(buf, file.name);
  }

  Object.assign(CC, { parseMusicXML, scoreToProject, projectToScore, parseMidi, importBuffer, importFile, guessFifths });
})(typeof window !== 'undefined' ? window : globalThis);
