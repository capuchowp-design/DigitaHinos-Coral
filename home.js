/* DigitaHinos Coral – telas: início, biblioteca de hinos e player (ouvir, escolher voz, PDF) */
(function () {
  'use strict';
  const CC = window.CC, APP = CC.app;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const VOICE_ORDER = CC.VOICE_ORDER;
  const pad3 = (n) => String(n).padStart(3, '0');
  const normTxt = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const toast = (m, e) => APP.toast(m, e);

  /* ───────────────────────── Navegação ───────────────────────── */

  const VIEWS = { home: '#viewHome', lib: '#viewLib', player: '#viewPlayer' };
  let current = 'home';
  let playerFrom = 'home';

  function render(name) {
    Object.keys(VIEWS).forEach((k) => $(VIEWS[k]).classList.toggle('hidden', k !== name));
    current = name;
    if (name === 'editor') { APP.enterEditor(); }
    if (name !== 'player') leavePlayerUi();
    if (name === 'home') refreshHome();
  }
  function go(name, push) {
    if (push !== false) { try { history.pushState({ v: name }, ''); } catch (e) { /* ignore */ } }
    render(name);
  }
  window.addEventListener('popstate', (e) => {
    const v = e.state && e.state.v;
    render(v && (VIEWS[v] || v === 'editor') ? v : 'home');
  });
  try { history.replaceState({ v: 'home' }, ''); } catch (e) { /* ignore */ }
  const back = () => { if (history.length > 1) history.back(); else go('home', false); };

  $$('[data-go]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.go;
    if (t === 'home') go('home', false); else back();
  }));
  $('#btnHome').addEventListener('click', () => { APP.transport.stop(); go('home'); });

  /* ───────────────────────── Início ───────────────────────── */

  function refreshHome() {
    const has = APP.hasDraft();
    $('#tileContinue').classList.toggle('hidden', !has);
    const sub = $('#tileCompose .ts');
    sub.textContent = has ? 'Continuar: ' + (APP.draftName() || 'arranjo em andamento') : 'Escreva seu próprio arranjo para 4 vozes';
    updateInstallBtn();
  }

  $('#tileHinos').addEventListener('click', () => go('lib'));
  $('#tileCompose').addEventListener('click', () => {
    if (!APP.openDraft()) APP.newBlank();
    go('editor');
  });
  $('#tileContinue').addEventListener('click', () => {
    if (APP.hasDraft() && !confirm('Começar um arranjo novo? O rascunho atual será substituído (os projetos que você salvou em "Abrir" não mudam).')) return;
    APP.newBlank(); go('editor');
  });
  $('#fileHome').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; openFile(f); });
  $('#tileOpen').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileHome').click(); } });

  ['dragover', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => { if (current === 'home' || current === 'lib') e.preventDefault(); }));
  document.addEventListener('drop', (e) => {
    if (current !== 'home' && current !== 'lib') return;
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) openFile(f);
  });

  async function openFile(file) {
    if (!file) return;
    try {
      toast('Lendo ' + file.name + '…');
      const r = await CC.importFile(file);
      const base = file.name.replace(/\.[^.]+$/, '');
      if (r.score && !r.score.title) r.score.title = base;
      APP.loadProject(r.project, null, { temp: true, score: r.score });
      openPlayer({ sub: kindLabel(r.kind), from: 'home' });
    } catch (e) { toast('Não foi possível abrir: ' + e.message, true); }
  }
  const kindLabel = (k) => ({ mid: 'Arquivo MIDI', xml: 'Partitura MusicXML', json: 'Projeto' }[k] || 'Arquivo');

  /* ───────────────────────── Instalar / Pix ───────────────────────── */

  function updateInstallBtn() {
    const b = $('#btnHomeInstall');
    if (CC.install.isStandalone() || CC.install.isNative()) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    $('#lblInstall').textContent = CC.install.canPrompt() ? 'Instalar o app' : 'Como instalar o app';
  }
  CC.install.onChange(updateInstallBtn);
  $('#btnHomeInstall').addEventListener('click', async () => {
    if (CC.install.canPrompt()) { await CC.install.prompt(); updateInstallBtn(); return; }
    const box = $('#installHelp');
    box.innerHTML = CC.install.isIOS
      ? '<ol><li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta) do Safari.</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b>. O DigitaHinos Coral passa a abrir como um app, até sem internet.</li></ol>'
      : '<ol><li>No <b>Chrome</b> (Android ou computador), abra o menu <b>⋮</b> e escolha <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</li><li>No computador, também aparece um ícone de instalação na barra de endereço.</li><li>Depois de instalado, o app abre em tela cheia e funciona sem internet.</li></ol><p class="hint">Se a opção não aparecer, abra o endereço do app pelo Chrome e aguarde a página carregar por completo.</p>';
    $('#dlgInstall').showModal();
  });

  $('#btnPix').addEventListener('click', () => {
    $('#pixKey').textContent = (window.DHC && window.DHC.pixKey) || '—';
    $('#dlgPix').showModal();
  });
  $('#btnCopyPix').addEventListener('click', async () => {
    const key = (window.DHC && window.DHC.pixKey) || '';
    try { await navigator.clipboard.writeText(key); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('#pixKey')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); try { document.execCommand('copy'); } catch (x) { /* ignore */ } }
    toast('Chave Pix copiada');
  });

  /* ───────────────────────── Biblioteca de hinos ───────────────────────── */

  let HINOS = null;
  async function loadIndex() {
    try { const r = await fetch('hinos/index.json'); if (!r.ok) throw new Error(); HINOS = await r.json(); }
    catch (e) { HINOS = null; }
    $('#libCount').textContent = HINOS ? HINOS.length + ' hinos' : '';
    $('#tileHinosSub').textContent = HINOS ? HINOS.length + ' hinos em coro (soprano, contralto, tenor e baixo)' : 'Hinos em coro';
    renderList();
  }
  function renderList() {
    const box = $('#hinoList');
    if (!HINOS) { box.innerHTML = '<div class="hino-empty">Não foi possível carregar a lista de hinos.</div>'; return; }
    const q = normTxt($('#hinoQ').value).trim(), qn = q.replace(/^0+(?=\d)/, '');
    const list = HINOS.filter((h) => !q || String(h.n) === qn || pad3(h.n).includes(q) || normTxt(h.t).includes(q));
    if (!list.length) { box.innerHTML = '<div class="hino-empty">Nenhum hino encontrado.</div>'; return; }
    box.innerHTML = list.map((h) => '<button type="button" class="hino-item" role="listitem" data-n="' + h.n + '"><b>' + pad3(h.n) + '</b><span>' + esc(h.t) + '</span><i><svg class="i"><use href="#i-play"/></svg></i></button>').join('');
  }
  $('#hinoQ').addEventListener('input', renderList);
  $('#hinoList').addEventListener('click', (e) => { const b = e.target.closest('.hino-item'); if (b) openHino(parseInt(b.dataset.n, 10)); });

  async function openHino(n) {
    const meta = (HINOS || []).find((h) => h.n === n) || { n, t: '' };
    try {
      toast('Abrindo o hino ' + pad3(n) + '…');
      const res = await fetch('hinos/' + pad3(n) + '.mxl');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const r = await CC.importBuffer(await res.arrayBuffer(), pad3(n) + '.mxl');
      const name = pad3(n) + ' – ' + (meta.t || 'Hino ' + n);
      r.project.name = name.slice(0, 80); r.project.hino = n; r.score.title = name;
      APP.loadProject(r.project, null, { temp: true, score: r.score });
      openPlayer({ sub: '', from: 'lib' });
    } catch (e) { toast('Não foi possível abrir o hino: ' + e.message, true); }
  }

  /* ───────────────────────── Player ───────────────────────── */

  let singersBox = null;
  const PL = { score: null, layout: null, pages: 0, svg: null, unroll: [], total: 0, zoom: 1, bpm0: 60, raf: 0, lastY: -1, wasPlaying: false, sel: 'ALL', title: '' };
  const ZOOMS = [1, 1.35, 1.8, 2.4];

  function playerSub() {
    const sc = PL.score, P = APP.getProject();
    const key = PL.layout && PL.layout.keyText ? PL.layout.keyText : '';
    return [PL.kind, key && 'Tom: ' + key, (sc.timeSig || '4/4'), '♩ = ' + P.bpm].filter(Boolean).join(' · ');
  }

  function openPlayer(o) {
    const P = APP.getProject();
    const score = APP.getScore() || CC.projectToScore(P);
    PL.score = score; PL.kind = o.sub || ''; PL.title = P.name; PL.zoom = 1;
    playerFrom = o.from || 'home';
    // ordem de execução → posição escrita (para o cursor)
    PL.unroll = []; let acc = 0; score.order.forEach((mi) => { PL.unroll.push({ q0: acc, mi }); acc += score.measures[mi].len; });
    PL.total = acc;
    APP.setLength(Math.max(4, Math.ceil(acc * 4 - 1e-9)));
    APP.setLoop(false);
    CC.resetPlayMods(); CC.playMods.mono = true; PL.sel = 'ALL';
    PL.bpm0 = P.bpm;
    // controles
    $$('#plVoices button').forEach((b) => { const on = b.dataset.v === 'ALL'; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    $('#plGuide').checked = false; $('#plBassDown').checked = false; $('#plSADown').checked = false;
    $('#plLoop').setAttribute('aria-pressed', 'false');
    $('#plBpm').textContent = P.bpm;
    $('#plVol').value = APP.settings.master;
    $('#plTitle').textContent = P.name; $('#plSub').textContent = PL.kind;
    $('#plScore').innerHTML = '<div class="pl-wait">Preparando a partitura…</div>';
    go('player');
    // a partitura é desenhada logo depois de mostrar a tela
    CC.singers.select('ALL'); CC.singers.reset();
    syncEnsembleUi();
    setTimeout(() => drawScore(false), 30);
    updateSamplesStatus();
    startLoop();
  }

  /* desenha a partitura; com uma voz escolhida (S/A/T/B) mostra só essa voz */
  function drawScore(keepScroll) {
    const P = APP.getProject(), box = $('#plScore');
    const top = keepScroll ? box.scrollTop : 0;
    try {
      // coro completo: uma pauta para cada voz; voz escolhida: só a pauta dela
      const r = CC.renderScore(PL.score, { title: P.name, voice: PL.sel === 'ALL' ? null : PL.sel, split: PL.sel === 'ALL' });
      PL.layout = r.layout; PL.pages = r.pages; PL.svg = r;
      buildScoreView();
      box.scrollTop = top;
      $('#plSub').textContent = playerSub();
    } catch (e) { box.innerHTML = '<div class="pl-wait">Não foi possível desenhar a partitura (' + esc(e.message) + '), mas o áudio funciona.</div>'; }
  }

  function buildScoreView() {
    const box = $('#plScore');
    let h = '';
    const theme = PL.night ? (APP.settings.light ? 'nightLite' : 'night') : 'day';
    for (let i = 0; i < PL.pages; i++) h += '<div class="pl-page" data-p="' + i + '">' + PL.svg.svg(i, theme) + '<div class="pl-cursor" hidden></div></div>';
    box.innerHTML = '<div class="pl-pages" style="width:' + Math.round(PL.zoom * 100) + '%;max-width:' + Math.round(900 * PL.zoom) + 'px">' + h + '</div>';
    PL.pgs = $$('.pl-page', box); PL.curs = PL.pgs.map((pg) => $('.pl-cursor', pg)); PL.cur = null; PL.sysKey = null; PL.sysKey0 = null;   // guarda os elementos: nada de procurar no DOM a cada quadro
    PL.pgs.forEach((pg) => pg.addEventListener('click', (e) => seekFromClick(pg, e)));
    placeCursor(APP.transport.position());
  }
  /* modo noturno da partitura (a escolha fica salva) */
  PL.night = !!CC.LS.get('dhcoral:scoreNight', false);
  function syncThemeUi() {
    const b = $('#plTheme'); if (!b) return;
    b.setAttribute('aria-pressed', String(PL.night));
    b.setAttribute('aria-label', PL.night ? 'Voltar ao modo claro da partitura' : 'Modo noturno da partitura');
    b.querySelector('use').setAttribute('href', PL.night ? '#i-sun' : '#i-moon');
    $('#plScore').classList.toggle('night', PL.night);
  }
  function setNight(on) {
    PL.night = !!on; CC.LS.set('dhcoral:scoreNight', PL.night); syncThemeUi();
    if (PL.svg) { const sc = $('#plScore'), top = sc.scrollTop, left = sc.scrollLeft; buildScoreView(); sc.scrollTop = top; sc.scrollLeft = left; }
  }
  $('#plTheme').addEventListener('click', () => setNight(!PL.night));
  syncThemeUi();

  function setZoom(d) {
    const i = clampI(ZOOMS.indexOf(PL.zoom) + d, 0, ZOOMS.length - 1);
    PL.zoom = ZOOMS[i];
    const pages = $('#plScore .pl-pages'); if (pages) { pages.style.width = Math.round(PL.zoom * 100) + '%'; pages.style.maxWidth = Math.round(900 * PL.zoom) + 'px'; }
    PL.sysKey = null; PL.sysKey0 = null;
  }
  const clampI = (v, a, b) => Math.max(a, Math.min(b, v));
  $('#plZoomIn').addEventListener('click', () => setZoom(1));
  $('#plZoomOut').addEventListener('click', () => setZoom(-1));

  /* posição de reprodução (passos, com repetições) → posição escrita (semínimas) */
  function stepsToWritten(steps) {
    const q = steps / 4, U = PL.unroll; if (!U.length) return 0;
    let lo = 0, hi = U.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (U[mid].q0 <= q + 1e-9) lo = mid; else hi = mid - 1; }
    const m = PL.score.measures[U[lo].mi];
    return m.start + Math.min(q - U[lo].q0, m.len);
  }
  function placeCursor(steps, force) {
    if (!PL.layout) return;
    const cols = PL.layout.cols; if (!cols.length) return;
    const w = stepsToWritten(steps);
    let lo = 0, hi = cols.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cols[mid].wq <= w + 1e-6) lo = mid; else hi = mid - 1; }
    const c = cols[lo], n = cols[lo + 1];
    let x = c.x;
    if (n && n.page === c.page && Math.abs(n.y1 - c.y1) < 1 && n.x > c.x && n.wq > c.wq) x = c.x + (n.x - c.x) * Math.min(1, Math.max(0, (w - c.wq) / (n.wq - c.wq)));
    const L = PL.layout, pgs = PL.pgs || [], curs = PL.curs || [];
    const cur = curs[c.page - 1], pg = pgs[c.page - 1]; if (!cur || !pg) return;
    const px = Math.round((x - 1.5) / L.W * 10000) / 100;     // % com 2 casas
    const lc = PL.cur;
    if (!lc || lc.page !== c.page || lc.y1 !== c.y1 || lc.y2 !== c.y2) {   // mudou de página/sistema: reposiciona e esconde os outros
      curs.forEach((el, i) => { el.hidden = i !== c.page - 1; });
      cur.style.top = c.y1 / L.H * 100 + '%'; cur.style.height = (c.y2 - c.y1) / L.H * 100 + '%';
      PL.cur = { page: c.page, y1: c.y1, y2: c.y2, px: -1 };
    }
    if (PL.cur.px !== px) { cur.style.left = px + '%'; PL.cur.px = px; }
    // acompanha o cursor com a rolagem: o sistema (todas as pautas) em reprodução fica inteiro à vista
    const sc = $('#plScore');
    const key0 = c.page + ':' + Math.round(c.y1);
    const nowT = performance.now();
    // só mede o layout quando o sistema mudou, quando há rolagem horizontal (zoom) ou a cada ~150 ms; medir a cada quadro trava o celular
    const canX = sc.scrollWidth > sc.clientWidth + 2;
    if ((APP.transport.state === 'playing' || force) && (force || key0 !== PL.sysKey0 || (canX && nowT - (PL.lastMeasure || 0) > 150))) {
      PL.lastMeasure = nowT; PL.sysKey0 = key0;
      const sr = sc.getBoundingClientRect(), pr = pg.getBoundingClientRect();
      const pTop = pr.top - sr.top + sc.scrollTop, pLeft = pr.left - sr.left + sc.scrollLeft;   // posição da página dentro da área rolável
      const top = pTop + c.y1 / L.H * pr.height, bottom = pTop + c.y2 / L.H * pr.height;
      const key = c.page + ':' + Math.round(c.y1) + ':' + Math.round(pr.width);
      const visible = top >= sc.scrollTop + 6 && bottom <= sc.scrollTop + sc.clientHeight - 6;
      const cx = pLeft + x / L.W * pr.width;
      const needX = cx < sc.scrollLeft + 30 || cx > sc.scrollLeft + sc.clientWidth - 30;
      const left = needX ? Math.max(0, cx - sc.clientWidth * 0.3) : sc.scrollLeft;
      const now = performance.now();
      if (force || (key !== PL.sysKey && !visible)) {
        const room = sc.clientHeight - (bottom - top);
        sc.scrollTo({ top: Math.max(0, top - Math.max(8, Math.min(40, room / 2))), left, behavior: force ? 'auto' : 'smooth' });
        PL.smoothUntil = now + 600;      // enquanto a rolagem suave acontece, não mexe na rolagem de novo (isso a cancelaria)
      } else if (needX && now > (PL.smoothUntil || 0)) sc.scrollLeft = left;
      PL.sysKey = key;
    }
  }
  function seekFromClick(pg, e) {
    if (!PL.layout) return;
    const r = pg.getBoundingClientRect(), L = PL.layout;
    const px = (e.clientX - r.left) / r.width * L.W, py = (e.clientY - r.top) / r.height * L.H, page = +pg.dataset.p + 1;
    let best = null, bd = 1e9;
    L.cols.forEach((c) => { if (c.page !== page || py < c.y1 - 6 || py > c.y2 + 6) return; const d = Math.abs(c.x - px); if (d < bd) { bd = d; best = c; } });
    if (!best) return;
    const u = PL.unroll.find((o) => o.mi === best.mi); if (!u) return;
    const m = PL.score.measures[best.mi];
    const steps = (u.q0 + (best.wq - m.start)) * 4;
    APP.transport.seek(steps); placeCursor(steps); syncPlayBtn();
  }

  /* ─ controles ─ */
  const playBtn = $('#plPlay');
  function syncPlayBtn() {
    const playing = APP.transport.state === 'playing';
    playBtn.innerHTML = '<svg class="i"><use href="#i-' + (playing ? 'pause' : 'play') + '"/></svg>';
    playBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Tocar');
  }
  async function ensureVoices() {
    if (APP.settings.timbre !== 'coral') return;
    const S = CC.Samples, need = APP.neededInsts();
    if (need.every((i) => S._ok[i]) && S._busy === 0) return;
    $('#plStatus').textContent = 'Carregando vozes de coro…';
    try { await S.load(need); } catch (e) { /* usa o sintetizador */ }
  }
  playBtn.addEventListener('click', async () => {
    try {
      if (APP.transport.state !== 'playing') { APP.getLive(); await ensureVoices(); APP.syncLevels(); }
      APP.togglePlay();
    } catch (e) { toast(e.message, true); }
    syncPlayBtn();
  });
  $('#plRestart').addEventListener('click', () => { APP.transport.seek(0); placeCursor(0); $('#plScore').scrollTo({ top: 0, behavior: 'smooth' }); syncPlayBtn(); });
  $('#plLoop').addEventListener('click', (e) => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(on)); APP.setLoop(on); });
  $('#plBpmMinus').addEventListener('click', () => { APP.setTempo(APP.getProject().bpm - 2); $('#plBpm').textContent = APP.getProject().bpm; });
  $('#plBpmPlus').addEventListener('click', () => { APP.setTempo(APP.getProject().bpm + 2); $('#plBpm').textContent = APP.getProject().bpm; });
  $('#plBpm').addEventListener('dblclick', () => { APP.setTempo(PL.bpm0); $('#plBpm').textContent = APP.getProject().bpm; });
  $('#plVol').addEventListener('input', (e) => { APP.settings.master = +e.target.value; try { APP.getLive().engine.setMaster(APP.settings.master); } catch (x) { /* ignore */ } });

  /* qual voz ouvir */
  function applyVoices() {
    const guide = $('#plGuide').checked, sel = PL.sel;
    VOICE_ORDER.forEach((k) => { CC.playMods.scale[k] = sel === 'ALL' || sel === k ? 1 : (guide ? 0.22 : 0); });
    CC.playMods.shift.B = $('#plBassDown').checked ? -12 : 0;
    CC.playMods.shift.S = CC.playMods.shift.A = $('#plSADown').checked ? -12 : 0;
    APP.syncLevels();
  }
  $('#plVoices').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    PL.sel = b.dataset.v;
    $$('#plVoices button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
    $('#plGuide').closest('.chk').classList.toggle('dim', PL.sel === 'ALL');
    applyVoices();
    CC.singers.select(PL.sel);
    if (PL.score) { drawScore(false); placeCursor(APP.transport.position(), true); }
    if (PL.sel !== 'ALL') {   // prévia curta da voz escolhida
      const P = APP.getProject(), n = P.notes.find((x) => x.v === PL.sel);
      if (n && APP.transport.state !== 'playing') { try { APP.preview({ v: n.v, m: n.m + (CC.playMods.shift[n.v] || 0) }); } catch (x) { /* ignore */ } }
    }
  });
  $('#plGuide').addEventListener('change', applyVoices);
  $('#plBassDown').addEventListener('change', () => { applyVoices(); toast($('#plBassDown').checked ? 'Baixo uma oitava abaixo' : 'Baixo na altura escrita'); });
  $('#plSADown').addEventListener('change', () => { applyVoices(); toast($('#plSADown').checked ? 'Soprano e contralto uma oitava abaixo' : 'Soprano e contralto na altura escrita'); });
  $('#plGuide').closest('.chk').classList.add('dim');

  /* cantores animados */
  CC.singers.mount($('#plChoir'));
  /* modo leve: menos processamento de som e de tela (para o Android, principalmente gravando a tela) */
  $('#plLight').checked = !!APP.settings.light;
  CC.singers.setLight(APP.settings.light);
  $('#plLight').addEventListener('change', (e) => {
    APP.settings.light = e.target.checked; APP.saveSettings();
    const l = APP.peekLive(); if (l) l.engine.setLight(APP.settings.light);
    CC.singers.setLight(APP.settings.light);
    if (PL.night && PL.svg) { const sc = $('#plScore'), top = sc.scrollTop, left = sc.scrollLeft; buildScoreView(); sc.scrollTop = top; sc.scrollLeft = left; }
    toast(APP.settings.light ? 'Modo leve ligado' : 'Modo leve desligado (qualidade máxima)');
  });
  $('#plSingers').checked = CC.singers.isOn();
  $('#plSingers').addEventListener('change', (e) => CC.singers.setVisible(e.target.checked));


  /* ───────────────────────── Quantos cantores (um / vários) ───────────────────────── */

  function syncEnsembleUi() {
    const e = APP.settings.ensemble === 'many' ? 'many' : 'solo';
    $$('#plEnsemble button').forEach((b) => { const on = b.dataset.e === e; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  }
  $('#plEnsemble').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    APP.settings.ensemble = b.dataset.e === 'many' ? 'many' : 'solo';
    APP.saveSettings();
    const l = APP.peekLive(); if (l) l.engine.setEnsemble(APP.settings.ensemble);
    syncEnsembleUi();
    toast(APP.settings.ensemble === 'many' ? 'Vários cantores em cada voz' : 'Um cantor em cada voz');
    if (APP.transport.state !== 'playing') {   // prévia curta para ouvir a diferença
      const P = APP.getProject();
      const keys = PL.sel === 'ALL' ? VOICE_ORDER : [PL.sel];
      const pv = keys.map((k) => P.notes.find((n) => n.v === k)).filter(Boolean).map((n) => ({ v: n.v, m: n.m + (CC.playMods.shift[n.v] || 0) }));
      if (pv.length) { ensureVoices().then(() => { try { APP.preview(pv); } catch (x) { /* ignore */ } }); }
    }
  });

  /* ───────────────────────── Baixar áudio (WAV / MIDI) por voz ───────────────────────── */

  const radioVal = (name) => { const r = $('input[name="' + name + '"]:checked'); return r ? r.value : null; };
  const setRadio = (name, val) => $$('input[name="' + name + '"]').forEach((r) => { r.checked = r.value === String(val); });

  function syncAudioDlg() {
    const all = radioVal('dlV') === 'ALL', wav = radioVal('dlF') === 'wav';
    $$('input[name="dlP"]').forEach((r) => { r.disabled = all; });
    $('#dlPitchHint').textContent = all ? 'No coro completo valem as opções de oitava marcadas no player (baixo; soprano e contralto).' : '';
    $$('input[name="dlE"], #dlEcho').forEach((r) => { r.disabled = !wav; });
  }
  $$('#dlgAudio input[type=radio]').forEach((r) => r.addEventListener('change', syncAudioDlg));

  $('#plAudio').addEventListener('click', () => {
    const sel = PL.sel;
    setRadio('dlV', sel);
    let p = 0;
    if (sel === 'B' && $('#plBassDown').checked) p = -12;
    if ((sel === 'S' || sel === 'A') && $('#plSADown').checked) p = -12;
    setRadio('dlP', p);
    setRadio('dlF', 'wav');
    setRadio('dlE', APP.settings.ensemble === 'many' ? 'many' : 'solo');
    $('#dlEcho').checked = (APP.settings.reverb || 0) > 0.02;
    syncAudioDlg();
    $('#dlgAudio').showModal();
  });

  $('#btnDoAudio').addEventListener('click', async () => {
    const btn = $('#btnDoAudio'), label = btn.innerHTML;
    btn.disabled = true;
    try {
      const P = APP.getProject();
      const v = radioVal('dlV'), fmt = radioVal('dlF');
      const shift = { S: 0, A: 0, T: 0, B: 0 };
      if (v === 'ALL') {
        shift.B = $('#plBassDown').checked ? -12 : 0;
        shift.S = shift.A = $('#plSADown').checked ? -12 : 0;
      } else shift[v] = parseInt(radioVal('dlP'), 10) || 0;
      // só a(s) voz(es) escolhida(s), com o volume cheio (sem o "ouvir baixinho" do player)
      const voices = {};
      VOICE_ORDER.forEach((k) => { voices[k] = Object.assign({}, P.voices[k], { mute: v !== 'ALL' && k !== v, solo: false }); });
      const scale = { S: 1, A: 1, T: 1, B: 1 };
      const to = Math.max(4, Math.ceil(PL.total * 4 - 1e-9));
      if (!P.notes.some((n) => (v === 'ALL' || n.v === v) && n.s < to)) throw new Error('Esta voz não tem notas neste hino.');
      const vname = v === 'ALL' ? 'coro' : CC.VOICES[v].name.toLowerCase();
      const down = v === 'ALL' ? (shift.B || shift.S ? '_com-oitava-abaixo' : '') : (shift[v] < 0 ? '_oitava-abaixo' : '');
      const base = CC.slug(P.name) + '_' + vname + down;

      if (fmt === 'wav') {
        btn.textContent = 'Preparando o áudio…';
        await new Promise((r) => setTimeout(r, 30));
        const ens = radioVal('dlE') === 'many' ? 'many' : 'solo';
        const rv = $('#dlEcho').checked ? (APP.settings.reverb > 0.02 ? APP.settings.reverb : 0.35) : 0;
        const buf = await CC.renderToBuffer({
          notes: P.notes, voices, bpm: P.bpm, from: 0, to, master: 1, reverb: rv,
          timbre: APP.settings.timbre, ensemble: ens, scale, shift, mono: true,
        });
        await CC.download(CC.encodeWav(buf), base + '.wav');
      } else {
        const skip = CC.monoSkipSet(P.notes, shift);
        const proj = APP.serialize();
        proj.voices = voices;
        proj.notes = P.notes.filter((n) => !skip.has(n)).map((n) => {
          const o = { v: n.v, m: Math.max(0, n.m + (shift[n.v] || 0)), s: n.s, d: n.d };
          if (n.o) o.o = n.o; return o;
        });
        await CC.download(CC.toMidi(proj, { from: 0, to, scale }), base + '.mid');
      }
      toast('Arquivo baixado: ' + base + (fmt === 'wav' ? '.wav' : '.mid'));
      $('#dlgAudio').close();
    } catch (e) { toast('Não foi possível baixar: ' + e.message, true); }
    finally { btn.disabled = false; btn.innerHTML = label; }
  });

  /* PDF e compositor */
  $('#plPdf').addEventListener('click', async () => {
    const b = $('#plPdf'); b.disabled = true;
    try {
      const P = APP.getProject();
      const pages = await CC.downloadScorePdf(P.name, APP.getScore() ? PL.score : CC.projectToScore(P));
      toast('PDF gerado (' + pages + (pages > 1 ? ' páginas)' : ' página)'));
    } catch (e) { toast('Falha ao gerar o PDF: ' + e.message, true); }
    finally { b.disabled = false; }
  });
  $('#plEdit').addEventListener('click', () => { APP.adopt(); go('editor'); });

  /* status das vozes de coro */
  function updateSamplesStatus() {
    const S = CC.Samples, el = $('#plStatus'); if (!el) return;
    if (APP.settings.timbre === 'synth') el.textContent = 'Voz sintetizada.';
    else if (S.state === 'loading') el.textContent = 'Carregando vozes de coro… ' + Math.round(S.progress * 100) + '%';
    else if (S.state === 'error') el.textContent = 'Vozes de coro indisponíveis: usando voz sintetizada.';
    else el.textContent = '';
  }
  CC.Samples.on(updateSamplesStatus);

  /* laço de atualização do cursor */
  function startLoop() {
    if (PL.raf) return;
    const frame = () => {
      PL.raf = 0;
      if (current !== 'player') return;
      if (APP.settings.light && (PL.skip = !PL.skip)) { PL.raf = requestAnimationFrame(frame); return; }   // modo leve: 30 quadros por segundo
      const playing = APP.transport.state === 'playing';
      placeCursor(APP.transport.position());
      CC.singers.tick();
      if (playing !== PL.wasPlaying) { PL.wasPlaying = playing; syncPlayBtn(); }
      const bpm = APP.getProject().bpm; if (bpm !== PL.bpmShown) { PL.bpmShown = bpm; $('#plBpm').textContent = bpm; }
      PL.raf = requestAnimationFrame(frame);
    };
    PL.raf = requestAnimationFrame(frame);
  }
  APP.onTransport((ev) => { if (ev === 'end' && current === 'player') { syncPlayBtn(); placeCursor(0); CC.singers.reset(); } });

  function leavePlayerUi() {
    if (PL.raf) { cancelAnimationFrame(PL.raf); PL.raf = 0; }
    if (current !== 'player' && PL.score && APP.transport.state === 'playing') APP.transport.stop();
    CC.singers.reset();
  }

  /* ───────────────────────── Início ───────────────────────── */

  const params = new URLSearchParams(location.search);
  loadIndex();
  if (params.get('action') === 'new') { APP.newBlank(); go('editor', false); }
  else if (params.get('open') === 'hinos') render('lib');
  else render('home');

  // baixa todos os hinos para uso offline (em segundo plano, depois que o app já abriu)
  setTimeout(() => {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if (!HINOS || !reg.active) return;
      reg.active.postMessage({ type: 'cache-hinos', urls: HINOS.map((h) => 'hinos/' + pad3(h.n) + '.mxl') });
    }).catch(() => {});
  }, 6000);
})();
