/* DigitaHinos Coral – cantores animados
 * Quatro rostos (soprano, contralto, tenor e baixo). A boca de cada um abre conforme o volume REAL
 * da voz que sai do aplicativo (um AnalyserNode em cada trilho de voz do motor de áudio).
 * Voz desligada = boca fechada. O usuário pode mostrar ou esconder (preferência salva no aparelho).
 */
(function (global) {
  'use strict';
  const CC = (global.CC = global.CC || {});
  const KEY = 'dhc.singers';
  const ORDER = ['S', 'A', 'T', 'B'];
  const NAMES = { S: 'Soprano', A: 'Contralto', T: 'Tenor', B: 'Baixo' };

  /* Aparência de cada cantor (quatro homens diferentes). */
  const LOOK = {
    S: { skin: '#f3c9a5', shade: '#e2ad86', hair: '#6b4426', tie: '#ff7a90', suit: '#2a3250', style: 'wavy', brow: '#5a3820' },
    A: { skin: '#d9a073', shade: '#c4875a', hair: '#1d1a1a', tie: '#ffb347', suit: '#33293f', style: 'side', brow: '#1d1a1a', glasses: true },
    T: { skin: '#8a5a3c', shade: '#744a2f', hair: '#14110f', tie: '#45d6a8', suit: '#22303a', style: 'short', brow: '#14110f', stubble: true },
    B: { skin: '#e6b995', shade: '#cf9d78', hair: '#8f949c', tie: '#6ea8ff', suit: '#262b44', style: 'bald', brow: '#7a7f88', beard: '#8f949c' },
  };

  const HAIR = {
    wavy: '<path d="M27.5 46C24 22 38 12 50 12c13 0 27 9 22.5 34-1.5-9-5-15-9.5-18-6 3-16 4-26 2-3 3-5.500 9-9.500 16z" fill="@h"/><path d="M30 26c4-9 14-13 22-11-6 1-10 4-12 8z" fill="#fff" opacity=".12"/>',
    side: '<path d="M28 45C25 22 37 13 52 13c13 0 22 8 20 32-1.500-8-4-13-8-16-9 3-22 1-33 4-1.500 4-2.500 8-3 12z" fill="@h"/><path d="M33 24c6-6 18-8 28-4" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="2"/>',
    short: '<path d="M28.500 44C26 24 38 15 50 15c12 0 24 9 21.500 29-1.500-8-5-13-9-15-8 2-17 2-25 0-3 3-7 9-9 15z" fill="@h"/>',
    bald: '<path d="M28.500 42c-1-7 0-12 3-16-1 8 0 12 1 16zM71.500 42c1-7 0-12-3-16 1 8 0 12-1 16z" fill="@h"/><path d="M33 24c5-7 29-7 34 0-6-4-28-4-34 0z" fill="@h" opacity=".5"/>',
  };

  let uid = 0;
  function faceSvg(k) {
    const L = LOOK[k], id = 'sg' + (++uid);
    const hair = HAIR[L.style].replace(/@h/g, L.hair);
    const beard = L.beard ? '<path d="M29.500 52c0 14 8 22 20.500 22S70.500 66 70.500 52c-3 7-8 9-12.500 9h-16c-4.500 0-9.500-2-12.500-9z" fill="' + L.beard + '"/><path d="M40 59c4-3 16-3 20 0-4 1-6 1.500-10 1.500S44 60 40 59z" fill="' + L.beard + '"/>' : '';
    const stubble = L.stubble ? '<path d="M30 52c0 13 8 21 20 21s20-8 20-21c-3 7-8 10-12 10H42c-4 0-9-3-12-10z" fill="#000" opacity=".22"/>' : '';
    const glasses = L.glasses ? '<g fill="none" stroke="#2b2b34" stroke-width="1.400"><rect x="33" y="40" width="14" height="10" rx="4"/><rect x="53" y="40" width="14" height="10" rx="4"/><path d="M47 44h6"/></g>' : '';
    return '<svg class="sg-svg" viewBox="0 0 100 112" aria-hidden="true" focusable="false">'
      + '<defs><clipPath id="' + id + '"><ellipse class="cav" cx="50" cy="64" rx="6.500" ry="1"/></clipPath></defs>'
      + '<g class="sg-body">'
      // paletó, camisa e gravata
      + '<path d="M4 112c1-17 12-24 27-27l9-3h20l9 3c15 3 26 10 27 27z" fill="' + L.suit + '"/>'
      + '<path d="M41 82l9 14 9-14z" fill="#f4f6fb"/><path d="M46 84h8l-1.500 6 3 18-5.500 4-5.500-4 3-18z" fill="' + L.tie + '"/>'
      + '<path d="M36 83l14 29-22 0c-3-12-2-22 8-29zM64 83l-14 29 22 0c3-12 2-22-8-29z" fill="#000" opacity=".16"/>'
      // pescoço
      + '<path d="M41 68h18v16c-3 5-15 5-18 0z" fill="' + L.shade + '"/>'
      // orelhas e cabeça
      + '<ellipse cx="29" cy="49" rx="3.600" ry="5.500" fill="' + L.skin + '"/><ellipse cx="71" cy="49" rx="3.600" ry="5.500" fill="' + L.skin + '"/>'
      + '<ellipse cx="29.500" cy="49" rx="1.500" ry="3" fill="' + L.shade + '" opacity=".55"/><ellipse cx="70.500" cy="49" rx="1.500" ry="3" fill="' + L.shade + '" opacity=".55"/>'
      + '<ellipse cx="50" cy="47" rx="21.500" ry="26" fill="' + L.skin + '"/>'
      + stubble + beard + hair
      // sobrancelhas, olhos, nariz
      + '<g class="brows" fill="none" stroke="' + L.brow + '" stroke-width="2.200" stroke-linecap="round"><path d="M35 37c3-2 7-2 10-.5"/><path d="M55 36.500c3-1.500 7-1.500 10 .5"/></g>'
      + '<g class="eyes"><ellipse cx="40" cy="44.500" rx="3.200" ry="2.600" fill="#fff"/><ellipse cx="60" cy="44.500" rx="3.200" ry="2.600" fill="#fff"/>'
      + '<circle cx="40.300" cy="44.800" r="1.700" fill="#2a1d14"/><circle cx="60.300" cy="44.800" r="1.700" fill="#2a1d14"/></g>'
      + glasses
      + '<path d="M50 46c-1.500 5-3.500 8-3 10 1 1.600 5 1.600 6 0" fill="none" stroke="' + L.shade + '" stroke-width="1.500" stroke-linecap="round" stroke-linejoin="round"/>'
      + (L.beard ? '<path d="M40 59.500c4-2.500 16-2.500 20 0-2 2-5 2-10 2s-8 0-10-2z" fill="' + L.beard + '"/>' : '')
      // boca (a abertura é ajustada em tempo real)
      + '<g class="mouth"><ellipse class="lips" cx="50" cy="64" rx="7.500" ry="2" fill="#a8473f"/><ellipse class="hole" cx="50" cy="64" rx="6.500" ry="1" fill="#34100f"/>'
      + '<g clip-path="url(#' + id + ')"><rect class="teeth" x="43" y="60" width="14" height="3.200" fill="#f7f4ee"/><ellipse class="tongue" cx="50" cy="69" rx="5" ry="3" fill="#d9626b"/></g></g>'
      + '</g></svg>';
  }

  const S = {
    box: null, items: {}, on: true, level: { S: 0, A: 0, T: 0, B: 0 }, shown: { S: 0, A: 0, T: 0, B: 0 },
    eng: null, an: {}, buf: null, sel: 'ALL',
  };
  try { S.on = global.localStorage.getItem(KEY) !== '0'; } catch (e) { /* sem armazenamento */ }

  function mount(box) {
    S.box = box;
    box.innerHTML = ORDER.map((k) => '<div class="sg" data-v="' + k + '" style="--vc:' + ({ S: '#ff7a90', A: '#ffb347', T: '#45d6a8', B: '#6ea8ff' })[k] + '">'
      + faceSvg(k) + '<span class="sg-name">' + NAMES[k] + '</span></div>').join('');
    ORDER.forEach((k) => {
      const el = box.querySelector('.sg[data-v="' + k + '"]');
      S.items[k] = { el, body: el.querySelector('.sg-body'), lips: el.querySelector('.lips'), hole: el.querySelector('.hole'), cav: el.querySelector('.cav'), teeth: el.querySelector('.teeth'), tongue: el.querySelector('.tongue'), brows: el.querySelector('.brows') };
    });
    setVisible(S.on);
  }

  function setVisible(v) {
    S.on = !!v;
    if (S.box) S.box.classList.toggle('hidden', !S.on);
    try { global.localStorage.setItem(KEY, S.on ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  /** Qual voz está em destaque (ALL = todas iguais). As demais ficam apagadas, mas continuam cantando se estiverem audíveis. */
  function select(sel) {
    S.sel = sel;
    ORDER.forEach((k) => { if (S.items[k]) S.items[k].el.classList.toggle('dimmed', sel !== 'ALL' && sel !== k); });
  }

  /* liga um AnalyserNode em cada trilho de voz do motor atual */
  function attach(engine) {
    if (S.eng === engine) return;
    S.eng = engine; S.an = {};
    ORDER.forEach((k) => {
      try { const a = engine.ctx.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0; engine.voiceBus[k].connect(a); S.an[k] = a; } catch (e) { /* ignore */ }
    });
    S.buf = new Float32Array(2048);
  }

  function rmsOf(a) {
    a.getFloatTimeDomainData(S.buf);
    let s = 0; for (let i = 0; i < S.buf.length; i++) s += S.buf[i] * S.buf[i];
    return Math.sqrt(s / S.buf.length);
  }

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  function draw(k, o) {
    const it = S.items[k]; if (!it) return;
    const ry = 0.9 + o * 8.200, rx = 7.600 - o * 1.800, cy = 63.800 + o * 3.200;   // maxilar desce
    it.lips.setAttribute('cy', cy); it.lips.setAttribute('rx', rx + 1); it.lips.setAttribute('ry', ry + 1.100);
    it.hole.setAttribute('cy', cy); it.hole.setAttribute('rx', Math.max(0.5, rx - 1)); it.hole.setAttribute('ry', Math.max(0.2, ry - 0.2));
    it.cav.setAttribute('cy', cy); it.cav.setAttribute('rx', Math.max(0.5, rx - 1)); it.cav.setAttribute('ry', Math.max(0.2, ry - 0.2));
    it.teeth.setAttribute('y', cy - ry); it.tongue.setAttribute('cy', cy + ry * 0.85);
    it.brows.setAttribute('transform', 'translate(0 ' + (-o * 1.600).toFixed(2) + ')');
    it.body.setAttribute('transform', 'translate(0 ' + (o * 1.200).toFixed(2) + ')');
    it.el.style.setProperty('--lv', o.toFixed(3));
  }

  /** Chamada a cada quadro de animação enquanto o player está aberto. */
  function tick() {
    if (!S.on || !S.box) return;
    const live = CC.app && CC.app.peekLive && CC.app.peekLive();
    const playing = CC.app && CC.app.transport.state === 'playing';
    if (live && live.engine) attach(live.engine);
    ORDER.forEach((k) => {
      let target = 0;
      if (playing && S.an[k]) {
        const rms = rmsOf(S.an[k]);
        const db = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
        // o coro soa em torno de −28 dB (a faixa vai de −36 a −20 dB): −44 dB = fechada · −20 dB = bem aberta
        target = db < -48 ? 0 : clamp01((db + 44) / 24);
      }
      const cur = S.shown[k];
      S.shown[k] = target > cur ? cur + (target - cur) * 0.5 : cur + (target - cur) * 0.2;   // abre rápido, fecha suave
      if (S.shown[k] < 0.01) S.shown[k] = 0;
      draw(k, S.shown[k]);
    });
  }

  function reset() { ORDER.forEach((k) => { S.shown[k] = 0; draw(k, 0); }); }

  CC.singers = { mount, setVisible, isOn: () => S.on, select, tick, reset, _state: S };
})(typeof window !== 'undefined' ? window : globalThis);
