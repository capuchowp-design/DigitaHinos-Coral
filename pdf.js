/* DigitaHinos Coral – partitura em PDF
 * Gravador de partitura SATB em duas pautas (S+A na clave de sol, T+B na clave de fá), com armadura,
 * fórmula de compasso, ligaduras, repetições, casas 1ª/2ª e letras das estrofes.
 * O mesmo desenho gera o PDF (vetorial, sem imagens) e a visualização em SVG.
 */
(function (global) {
  'use strict';
  const CC = (global.CC = global.CC || {});

  /* ───────────────────────── Documento vetorial ───────────────────────── */

  let measCtx = null;
  function textW(s, size, bold) {
    if (!measCtx) { const cv = document.createElement('canvas'); measCtx = cv.getContext('2d'); }
    measCtx.font = (bold ? 'bold ' : '') + '100px Helvetica, Arial, "Liberation Sans", sans-serif';
    return measCtx.measureText(s).width * size / 100;
  }

  class Doc {
    constructor(W, H) { this.W = W; this.H = H; this.pages = []; this.newPage(); }
    newPage() { this.cur = []; this.pages.push(this.cur); }
    path(c, o) { this.cur.push(Object.assign({ t: 'p', c, fill: false, stroke: false, lw: 0.6, color: '#000', cap: 0, join: 0 }, o)); }
    line(x1, y1, x2, y2, lw, color) { this.path([['M', x1, y1], ['L', x2, y2]], { stroke: true, lw: lw || 0.6, color: color || '#000' }); }
    rect(x, y, w, h, color) { this.path([['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']], { fill: true, color: color || '#000' }); }
    ellipse(cx, cy, rx, ry, ang, o) {
      const k = 0.5522847498, ca = Math.cos(ang), sa = Math.sin(ang);
      const P = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
      const pts = [[rx, 0], [rx, ry * k], [rx * k, ry], [0, ry], [-rx * k, ry], [-rx, ry * k], [-rx, 0], [-rx, -ry * k], [-rx * k, -ry], [0, -ry], [rx * k, -ry], [rx, -ry * k], [rx, 0]].map((q) => P(q[0], q[1]));
      const c = [['M', pts[0][0], pts[0][1]]];
      for (let i = 0; i < 4; i++) c.push(['C', pts[1 + i * 3][0], pts[1 + i * 3][1], pts[2 + i * 3][0], pts[2 + i * 3][1], pts[3 + i * 3][0], pts[3 + i * 3][1]]);
      c.push(['Z']);
      this.path(c, Object.assign({ fill: true }, o));
    }
    text(x, y, s, size, o) { this.cur.push(Object.assign({ t: 't', x, y, s: String(s), size, font: 'r', anchor: 'l', color: '#000' }, o)); }

    /* ── SVG ── */
    pageSvg(i) {
      const f = (n) => (Math.round(n * 100) / 100);
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + this.W + ' ' + this.H + '" width="100%" style="display:block;background:#fff">';
      this.pages[i].forEach((p) => {
        if (p.t === 'p') {
          const d = p.c.map((c) => c[0] + c.slice(1).map(f).join(' ')).join('');
          out += '<path d="' + d + '" fill="' + (p.fill ? p.color : 'none') + '"' + (p.stroke ? ' stroke="' + p.color + '" stroke-width="' + p.lw + '" stroke-linecap="' + (p.cap ? 'round' : 'butt') + '" stroke-linejoin="' + (p.join ? 'round' : 'miter') + '"' : '') + '/>';
        } else {
          out += '<text x="' + f(p.x) + '" y="' + f(p.y) + '" font-size="' + p.size + '" font-family="Helvetica,Arial,sans-serif" fill="' + p.color + '"'
            + (p.font === 'b' ? ' font-weight="bold"' : '') + (p.font === 'i' ? ' font-style="italic"' : '')
            + ' text-anchor="' + (p.anchor === 'm' ? 'middle' : p.anchor === 'r' ? 'end' : 'start') + '">' + esc(p.s) + '</text>';
        }
      });
      return out + '</svg>';
    }

    /* ── PDF ── */
    toPdf(info) {
      const enc = new TextEncoder();
      const CP = { 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2026: 0x85 };
      const pstr = (s) => {
        let o = '(';
        for (const ch of s) {
          let c = ch.codePointAt(0); if (CP[c]) c = CP[c];
          if (c === 40 || c === 41 || c === 92) o += '\\' + ch;
          else if (c < 32 || c > 126) o += '\\' + (c > 255 ? 63 : c).toString(8).padStart(3, '0');
          else o += ch;
        }
        return o + ')';
      };
      const n2 = (n) => (Math.round(n * 100) / 100).toString();
      const rgb = (h) => { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; const v = parseInt(h.slice(1), 16); return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255].map((x) => n2(x * 1000 / 1000)).join(' '); };
      const H = this.H;
      const objs = []; const add = (s) => { objs.push(s); return objs.length; };
      add('<< /Type /Catalog /Pages 2 0 R >>');         // 1
      add('');                                          // 2 (Pages, preenchido depois)
      add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');        // 3
      add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');   // 4
      add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>'); // 5
      const infoObj = add('<< /Title ' + pstr((info && info.title) || 'Partitura') + ' /Creator ' + pstr('DigitaHinos Coral') + ' /Producer ' + pstr('DigitaHinos Coral') + ' >>'); // 6
      const pageIds = [];
      this.pages.forEach((pg) => {
        let s = '';
        pg.forEach((p) => {
          if (p.t === 'p') {
            s += (p.fill ? rgb(p.color) + ' rg ' : '') + (p.stroke ? rgb(p.color) + ' RG ' + n2(p.lw) + ' w ' + (p.cap ? '1 J 1 j ' : '0 J 0 j ') : '');
            p.c.forEach((c) => {
              if (c[0] === 'M') s += n2(c[1]) + ' ' + n2(H - c[2]) + ' m ';
              else if (c[0] === 'L') s += n2(c[1]) + ' ' + n2(H - c[2]) + ' l ';
              else if (c[0] === 'C') s += n2(c[1]) + ' ' + n2(H - c[2]) + ' ' + n2(c[3]) + ' ' + n2(H - c[4]) + ' ' + n2(c[5]) + ' ' + n2(H - c[6]) + ' c ';
              else if (c[0] === 'Z') s += 'h ';
            });
            s += (p.fill && p.stroke ? 'B' : p.fill ? 'f' : 'S') + '\n';
          } else {
            let x = p.x; const w = textW(p.s, p.size, p.font === 'b');
            if (p.anchor === 'm') x -= w / 2; else if (p.anchor === 'r') x -= w;
            s += rgb(p.color) + ' rg BT /' + (p.font === 'b' ? 'F2' : p.font === 'i' ? 'F3' : 'F1') + ' ' + n2(p.size) + ' Tf ' + n2(x) + ' ' + n2(H - p.y) + ' Td ' + pstr(p.s) + ' Tj ET\n';
          }
        });
        const cid = add('<< /Length ' + enc.encode(s).length + ' >>\nstream\n' + s + 'endstream');
        pageIds.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n2(this.W) + ' ' + n2(H) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ' + cid + ' 0 R >>'));
      });
      objs[1] = '<< /Type /Pages /Count ' + pageIds.length + ' /Kids [' + pageIds.map((i) => i + ' 0 R').join(' ') + '] >>';
      // monta o arquivo (textos já são ASCII; o conteúdo das páginas usa só escapes octais)
      const parts = []; const offs = []; let len = 0;
      const push = (str) => { const b = enc.encode(str); parts.push(b); len += b.length; };
      push('%PDF-1.4\n');
      objs.forEach((o, i) => { offs.push(len); push((i + 1) + ' 0 obj\n' + o + '\nendobj\n'); });
      const xref = len;
      push('xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
      push('trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + infoObj + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
      const out = new Uint8Array(len); let o = 0; parts.forEach((b) => { out.set(b, o); o += b.length; });
      return out;
    }
  }

  /* ───────────────────────── Gravação da partitura ───────────────────────── */

  const SP = 4.8;                 // espaço da pauta (pt)
  const NOTE_RX = 3.05, NOTE_RY = 2.2;
  const STD = [6, 4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.125, 0.0625];
  const EPS = 1e-4;
  const SHARP_POS = { t: [8, 5, 9, 6, 3, 7, 4], b: [6, 3, 7, 4, 1, 5, 2] };
  const FLAT_POS = { t: [4, 7, 3, 6, 2, 5, 1], b: [2, 5, 1, 4, 0, 3, 6] };
  const SHARP_STEPS = [3, 0, 4, 1, 5, 2, 6];   // F C G D A E B (índice C=0)
  const FLAT_STEPS = [6, 2, 5, 1, 4, 0, 3];    // B E A D G C F
  const D_BOTTOM = { t: 4 * 7 + 2, b: 2 * 7 + 4 };  // E4 / G2

  function splitDur(q) {
    const out = []; let r = q;
    for (let g = 0; g < 8 && r > EPS; g++) {
      let pick = null; for (const v of STD) if (v <= r + EPS) { pick = v; break; }
      if (pick == null) break; out.push(pick); r -= pick;
    }
    return out;
  }

  function keyAlterMap(fifths) {
    const a = [0, 0, 0, 0, 0, 0, 0];
    if (fifths > 0) for (let i = 0; i < fifths; i++) a[SHARP_STEPS[i]] = 1;
    if (fifths < 0) for (let i = 0; i < -fifths; i++) a[FLAT_STEPS[i]] = -1;
    return a;
  }

  function keyName(fifths, minor) {
    const M = ['Dó', 'Sol', 'Ré', 'Lá', 'Mi', 'Si', 'Fá sustenido', 'Dó sustenido'], Fm = ['Dó', 'Fá', 'Si bemol', 'Mi bemol', 'Lá bemol', 'Ré bemol', 'Sol bemol', 'Dó bemol'];
    const mi = ['Lá', 'Mi', 'Si', 'Fá sustenido', 'Dó sustenido', 'Sol sustenido', 'Ré sustenido', 'Lá sustenido'], mf = ['Lá', 'Ré', 'Sol', 'Dó', 'Fá', 'Si bemol', 'Mi bemol', 'Lá bemol'];
    const k = Math.abs(fifths);
    if (minor) return (fifths >= 0 ? mi[k] : mf[k]) + ' menor';
    return (fifths >= 0 ? M[k] : Fm[k]) + ' maior';
  }

  /** Monta o desenho. Devolve { doc, layout } onde layout descreve onde cada compasso/coluna caiu (para o cursor). */
  function engrave(score, opts) {
    opts = opts || {};
    const W = 595.28, H = 841.89, ML = 40, MR = 40, MT = 40, MB = 44;
    const doc = new Doc(W, H);
    const meas = score.measures, nM = meas.length;
    const fifths = score.fifths || 0, keyAl = keyAlterMap(fifths);
    const ev = score.events;

    /* ─ versos ─ */
    let nVerses = 0; ev.forEach((e) => { if (e.lyr) Object.keys(e.lyr).forEach((k) => { nVerses = Math.max(nVerses, parseInt(k) || 1); }); });
    const LYR = 8.2, LYR_LH = 10.2;

    /* ─ organiza os eventos por compasso e pauta ─ */
    const byM = meas.map(() => ({ t: [], b: [] }));
    ev.forEach((e) => { if (e.mi >= 0 && e.mi < nM) byM[e.mi][e.vc < 2 ? 't' : 'b'].push(e); });

    // junta eventos de uma linha (voz) que começam juntos e têm a mesma duração → acorde
    function lineObjs(events, mLen, vcWanted) {
      const mp = new Map();
      events.filter((e) => e.vc === vcWanted).forEach((e) => {
        const k = e.on.toFixed(4) + '|' + e.dur.toFixed(4);
        if (!mp.has(k)) mp.set(k, { on: e.on, dur: e.dur, ev: [], tm: e.tm });
        mp.get(k).ev.push(e);
      });
      const arr = [...mp.values()].sort((a, b) => a.on - b.on || a.dur - b.dur);
      // notas que se sobrepõem dentro da mesma linha: encurta a anterior
      for (let i = 0; i + 1 < arr.length; i++) {
        if (arr[i].on + arr[i].dur > arr[i + 1].on + EPS && arr[i + 1].on > arr[i].on + EPS) arr[i].dur = arr[i + 1].on - arr[i].on;
      }
      return arr;
    }

    /** Divide uma duração (em semínimas) em figuras escritas, respeitando quiálteras. */
    function figures(dur, tm) {
      const scale = tm ? tm[0] / tm[1] : 1;
      return splitDur(dur * scale).map((v) => ({ q: v, snd: v / scale }));
    }

    /* ─ Desenha-se compasso a compasso; primeiro calcula-se o "plano" (colunas e larguras) ─ */
    function planStaff(kind, mi) {
      const events = byM[mi][kind], mLen = meas[mi].len;
      const vcU = kind === 't' ? 0 : 2, vcL = kind === 't' ? 1 : 3;
      const U = lineObjs(events, mLen, vcU), L = lineObjs(events, mLen, vcL);
      const items = []; // {on, snd, q, notes, stem, line, rest, tieNext, tm}
      const dedupe = (notes) => { const seen = new Set(), o = []; notes.forEach((n) => { const k = n.sp + '|' + n.oc + '|' + n.al; if (!seen.has(k)) { seen.add(k); o.push(n); } }); return o; };
      // acordes compartilhados: mesma entrada e mesma duração nas duas vozes
      const lk = new Map(); L.forEach((o) => lk.set(o.on.toFixed(4) + '|' + o.dur.toFixed(4), o));
      const sharedKeys = new Set();
      U.forEach((o) => { const k = o.on.toFixed(4) + '|' + o.dur.toFixed(4); if (lk.has(k)) sharedKeys.add(k); });
      const mk = (o, line) => ({ on: o.on, dur: o.dur, notes: dedupe(o.ev), line, tm: o.tm });
      const objs = [];
      U.forEach((o) => { const k = o.on.toFixed(4) + '|' + o.dur.toFixed(4); if (sharedKeys.has(k)) { const m = mk(o, 'S'); m.notes = dedupe(o.ev.concat(lk.get(k).ev)); objs.push(m); } else objs.push(mk(o, 'U')); });
      L.forEach((o) => { const k = o.on.toFixed(4) + '|' + o.dur.toFixed(4); if (!sharedKeys.has(k)) objs.push(mk(o, 'L')); });
      objs.sort((a, b) => a.on - b.on || (a.line === 'U' ? -1 : 1));
      // decompõe cada objeto em figuras (com ligaduras quando necessário) e calcula posição na pauta
      const dB = D_BOTTOM[kind];
      objs.forEach((o) => {
        o.notes.forEach((n) => { n.pos = n.oc * 7 + n.sp - dB; });
        o.notes.sort((a, b) => a.pos - b.pos);
        const figs = figures(o.dur, o.tm); let t = o.on;
        figs.forEach((f, i) => {
          items.push({ on: t, snd: f.snd, q: f.q, notes: o.notes, line: o.line, tm: o.tm, tieNext: i < figs.length - 1, tieFromPrev: i > 0, first: i === 0, src: o });
          t += f.snd;
        });
      });
      // pausas: lacunas em cada linha
      const gaps = (line) => {
        const own = items.filter((it) => it.line === line || it.line === 'S').sort((a, b) => a.on - b.on);
        const g = []; let t = 0;
        own.forEach((it) => { if (it.on > t + EPS) g.push([t, it.on]); t = Math.max(t, it.on + it.snd); });
        if (t < mLen - EPS) g.push([t, mLen]);
        return g;
      };
      const gU = gaps('U'), gL = gaps('L');
      const hasU = items.some((i) => i.line === 'U' || i.line === 'S'), hasL = items.some((i) => i.line === 'L' || i.line === 'S');
      const sameG = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x[0] - b[i][0]) < EPS && Math.abs(x[1] - b[i][1]) < EPS);
      const restItems = [];
      const addRests = (g, line, tag) => {
        g.forEach(([a, b]) => {
          if (Math.abs(a) < EPS && Math.abs(b - mLen) < EPS && (tag === 'S' || true)) { restItems.push({ on: a, snd: b - a, q: b - a, rest: true, whole: true, line: tag }); return; }
          let t = a; splitDur(b - a).forEach((v) => { restItems.push({ on: t, snd: v, q: v, rest: true, line: tag }); t += v; });
        });
      };
      if (!items.length) addRests([[0, mLen]], 'S', 'S');
      else if (sameG(gU, gL)) addRests(gU, 'S', 'S');
      else { if (hasU || !hasL) addRests(gU, 'U', 'U'); if (hasL) addRests(gL, 'L', 'L'); }
      return items.concat(restItems).sort((a, b) => a.on - b.on || (a.rest ? 1 : -1));
    }

    /* ─ planos de cada compasso (colunas, larguras, acidentes) ─ */
    const plans = meas.map((m, mi) => {
      const staves = { t: planStaff('t', mi), b: planStaff('b', mi) };
      const colSet = new Set(); ['t', 'b'].forEach((k) => staves[k].forEach((it) => colSet.add(it.on.toFixed(4))));
      const onsets = [...colSet].map(Number).sort((a, b) => a - b);
      const colIdx = new Map(); onsets.forEach((o, i) => colIdx.set(o.toFixed(4), i));
      // acidentes por pauta (estado do compasso)
      ['t', 'b'].forEach((k) => {
        const state = new Map();
        const list = staves[k].filter((it) => !it.rest).sort((a, b) => a.on - b.on);
        const done = new Set();
        list.forEach((it) => {
          it.notes.forEach((n) => {
            if (n.accDone) return;
            const d = n.oc * 7 + n.sp, cur = state.has(d) ? state.get(d) : keyAl[n.sp];
            const tiedIn = it.tieFromPrev || n.tE;
            if (n.al !== cur && !tiedIn) n.acc = n.al === 1 ? 's' : n.al === -1 ? 'f' : 'n';
            state.set(d, n.al);
          });
        });
        // cada nota guarda o acidente na primeira figura apenas
        list.forEach((it) => { if (!it.first && it.first !== undefined) it.noAcc = true; });
      });
      // largura das colunas
      const cols = onsets.map((on, i) => {
        const nxt = i + 1 < onsets.length ? onsets[i + 1] : m.len;
        let accCols = 0;
        ['t', 'b'].forEach((k) => staves[k].forEach((it) => {
          if (it.rest || Math.abs(it.on - on) > EPS || it.noAcc) return;
          const withAcc = it.notes.filter((n) => n.acc).sort((a, b) => b.pos - a.pos);
          const last = []; withAcc.forEach((n) => { let c = last.findIndex((p) => p - n.pos >= 5); if (c < 0) { c = last.length; last.push(n.pos); } else last[c] = n.pos; n.accCol = c; });
          accCols = Math.max(accCols, last.length);
        }));
        // largura das letras
        let lw = 0;
        staves.t.forEach((it) => { if (it.rest || Math.abs(it.on - on) > EPS || !it.first) return; const ly = it.notes.map((n) => n.lyr).find(Boolean); if (ly) Object.keys(ly).forEach((v) => { const w = textW(ly[v].t, LYR) + (ly[v].sy === 'begin' || ly[v].sy === 'middle' ? 5 : 2); lw = Math.max(lw, w); }); });
        return { on, dur: nxt - on, pre: accCols ? 8.5 + (accCols - 1) * 6.5 : 0, lw, x: 0 };
      });
      return { staves, cols, colIdx };
    });

    // lyric por nota: pega do evento da pauta de cima (primeira nota do acorde com letra)
    plans.forEach((pl) => pl.staves.t.forEach((it) => { if (!it.rest) { const n = it.notes.find((x) => x.lyr); it.lyrData = n ? n.lyr : null; } }));
    // (compatibilidade com o cálculo de largura acima)
    plans.forEach((pl) => {
      pl.cols.forEach((c) => {
        let lw = 0;
        pl.staves.t.forEach((it) => { if (it.rest || Math.abs(it.on - c.on) > EPS || !it.first || !it.lyrData) return; Object.keys(it.lyrData).forEach((v) => { const d = it.lyrData[v]; lw = Math.max(lw, textW(d.t, LYR) + (d.sy === 'begin' || d.sy === 'middle' ? 5 : 2)); }); });
        c.lw = lw;
      });
    });

    /* ─ posições x das colunas dentro de cada compasso (largura natural) ─ */
    const gapFor = (d) => 11 + 15 * Math.sqrt(Math.max(0.125, d));
    plans.forEach((pl, mi) => {
      let x = 9;
      pl.cols.forEach((c, i) => {
        if (i === 0) x += c.pre; else {
          const prev = pl.cols[i - 1];
          const base = gapFor(prev.dur) + c.pre;
          const minLy = (prev.lw + c.lw) / 2 + 3;
          x = prev.x + Math.max(base, minLy, 13 + c.pre);
        }
        c.x = x;
      });
      const last = pl.cols[pl.cols.length - 1];
      const tail = Math.max(gapFor(last.dur) - 2, last.lw / 2 + 6);
      pl.natW = last.x + tail;
      const m = meas[mi]; if (m.fwd) pl.natW += 8; if (m.bwd) pl.natW += 8;
      if (mi > 0 && m.time) pl.natW += 18;
    });

    /* ─ quebra em sistemas ─ */
    const gapMid = (nVerses ? 38 + nVerses * LYR_LH : 48);
    const STAFF_H = 4 * SP, SYS_H = STAFF_H + gapMid + STAFF_H, SYS_ADV = SYS_H + 44;
    const nAcc = Math.abs(fifths);
    const prefixW = (first) => 24 + nAcc * 6.8 + (first ? 20 : 2) + 8;
    const systems = []; { let cur = [], w = 0, first = true;
      const avail = () => W - ML - MR - prefixW(systems.length === 0);
      for (let mi = 0; mi < nM; mi++) {
        const mw = plans[mi].natW;
        if (cur.length && w + mw > avail()) { systems.push(cur); cur = []; w = 0; }
        cur.push(mi); w += mw;
      }
      if (cur.length) systems.push(cur);
    }

    /* ─ cabeçalho ─ */
    const title = (opts.title || score.title || 'Partitura');
    const headH = 66;
    let y0 = MT + headH, pageNo = 1;
    const mode = (() => { // maior ou menor, pela nota final do baixo
      const bs = ev.filter((e) => e.vc === 3).sort((a, b) => a.s - b.s); if (!bs.length) return false;
      const lastPc = ((bs[bs.length - 1].midi % 12) + 12) % 12, F = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
      const majPc = F.indexOf(fifths) >= 0 ? F.indexOf(fifths) : 0; return lastPc === (majPc + 9) % 12;
    })();
    doc.text(W / 2, MT + 14, title, 17, { font: 'b', anchor: 'm' });
    {
      const sub = (opts.subtitle != null ? opts.subtitle : 'Tom: ' + keyName(fifths, mode) + '   ·   Compasso ' + (score.timeSig || '4/4') + '   ·   ');
      const bpmTxt = '= ' + Math.round(score.bpm || 90);
      const w1 = textW(sub, 9), w2 = textW(bpmTxt, 9), total = w1 + 10 + w2, sx = W / 2 - total / 2;
      doc.text(sx, MT + 32, sub, 9, { color: '#444' });
      const nx = sx + w1 + 3, ny = MT + 30;       // semínima desenhada
      doc.ellipse(nx + 2.2, ny, 2.6, 1.9, -0.35, { fill: true, color: '#444' }); doc.line(nx + 4.6, ny - 0.4, nx + 4.6, ny - 8.5, 0.7, '#444');
      doc.text(nx + 9, MT + 32, bpmTxt, 9, { color: '#444' });
    }
    if (opts.byline) doc.text(W - MR, MT + 48, opts.byline, 8, { anchor: 'r', color: '#666' });

    const layout = { W, H, pages: 1, cols: [], systems: [], keyText: keyName(fifths, mode) };
    const footer = () => { doc.text(W / 2, H - 22, 'DigitaHinos Coral  ·  página ' + pageNo, 7.5, { anchor: 'm', color: '#888' }); };

    /* ─ desenho dos símbolos ─ */
    const sharpAt = (x, y, col) => { col = col || '#000'; doc.line(x - 1.3, y - 5.6, x - 1.3, y + 5.2, 0.6, col); doc.line(x + 1.3, y - 5.2, x + 1.3, y + 5.6, 0.6, col); doc.path([['M', x - 2.8, y - 1.0], ['L', x + 2.8, y - 2.5], ['L', x + 2.8, y - 0.7], ['L', x - 2.8, y + 0.8], ['Z']], { fill: true, color: col }); doc.path([['M', x - 2.8, y + 2.0], ['L', x + 2.8, y + 0.5], ['L', x + 2.8, y + 2.3], ['L', x - 2.8, y + 3.8], ['Z']], { fill: true, color: col }); };
    const flatAt = (x, y, col) => { col = col || '#000'; doc.line(x - 1.6, y - 8, x - 1.6, y + 3.2, 0.7, col); doc.path([['M', x - 1.6, y + 3.2], ['C', x + 0.5, y + 2.2, x + 3.4, y + 0.2, x + 2.9, y - 1.8], ['C', x + 2.5, y - 3.2, x + 0.4, y - 3.1, x - 1.6, y - 0.6], ['C', x + 0.3, y - 1.9, x + 1.7, y - 1.5, x + 1.6, y - 0.4], ['C', x + 1.4, y + 0.8, x - 0.4, y + 1.9, x - 1.6, y + 2.6], ['Z']], { fill: true, color: col }); };
    const naturalAt = (x, y, col) => { col = col || '#000'; doc.line(x - 1.5, y - 5.5, x - 1.5, y + 2.2, 0.6, col); doc.line(x + 1.5, y - 2.2, x + 1.5, y + 5.5, 0.6, col); doc.path([['M', x - 1.5, y - 1.8], ['L', x + 1.5, y - 3.0], ['L', x + 1.5, y - 1.4], ['L', x - 1.5, y - 0.2], ['Z']], { fill: true, color: col }); doc.path([['M', x - 1.5, y + 0.9], ['L', x + 1.5, y - 0.3], ['L', x + 1.5, y + 1.3], ['L', x - 1.5, y + 2.5], ['Z']], { fill: true, color: col }); };
    const trebleClef = (x, yTop) => { // clave de sol (linha 2 = 2ª linha de baixo)
      const y = (p) => yTop + 4 * SP - p * SP / 2;      // p = posição (0 = linha de baixo)
      const g = y(2);
      doc.path([['M', x + 0.5, g + 0.2], ['C', x - 4.2, g - 0.3, x - 5.2, g + 6.8, x + 0.3, g + 8.2], ['C', x + 5.6, g + 9.5, x + 8.8, g + 4.2, x + 6, g - 0.5], ['C', x + 3.8, g - 4, x - 0.8, g - 6.5, x - 0.2, g - 13], ['C', x + 0.2, g - 17.5, x + 2.8, g - 22, x + 3.9, g - 20.5], ['C', x + 5.3, g - 18.5, x + 4.4, g - 13, x + 1.6, g - 8.5], ['C', x - 0.8, g - 4.5, x - 1.3, g + 2, x - 0.9, g + 9], ['C', x - 0.8, g + 12.2, x - 2.6, g + 14.5, x - 4.8, g + 13.6], ['C', x - 7.4, g + 12.6, x - 6.2, g + 8.6, x - 3.6, g + 9.5]], { stroke: true, lw: 1.15, cap: 1, join: 1 });
      doc.ellipse(x - 3.2, g + 9.9, 1.7, 1.7, 0, { fill: true });
    };
    const bassClef = (x, yTop) => {
      const f = yTop + SP;  // 4ª linha = linha do fá
      doc.path([['M', x - 4.4, f + 0.2], ['C', x - 1.3, f - 3.3, x + 4.8, f - 2.5, x + 5.1, f + 2.4], ['C', x + 5.4, f + 7.6, x + 0.6, f + 11.6, x - 4.6, f + 15.2]], { stroke: true, lw: 1.5, cap: 1, join: 1 });
      doc.ellipse(x - 4.0, f + 0.1, 2.35, 2.2, 0, { fill: true });
      doc.ellipse(x + 8.0, f - 1.4, 0.95, 0.95, 0, { fill: true }); doc.ellipse(x + 8.0, f + 2.9, 0.95, 0.95, 0, { fill: true });
    };
    const brace = (x, y1, y2) => {
      const m = (y1 + y2) / 2, h = (y2 - y1);
      doc.path([['M', x + 6, y1], ['C', x - 1, y1 + h * 0.12, x + 5, m - h * 0.18, x - 3, m], ['C', x + 5, m + h * 0.18, x - 1, y2 - h * 0.12, x + 6, y2], ['C', x + 1.2, y2 - h * 0.14, x + 1.6, m + h * 0.2, x - 4.2, m], ['C', x + 1.6, m - h * 0.2, x + 1.2, y1 + h * 0.14, x + 6, y1], ['Z']], { fill: true });
    };
    const noteHead = (cx, cy, q, col) => {
      const hollow = q >= 2 - EPS, whole = q >= 4 - EPS;
      if (whole) { doc.ellipse(cx, cy, 3.9, 2.4, 0, { fill: true, color: col }); doc.ellipse(cx, cy, 1.9, 2.0, -0.9, { fill: true, color: '#fff' }); }
      else if (hollow) { doc.ellipse(cx, cy, NOTE_RX, NOTE_RY, -0.36, { fill: true, color: col }); doc.ellipse(cx, cy, 2.05, 1.05, -0.62, { fill: true, color: '#fff' }); }
      else doc.ellipse(cx, cy, NOTE_RX, NOTE_RY, -0.36, { fill: true, color: col });
    };
    const flagAt = (x, y, up, n) => {
      for (let i = 0; i < n; i++) {
        const o = i * 4.2 * (up ? 1 : -1);
        if (up) doc.path([['M', x, y + o], ['C', x + 0.3, y + o + 4.5, x + 6.2, y + o + 6.2, x + 4.8, y + o + 13], ['C', x + 4.3, y + o + 8.4, x + 1.8, y + o + 6.6, x, y + o + 5.2], ['Z']], { fill: true });
        else doc.path([['M', x, y + o], ['C', x + 0.3, y + o - 4.5, x + 6.2, y + o - 6.2, x + 4.8, y + o - 13], ['C', x + 4.3, y + o - 8.4, x + 1.8, y + o - 6.6, x, y + o - 5.2], ['Z']], { fill: true });
      }
    };
    const restAt = (x, yTop, q, whole, shift) => {
      const sh = shift || 0, lineY = (p) => yTop + 4 * SP - p * SP / 2;
      if (whole || q >= 4 - EPS) { const yy = lineY(6) + sh; doc.rect(x - 3.6, yy, 7.2, SP * 0.55); return; }
      if (q >= 2 - EPS) { const yy = lineY(4) + sh; doc.rect(x - 3.6, yy - SP * 0.55, 7.2, SP * 0.55); return; }
      const c = lineY(4) + sh;
      if (q >= 1 - EPS) { // pausa de semínima
        doc.path([['M', x - 1.2, c - 7.2], ['L', x + 2.4, c - 3.0], ['L', x - 1.6, c + 1.4], ['L', x + 2.2, c + 5.6], ['C', x - 1.8, c + 4.2, x - 3.6, c + 6.4, x - 1.4, c + 8.6]], { stroke: true, lw: 1.5, cap: 1, join: 1 });
        return;
      }
      const n = q >= 0.5 - EPS ? 1 : q >= 0.25 - EPS ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const yy = c - 2 + i * 4.2, xx = x + i * 1.2;
        doc.ellipse(xx - 1.6, yy - 1.2, 1.25, 1.25, 0, { fill: true });
        doc.path([['M', xx - 1.4, yy - 0.4], ['C', xx + 0.6, yy - 0.8, xx + 1.6, yy - 1.8, xx + 2.2, yy - 3], ['L', xx - 1.2 + (i ? -1 : 0), yy + 5.5 + 0]], { stroke: true, lw: 0.75, cap: 1 });
      }
    };

    /* ─ desenho de um sistema ─ */
    function drawSystem(sys, sysIdx, yTop) {
      const first = sysIdx === 0;
      const yT = yTop, yB = yTop + STAFF_H + gapMid;       // topo da pauta de sol / de fá
      const xL = ML, xR = W - MR;
      // geometria do início da música neste sistema (igual à usada mais abaixo)
      const startX0 = xL + 24 + 3 + (fifths ? nAcc * 6.8 + 2 : 0) + (first ? 20 : 0) + 6;
      const sumW0 = sys.reduce((a, mi) => a + plans[mi].natW, 0);
      let f0 = (xR - startX0) / sumW0; const isLast0 = sysIdx === systems.length - 1;
      if (isLast0 && f0 > 1.35) f0 = 1.0;
      const xEnd = isLast0 && f0 === 1.0 ? startX0 + sumW0 : xR;
      // linhas das pautas
      [yT, yB].forEach((yy) => { for (let i = 0; i < 5; i++) doc.line(xL, yy + i * SP, xEnd, yy + i * SP, 0.55); });
      doc.line(xL, yT, xL, yB + STAFF_H, 0.9);
      brace(xL - 9, yT, yB + STAFF_H);
      trebleClef(xL + 11, yT); bassClef(xL + 11, yB);
      let px = xL + 24;
      const drawKey = (xx) => {
        if (!fifths) return xx;
        for (let i = 0; i < nAcc; i++) {
          [['t', yT], ['b', yB]].forEach(([k, yy]) => {
            const pos = (fifths > 0 ? SHARP_POS[k][i] : FLAT_POS[k][i]), y = yy + 4 * SP - pos * SP / 2;
            if (fifths > 0) sharpAt(xx + i * 6.8, y); else flatAt(xx + i * 6.8, y);
          });
        }
        return xx + nAcc * 6.8 + 2;
      };
      const drawTime = (xx, ts) => {
        const [n, d] = String(ts).split('/');
        [yT, yB].forEach((yy) => { doc.text(xx, yy + 2 * SP - 0.6, n, 15.5, { font: 'b', anchor: 'm' }); doc.text(xx, yy + 4 * SP - 0.6, d, 15.5, { font: 'b', anchor: 'm' }); });
      };
      px = drawKey(px + 3);
      if (first) { drawTime(px + 7, score.timeSig || '4/4'); px += 20; }
      px += 6;
      // largura disponível e fator de justificação
      const startX = px, availW = xR - startX;
      const sumW = sys.reduce((a, mi) => a + plans[mi].natW, 0);
      let f = availW / sumW; const lastSys = sysIdx === systems.length - 1;
      if (lastSys && f > 1.35) f = 1.0;
      let mx = startX;
      const sysInfo = { page: pageNo, yT, yB, xs: [] };
      const lyricsAcc = [];   // por verso: [{x,w,t,sy}]
      for (let v = 0; v < nVerses; v++) lyricsAcc.push([]);
      const volta = [];
      sys.forEach((mi, k) => {
        const pl = plans[mi], m = meas[mi];
        const mw = pl.natW * f;
        let lead = 0;
        if (m.fwd) lead += 8;
        if (mi > 0 && m.time) { drawTime(mx + lead + 8, m.time); lead += 18; }
        const xm0 = mx;                       // início do compasso (barra à esquerda)
        // barra inicial do sistema ou repetição
        if (m.fwd) { [yT, yB].forEach((yy) => { doc.rect(xm0 + 0.5, yy, 2.2, STAFF_H); doc.line(xm0 + 5.2, yy, xm0 + 5.2, yy + STAFF_H, 0.7); doc.ellipse(xm0 + 8.5, yy + 1.5 * SP, 0.9, 0.9, 0, { fill: true }); doc.ellipse(xm0 + 8.5, yy + 2.5 * SP, 0.9, 0.9, 0, { fill: true }); }); }
        // posições
        const scaleX = (c) => xm0 + lead + (c.x - 9) * f + 9 - (m.fwd ? 0 : 0);
        const colX = pl.cols.map((c) => xm0 + lead + 2 + c.x * f - 2 * f + 0 * 0);
        pl.cols.forEach((c, ci) => { sysInfo.xs.push({ wq: m.start + c.on, x: colX[ci] }); layout.cols.push({ wq: m.start + c.on, page: pageNo, x: colX[ci], y1: yT - 10, y2: yB + STAFF_H + 6, mi }); });
        const xmEnd = xm0 + mw;
        // desenha cada pauta
        ['t', 'b'].forEach((kind) => {
          const yTop = kind === 't' ? yT : yB, dB = D_BOTTOM[kind];
          const posY = (pos) => yTop + 4 * SP - pos * SP / 2;
          const items = pl.staves[kind];
          const xOf = (it) => colX[pl.colIdx.get(it.on.toFixed(4))];
          // ─ notas
          const noteItems = items.filter((it) => !it.rest);
          // direção das hastes
          noteItems.forEach((it) => {
            const top = it.notes[it.notes.length - 1].pos, bot = it.notes[0].pos;
            if (it.line === 'U') it.stem = 'up'; else if (it.line === 'L') it.stem = 'down';
            else { const mid = (top + bot) / 2; it.stem = mid >= 4 ? 'down' : 'up'; }
            it.q === undefined;
          });
          // vogal de cabeças deslocadas (segundas)
          noteItems.forEach((it) => {
            const up = it.stem === 'up'; const ns = it.notes.slice(); if (!up) ns.reverse();
            let prev = null, prevDisp = false;
            ns.forEach((n) => { n.disp = false; if (prev && Math.abs(n.pos - prev.pos) === 1 && !prevDisp) { n.disp = true; prevDisp = true; } else prevDisp = false; prev = n; });
          });
          // conflito entre vozes diferentes na mesma coluna (segundas/uníssonos) → desloca a voz de baixo
          noteItems.filter((it) => it.line === 'L').forEach((it) => {
            noteItems.filter((o) => o.line === 'U' && Math.abs(o.on - it.on) < EPS).forEach((o) => {
              const clash = it.notes.some((a) => o.notes.some((b) => Math.abs(a.pos - b.pos) <= 1));
              if (clash) it.shiftX = 7;
            });
          });
          noteItems.forEach((it) => {
            const cx = xOf(it) + (it.shiftX || 0), up = it.stem === 'up';
            const top = it.notes[it.notes.length - 1].pos, bot = it.notes[0].pos;
            // linhas suplementares
            const ledger = (pos) => doc.line(cx - 5.6, posY(pos), cx + 5.6, posY(pos), 0.6);
            for (let p = 10; p <= top; p += 2) ledger(p);
            for (let p = -2; p >= bot; p -= 2) ledger(p);
            it.notes.forEach((n) => {
              const xh = cx + (n.disp ? (up ? 2 * NOTE_RX - 0.6 : -(2 * NOTE_RX - 0.6)) : 0);
              n.cx = xh; n.cy = posY(n.pos);
              noteHead(xh, n.cy, it.q, '#000');
            });
            it.cx = cx;
            // acidentes
            if (!it.noAcc) it.notes.filter((n) => n.acc).forEach((n) => { const ax = cx - 8.2 - (n.accCol || 0) * 6.5; if (n.acc === 's') sharpAt(ax, n.cy); else if (n.acc === 'f') flatAt(ax, n.cy); else naturalAt(ax, n.cy); });
            // pontos
            const dotted = [3, 1.5, 0.75, 0.375, 6].some((v) => Math.abs(it.q - v) < EPS), ddot = false;
            if (dotted) it.notes.forEach((n) => { const onLine = (((n.pos % 2) + 2) % 2) === 0; doc.ellipse(n.cx + 6.6 + (n.disp && !up ? 0 : 0), n.cy + (onLine ? -SP / 2 : 0), 0.95, 0.95, 0, { fill: true }); });
          });
          // vigas
          const beatLen = (m.bt === 8 && m.beats % 3 === 0) ? 1.5 : (m.bt === 2 ? 2 : 1);
          const groups = []; let curG = null;
          noteItems.filter((it) => it.q < 1 - EPS || (it.q < 1.4 && false)).forEach(() => {});
          const lineKeys = ['U', 'L', 'S'];
          lineKeys.forEach((ln) => {
            const arr = noteItems.filter((it) => it.line === ln).sort((a, b) => a.on - b.on);
            curG = null;
            arr.forEach((it) => {
              const beamable = it.q < 1 - EPS + 0.0001 && it.q <= 0.75 + EPS;
              const bi = Math.floor((it.on + EPS) / beatLen);
              if (beamable) {
                const cont = curG && curG.bi === bi && curG.stem === it.stem && Math.abs(curG.end - it.on) < EPS;
                if (cont) { curG.items.push(it); curG.end = it.on + it.snd; }
                else { curG = { bi, stem: it.stem, items: [it], end: it.on + it.snd }; groups.push(curG); }
              } else curG = null;
            });
          });
          const inBeam = new Set();
          groups.forEach((g) => { if (g.items.length > 1) g.items.forEach((it) => inBeam.add(it)); });
          // hastes
          const stemLen = 3.4 * SP;
          const stemX = (it, up) => { const n0 = up ? it.notes.find((n) => !n.disp) || it.notes[0] : it.notes.find((n) => !n.disp) || it.notes[it.notes.length - 1]; return (up ? it.cx + NOTE_RX - 0.35 : it.cx - NOTE_RX + 0.35); };
          const stemInfo = new Map();
          noteItems.forEach((it) => {
            if (it.q >= 4 - EPS) return;
            const up = it.stem === 'up', top = it.notes[it.notes.length - 1], bot = it.notes[0];
            const x = stemX(it, up);
            let yEnd = up ? posY(top.pos) - stemLen : posY(bot.pos) + stemLen;
            // estende até a linha do meio quando a nota estiver longe
            if (up && top.pos < 4 - 0) yEnd = Math.min(yEnd, posY(4) - 0.0); if (!up && bot.pos > 4) yEnd = Math.max(yEnd, posY(4));
            stemInfo.set(it, { x, up, yStart: up ? posY(bot.pos) : posY(top.pos), yEnd });
          });
          groups.forEach((g) => {
            if (g.items.length < 2) return;
            const up = g.stem === 'up';
            const ends = g.items.map((it) => stemInfo.get(it).yEnd);
            const by = up ? Math.min(...ends) : Math.max(...ends);
            g.items.forEach((it) => { stemInfo.get(it).yEnd = by; });
            g.by = by;
          });
          noteItems.forEach((it) => {
            const si = stemInfo.get(it); if (!si) return;
            doc.line(si.x, si.yStart, si.x, si.yEnd, 0.7);
            if (it.q < 1 - EPS && !inBeam.has(it)) flagAt(si.x, si.yEnd, si.up, it.q <= 0.25 + EPS ? 2 : 1);
          });
          groups.forEach((g) => {
            if (g.items.length < 2) return;
            const up = g.stem === 'up', t = 2.3, dir = up ? 1 : -1, by = g.by;
            const xa = stemInfo.get(g.items[0]).x - 0.35, xb = stemInfo.get(g.items[g.items.length - 1]).x + 0.35;
            const yb = up ? by : by - t;
            doc.rect(xa, yb, xb - xa, t);
            // segunda viga (semicolcheias)
            for (let i = 0; i < g.items.length; i++) {
              const it = g.items[i];
              if (it.q > 0.25 + EPS) continue;
              const x = stemInfo.get(it).x, nxt = g.items[i + 1], prv = g.items[i - 1];
              let x1 = x, x2 = x;
              if (nxt && nxt.q <= 0.25 + EPS) x2 = stemInfo.get(nxt).x; else if (prv && prv.q <= 0.25 + EPS) { x1 = stemInfo.get(prv).x; x2 = x; } else x2 = x + 4.5;
              if (!(nxt && nxt.q <= 0.25 + EPS) && prv && prv.q <= 0.25 + EPS) continue;
              const y2 = up ? by + 3.6 : by - 3.6 - t;
              doc.rect(Math.min(x1, x2), y2, Math.abs(x2 - x1) || 4, t * 0.85);
            }
            // quiáltera (número 3)
            if (g.items[0].tm) { const xm = (xa + xb) / 2; let ty = up ? by - 3.5 : by + 10; if (kind === 'b' && up) ty = Math.max(...g.items.map((it) => it.notes[0].cy)) + 11; doc.text(xm, ty, String(g.items[0].tm[0]), 8, { font: 'i', anchor: 'm' }); }
          });
          // ligaduras (dentro do compasso e para o próximo)
          const tieDraw = (n, it, xTo, dirUp, half) => {
            const x1 = n.cx + 4.2, y = n.cy + (dirUp ? -2.6 : 2.6), x2 = xTo, ctl = dirUp ? -4.8 : 4.8;
            doc.path([['M', x1, y], ['C', x1 + (x2 - x1) * 0.28, y + ctl, x1 + (x2 - x1) * 0.72, y + ctl, x2, y], ['C', x1 + (x2 - x1) * 0.72, y + ctl * 0.62, x1 + (x2 - x1) * 0.28, y + ctl * 0.62, x1, y], ['Z']], { fill: true });
          };
          noteItems.forEach((it) => {
            const needTie = it.tieNext || it.notes.some((n) => n.tS);
            if (!needTie) return;
            // procura o próximo item do mesmo som
            const nextIt = noteItems.find((o) => o !== it && o.on > it.on + EPS && Math.abs(o.on - (it.on + it.snd)) < 0.01 && (o.line === it.line || it.line === 'S' || o.line === 'S'));
            const dirUp = it.stem === 'down';
            it.notes.forEach((n) => {
              if (it.tieNext || n.tS) {
                if (nextIt) { const m2 = nextIt.notes.find((q) => q.pos === n.pos); const xTo = (m2 ? m2.cx : xOf(nextIt)) - 4.2; if (m2 || it.tieNext) tieDraw(n, it, Math.max(xTo, n.cx + 9), dirUp); }
                else tieDraw(n, it, Math.min(xmEnd - 2, n.cx + 22), dirUp);   // até o fim do compasso (continua no próximo)
              }
            });
          });
          // ─ pausas
          items.filter((it) => it.rest).forEach((it) => {
            const rx = xOf(it);
            let shift = 0; if (it.line === 'U') shift = -SP * 1.2; else if (it.line === 'L') shift = SP * 1.2;
            if (it.whole) { restAt(m.len >= 4 ? xm0 + (mw + lead) / 2 : (xm0 + lead + mw) / 2 - 1, yTop, 4, true, shift); }
            else restAt(rx, yTop, it.q, false, shift);
          });
          // ─ letras (somente na pauta de cima)
          if (kind === 't') noteItems.forEach((it) => {
            if (!it.first || !it.lyrData) return;
            Object.keys(it.lyrData).forEach((v) => { const vi = (parseInt(v) || 1) - 1; if (vi < 0 || vi >= nVerses) return; const d = it.lyrData[v]; const w = textW(d.t, LYR); lyricsAcc[vi].push({ x: it.cx, w, t: d.t, sy: d.sy }); });
          });
        });
        // barras de compasso
        const lastInSys = k === sys.length - 1;
        const lastOfPiece = mi === nM - 1;
        [yT, yB].forEach((yy) => {
          if (m.bwd) { doc.ellipse(xmEnd - 8.5, yy + 1.5 * SP, 0.9, 0.9, 0, { fill: true }); doc.ellipse(xmEnd - 8.5, yy + 2.5 * SP, 0.9, 0.9, 0, { fill: true }); doc.line(xmEnd - 5.2, yy, xmEnd - 5.2, yy + STAFF_H, 0.7); doc.rect(xmEnd - 2.7, yy, 2.2, STAFF_H); }
          else if (lastOfPiece) { doc.line(xmEnd - 4.2, yy, xmEnd - 4.2, yy + STAFF_H, 0.7); doc.rect(xmEnd - 2.2, yy, 2.2, STAFF_H); }
          else doc.line(xmEnd, yy, xmEnd, yy + STAFF_H, 0.7);
        });
        if (m.volta) volta.push({ x1: xm0 + (m.fwd ? 8 : 0), x2: xmEnd, label: m.volta, mi });
        mx = xmEnd;
      });
      // número do primeiro compasso do sistema
      doc.text(startX - 2, yT - 7, meas[sys[0]].number, 7, { color: '#666' });
      // casas de volta (1ª, 2ª)
      let g = null; const vg = [];
      volta.forEach((v) => { if (g && g.label.join() === v.label.join() && Math.abs(g.x2 - v.x1) < 3) g.x2 = v.x2; else { g = { x1: v.x1, x2: v.x2, label: v.label }; vg.push(g); } });
      vg.forEach((b) => { const yy = yT - 14; doc.line(b.x1 + 1, yy, b.x2 - 3, yy, 0.7); doc.line(b.x1 + 1, yy, b.x1 + 1, yy + 8, 0.7); doc.text(b.x1 + 4, yy + 8, b.label.join('., ') + '.', 7.5, { font: 'b' }); });
      // letras: textos e hífens
      lyricsAcc.forEach((arr, vi) => {
        const yy = yT + STAFF_H + 22 + vi * LYR_LH;
        arr.sort((a, b) => a.x - b.x);
        arr.forEach((it, i) => {
          doc.text(it.x, yy, it.t, LYR, { anchor: 'm' });
          if (it.sy === 'begin' || it.sy === 'middle') {
            const nx = arr[i + 1];
            if (nx) { const a = it.x + it.w / 2, b = nx.x - nx.w / 2; const mid = (a + b) / 2; if (b - a > 3.5) doc.line(mid - 1.6, yy - 2.6, mid + 1.6, yy - 2.6, 0.6); }
          }
        });
      });
      layout.systems.push(sysInfo);
      return yB + STAFF_H;
    }

    /* ─ distribui os sistemas nas páginas ─ */
    let y = y0;
    systems.forEach((sys, i) => {
      if (y + SYS_H + 20 > H - MB) {
        footer(); doc.newPage(); pageNo++; layout.pages++;
        doc.text(W / 2, MT + 4, title, 9, { anchor: 'm', color: '#777' });
        y = MT + 30;
      }
      drawSystem(sys, i, y);
      y += SYS_ADV;
    });
    footer();
    layout.cols.sort((a, b) => a.wq - b.wq);
    return { doc, layout };
  }

  /* ───────────────────────── API ───────────────────────── */

  /** Gera o PDF (Uint8Array) e a prévia em SVG de uma partitura. */
  function renderScore(score, opts) {
    const { doc, layout } = engrave(score, opts);
    return {
      layout, pages: doc.pages.length,
      svg: (i) => doc.pageSvg(i),
      pdf: () => doc.toPdf({ title: (opts && opts.title) || score.title }),
    };
  }

  /** Gera e baixa o PDF da partitura. */
  async function downloadScorePdf(name, score, opts) {
    const r = renderScore(score, Object.assign({ title: name }, opts || {}));
    const bytes = r.pdf();
    await CC.download(new Blob([bytes], { type: 'application/pdf' }), CC.slug(name) + '.pdf');
    return r.pages;
  }

  Object.assign(CC, { renderScore, keyName, downloadScorePdf });
})(typeof window !== 'undefined' ? window : globalThis);
