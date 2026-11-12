// STHETICS // ARCHAEOLOGY — passo 2: vista infinita, 4 immagini per reperto con crediti, catalogo, dossier.

const LAYERS = [
  { key: 'tension',       code: 'L1', label: 'Socio-Technological Tension' },
  { key: 'material',      code: 'L2', label: 'Material Flora (Fetishism)' },
  { key: 'artifacts',     code: 'L3', label: 'Fashion & Design Artifacts' },
  { key: 'gesture',       code: 'L4', label: 'Gestural Notation & Body' },
  { key: 'decomposition', code: 'L5', label: 'Decomposition & Fossilization Vector' }
];
// Le 4 righe del Moodboard: ogni reperto ha una foto per slot.
const SLOTS = [
  { key: 'fashion',  label: 'Moda',          code: 'M' },
  { key: 'design',   label: 'Design',        code: 'D' },
  { key: 'material', label: 'Materiale 40X', code: 'X' },
  { key: 'space',    label: 'Spazio',        code: 'S' }
];
const YEAR_MIN = 1960;
const YEAR_MAX = 2005;

const state = { items: [], view: null, current: null };
const $ = (id) => document.getElementById(id);
const mod = (n, m) => ((n % m) + m) % m;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
const clockTime = () => new Date().toLocaleTimeString('it-IT');
const slotOf = (key) => SLOTS.find((s) => s.key === key);

// ---------- LOG ----------
const logLines = [];
function log(msg) {
  logLines.unshift({ t: clockTime(), msg });
  logLines.length = Math.min(logLines.length, 6);
  $('log').innerHTML = logLines
    .map((l) => `<li><time>[${esc(l.t)}]</time>${esc(l.msg)}</li>`)
    .join('');
}

// ---------- IMMAGINI ----------
// Placeholder SVG (data URI, same-origin: non blocca l'export PNG del passo 6). In cache per non ricrearlo.
const phCache = new Map();
function placeholder(item, slotKey) {
  const key = item.id + slotKey;
  if (phCache.has(key)) return phCache.get(key);
  const s = slotOf(slotKey);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
    <defs><pattern id="h" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="16" stroke="#bdbdb9" stroke-width="2"/></pattern></defs>
    <rect width="800" height="1000" fill="#dcdcd9"/>
    <rect width="800" height="1000" fill="url(#h)"/>
    <circle cx="400" cy="440" r="46" fill="none" stroke="#0b0b0b" stroke-width="2"/>
    <path d="M400 370V510M330 440H470" stroke="#0b0b0b" stroke-width="2"/>
    <text x="400" y="580" fill="#0b0b0b" font-family="Courier New, monospace" font-size="34" font-weight="700" text-anchor="middle">SPECIMEN #${esc(item.id)}</text>
    <text x="400" y="624" fill="#0b0b0b" font-family="Courier New, monospace" font-size="26" text-anchor="middle">${esc(s ? s.label.toUpperCase() : '')}</text>
    <text x="400" y="668" fill="#585854" font-family="Courier New, monospace" font-size="20" text-anchor="middle">IMMAGINE NON CARICATA</text>
  </svg>`;
  const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  phCache.set(key, uri);
  return uri;
}
const imageOf = (item, slotKey) => (item.images || []).find((i) => i.slot === slotKey);
const srcOf = (item, slotKey) => {
  const im = imageOf(item, slotKey);
  return (im && im.file) || placeholder(item, slotKey);
};

function figHTML(item, slotKey, lazy = true) {
  const s = slotOf(slotKey);
  return `<span class="fig">
      <img src="${esc(srcOf(item, slotKey))}" alt="Specimen ${esc(item.id)} · ${esc(s.label)}: ${esc(item.title)}"
        ${lazy ? 'loading="lazy"' : ''} decoding="async" draggable="false" data-id="${esc(item.id)}" data-slot="${esc(slotKey)}">
      <span class="crop" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    </span>`;
}
// Se il file in assets/ non esiste, ripiega sul placeholder
function bindImgFallback(root) {
  root.querySelectorAll('img[data-id]').forEach((img) => {
    img.addEventListener('error', () => {
      const item = state.items.find((i) => i.id === img.dataset.id);
      img.onerror = null;
      if (item) img.src = placeholder(item, img.dataset.slot);
    }, { once: true });
  });
}

// ---------- RIGHELLO CRONOLOGICO ----------
function renderRuler() {
  const span = YEAR_MAX - YEAR_MIN;
  const pct = (y) => ((y - YEAR_MIN) / span) * 100;
  let html = '';
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
    const cls = y % 10 === 0 ? 'ten' : y % 5 === 0 ? 'five' : '';
    html += `<span class="tick ${cls}" style="left:${pct(y)}%"></span>`;
    if (y % 10 === 0 || y === YEAR_MAX) html += `<span class="year" style="left:${pct(y)}%">${y}</span>`;
  }
  state.items.forEach((it) => {
    const [a, b] = it.years;
    html += `<a class="seg" href="#dossier-${esc(it.id)}" style="left:${pct(a)}%;width:${pct(b) - pct(a)}%"
      title="Specimen #${esc(it.id)} · ${esc(it.period)}">#${esc(it.id)}</a>`;
  });
  $('ruler').innerHTML = html;
}

// ---------- CATALOGO ----------
function renderCatalogue() {
  $('grid').innerHTML = state.items.map((it) => `
    <a class="plate" href="#dossier-${esc(it.id)}">
      <div class="plate-head"><span>Specimen #${esc(it.id)}</span><span>${esc(it.period)}</span></div>
      ${figHTML(it, 'design')}
      <div class="plate-body">
        <h3>${esc(it.title)}</h3>
        <p class="pair">${esc(it.fashion.designer)} + ${esc(it.design.designer)}</p>
        <p class="obj">${esc(it.design.artifact)}</p>
        ${it.verified ? '' : '<span class="draft">Bozza da verificare</span>'}
      </div>
    </a>`).join('');
  bindImgFallback($('grid'));
}

// ---------- DOSSIER ----------
function provenanceHTML(it) {
  return SLOTS.map((s) => {
    const im = imageOf(it, s.key);
    const fig = `FIG. ${esc(it.id)}-${s.code}`;
    const c = im && im.credit;
    if (!c) return `<li>${fig} · ${esc(s.label)} · fonte da assegnare</li>`;
    const title = c.url
      ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title || 'fonte')}</a>`
      : esc(c.title || 'fonte');
    return `<li>${fig} · ${esc(s.label)} · ${title}${c.author ? ' · ' + esc(c.author) : ''}${c.license ? ' · ' + esc(c.license) : ''}</li>`;
  }).join('');
}

function renderDossier(id) {
  const idx = state.items.findIndex((i) => i.id === id);
  const it = state.items[idx];
  const prev = state.items[idx - 1];
  const next = state.items[idx + 1];
  $('dossier').innerHTML = `
    <article class="dossier">
      <div class="dossier-fig">
        <div id="dossier-main-fig">${figHTML(it, 'design', false)}</div>
        <p class="caption" id="dossier-caption">Fig. ${esc(it.id)}-D · Design · filtro monocromatico</p>
        <div class="thumbs" role="group" aria-label="Immagini del reperto">
          ${SLOTS.map((s) => `
            <button type="button" class="thumb" data-slot="${s.key}" aria-pressed="${s.key === 'design'}">
              ${figHTML(it, s.key)}<span>${esc(s.label)}</span>
            </button>`).join('')}
        </div>
        <h3 class="protocol-title">Provenienza</h3>
        <ol class="prov">${provenanceHTML(it)}</ol>
      </div>
      <div class="dossier-main">
        <p class="kicker">Specimen #${esc(it.id)} · ${esc(it.period)}</p>
        <h2>${esc(it.title)}</h2>
        <dl class="facts">
          <div><dt>Moda</dt><dd>${esc(it.fashion.designer)} — ${esc(it.fashion.artifact)}</dd></div>
          <div><dt>Design industriale</dt><dd>${esc(it.design.designer)} — ${esc(it.design.artifact)}</dd></div>
          <div><dt>Stato</dt><dd>${it.verified ? 'Verificato' : '<span class="draft">Bozza da verificare</span>'}</dd></div>
          ${it.verified ? '' : `<div><dt>Da controllare</dt><dd>${esc(it.to_verify)}</dd></div>`}
        </dl>
        <h3 class="protocol-title">Protocollo diagnostico a 5 strati</h3>
        <ol class="layers">
          ${LAYERS.map((l) => `
            <li><span class="code">${l.code}</span>
              <div><h4>${esc(l.label)}</h4><p>${esc(it.layers[l.key])}</p></div></li>`).join('')}
        </ol>
        <nav class="pager" aria-label="Reperti">
          ${prev ? `<a href="#dossier-${esc(prev.id)}">&larr; #${esc(prev.id)}</a>` : '<span class="off">&larr; inizio</span>'}
          <a href="#catalogue">Catalogo</a>
          ${next ? `<a href="#dossier-${esc(next.id)}">#${esc(next.id)} &rarr;</a>` : '<span class="off">fine &rarr;</span>'}
        </nav>
      </div>
    </article>`;
  bindImgFallback($('dossier'));

  // Le miniature cambiano la figura principale
  $('dossier').querySelectorAll('.thumb').forEach((btn) => btn.addEventListener('click', () => {
    const s = slotOf(btn.dataset.slot);
    $('dossier-main-fig').innerHTML = figHTML(it, s.key, false);
    bindImgFallback($('dossier-main-fig'));
    $('dossier-caption').textContent = `Fig. ${it.id}-${s.code} · ${s.label} · filtro monocromatico`;
    $('dossier').querySelectorAll('.thumb').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  }));
}

// ---------- VISTA INFINITA ----------
// Griglia di tavole che si ripete in ogni direzione: colonne = reperti (ordine cronologico, poi ricomincia),
// righe = i 4 slot. Si creano solo le tavole visibili.
const TILE_W = 220, TILE_H = 275, GAP = 20, CAP_H = 24;
const PITCH_X = TILE_W + GAP;
const PITCH_Y = TILE_H + CAP_H + GAP;
const Z_MIN = 0.45, Z_MAX = 2;
const INF = { x: 0, y: 0, z: 1, tiles: new Map(), ready: false, drag: null, raf: 0 };

function makeTile(i, j) {
  const item = state.items[mod(i, state.items.length)];
  const slot = SLOTS[mod(j, SLOTS.length)];
  const el = document.createElement('a');
  el.className = 'tile';
  el.href = '#dossier-' + item.id;
  el.tabIndex = -1;
  el.draggable = false;
  el.style.left = i * PITCH_X + 'px';
  el.style.top = j * PITCH_Y + 'px';
  el.innerHTML = `${figHTML(item, slot.key)}<span class="tile-cap">#${esc(item.id)} · ${esc(slot.label)}</span>`;
  bindImgFallback(el);
  return el;
}

function infUpdate() {
  if (!INF.ready || !state.items.length) return;
  const vp = $('inf-vp'), world = $('inf-world');
  const W = vp.clientWidth, H = vp.clientHeight, z = INF.z;
  const i0 = Math.floor(INF.x / PITCH_X) - 1, i1 = Math.ceil((INF.x + W / z) / PITCH_X) + 1;
  const j0 = Math.floor(INF.y / PITCH_Y) - 1, j1 = Math.ceil((INF.y + H / z) / PITCH_Y) + 1;

  for (const [key, el] of INF.tiles) {
    const [i, j] = key.split(',').map(Number);
    if (i < i0 || i > i1 || j < j0 || j > j1) { el.remove(); INF.tiles.delete(key); }
  }
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const key = i + ',' + j;
      if (!INF.tiles.has(key)) {
        const el = makeTile(i, j);
        world.appendChild(el);
        INF.tiles.set(key, el);
      }
    }
  }
  world.style.transform = `translate(${-INF.x * z}px, ${-INF.y * z}px) scale(${z})`;
  // linee di griglia strutturale che seguono la camera
  vp.style.backgroundSize = `${PITCH_X * z}px ${PITCH_Y * z}px`;
  vp.style.backgroundPosition = `${(-INF.x - GAP / 2) * z}px ${(-INF.y - GAP / 2) * z}px`;

  const cx = INF.x + W / (2 * z), cy = INF.y + H / (2 * z);
  const ci = Math.floor(cx / PITCH_X), cj = Math.floor(cy / PITCH_Y);
  const item = state.items[mod(ci, state.items.length)];
  const slot = SLOTS[mod(cj, SLOTS.length)];
  const cycle = Math.floor(ci / state.items.length);
  $('hud-where').textContent =
    `#${item.id} · ${item.period} · ${slot.label.toUpperCase()} · CICLO ${cycle >= 0 ? '+' : ''}${cycle}`;
  $('hud-coord').textContent = `X ${Math.round(cx)} · Y ${Math.round(cy)} · ZOOM ${z.toFixed(2)}`;
}

function infZoomAt(clientX, clientY, factor) {
  const r = $('inf-vp').getBoundingClientRect();
  const px = clientX - r.left, py = clientY - r.top;
  const wx = INF.x + px / INF.z, wy = INF.y + py / INF.z;
  INF.z = Math.min(Z_MAX, Math.max(Z_MIN, INF.z * factor));
  INF.x = wx - px / INF.z;
  INF.y = wy - py / INF.z;
  infUpdate();
}
function infZoomCenter(factor) {
  const r = $('inf-vp').getBoundingClientRect();
  infZoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
}
function infCenterOn(i, j) {
  const vp = $('inf-vp');
  INF.z = 1;
  INF.x = i * PITCH_X + TILE_W / 2 - vp.clientWidth / 2;
  INF.y = j * PITCH_Y + TILE_H / 2 - vp.clientHeight / 2;
  infUpdate();
}

function infStopInertia() { cancelAnimationFrame(INF.raf); INF.raf = 0; }
function infInertia(vx, vy) {
  let last = performance.now();
  const step = (now) => {
    const dt = Math.min(32, now - last); last = now;
    INF.x -= (vx * dt) / INF.z;
    INF.y -= (vy * dt) / INF.z;
    vx *= 0.95; vy *= 0.95;
    infUpdate();
    if (Math.hypot(vx, vy) > 0.02) INF.raf = requestAnimationFrame(step);
  };
  INF.raf = requestAnimationFrame(step);
}

function infInit() {
  if (INF.ready) return;
  INF.ready = true;
  const vp = $('inf-vp');

  vp.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.hud button')) return;
    infStopInertia();
    vp.setPointerCapture(e.pointerId);
    vp.classList.add('grabbing');
    INF.drag = {
      id: e.pointerId, lastX: e.clientX, lastY: e.clientY, lastT: performance.now(),
      vx: 0, vy: 0, moved: 0, tile: e.target.closest('.tile')
    };
  });
  vp.addEventListener('pointermove', (e) => {
    const d = INF.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.lastX, dy = e.clientY - d.lastY;
    const now = performance.now(), dt = Math.max(1, now - d.lastT);
    d.vx = dx / dt; d.vy = dy / dt;
    d.lastX = e.clientX; d.lastY = e.clientY; d.lastT = now;
    d.moved += Math.abs(dx) + Math.abs(dy);
    INF.x -= dx / INF.z;
    INF.y -= dy / INF.z;
    infUpdate();
  });
  const end = (e) => {
    const d = INF.drag;
    if (!d || e.pointerId !== d.id) return;
    INF.drag = null;
    vp.classList.remove('grabbing');
    if (vp.hasPointerCapture(e.pointerId)) vp.releasePointerCapture(e.pointerId);
    if (e.type === 'pointerup' && d.moved < 6 && d.tile) {
      location.hash = d.tile.getAttribute('href').replace('#', '');
    } else if (e.type === 'pointerup' && !reduceMotion() && Math.hypot(d.vx, d.vy) > 0.05) {
      infInertia(d.vx, d.vy);
    }
  };
  vp.addEventListener('pointerup', end);
  vp.addEventListener('pointercancel', end);

  vp.addEventListener('wheel', (e) => {
    e.preventDefault();
    infStopInertia();
    if (e.ctrlKey || e.metaKey) infZoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
    else { INF.x += e.deltaX / INF.z; INF.y += e.deltaY / INF.z; infUpdate(); }
  }, { passive: false });

  vp.addEventListener('keydown', (e) => {
    const step = 90 / INF.z;
    const k = e.key;
    if (k === 'ArrowLeft') INF.x -= step;
    else if (k === 'ArrowRight') INF.x += step;
    else if (k === 'ArrowUp') INF.y -= step;
    else if (k === 'ArrowDown') INF.y += step;
    else if (k === '+' || k === '=') { infZoomCenter(1.2); e.preventDefault(); return; }
    else if (k === '-') { infZoomCenter(1 / 1.2); e.preventDefault(); return; }
    else if (k === '0') { infCenterOn(0, 1); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    infUpdate();
  });

  $('inf-zoom-in').addEventListener('click', () => infZoomCenter(1.25));
  $('inf-zoom-out').addEventListener('click', () => infZoomCenter(1 / 1.25));
  $('inf-reset').addEventListener('click', () => infCenterOn(0, 1));
  window.addEventListener('resize', () => { if (state.view === 'infinite') infUpdate(); });

  infCenterOn(0, 1); // parte da #001, riga Design
}

// ---------- VISTE E ROUTING ----------
function showView(view, id) {
  state.view = view;
  ['infinite', 'catalogue', 'dossier'].forEach((v) => { $('view-' + v).hidden = v !== view; });
  if (view === 'dossier') {
    state.current = id;
    renderDossier(id);
    log(`VIEW → CLINICAL DOSSIER · SPECIMEN #${id}`);
  } else if (view === 'infinite') {
    infInit();
    infUpdate();
    log('VIEW → INFINITE VIEW');
  } else {
    log('VIEW → CATALOGUE GRID');
  }
  document.querySelectorAll('.views button').forEach((b) => {
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.ruler .seg').forEach((s) =>
    s.classList.toggle('on', view === 'dossier' && s.getAttribute('href') === `#dossier-${id}`));
  if (view !== 'infinite') infStopInertia();
  window.scrollTo(0, 0);
}

function route() {
  if (!state.items.length) return;
  const h = location.hash.replace('#', '');
  const m = h.match(/^dossier-(\d{3})$/);
  if (m && state.items.some((i) => i.id === m[1])) showView('dossier', m[1]);
  else if (h === 'catalogue') showView('catalogue');
  else showView('infinite');
}

function initNav() {
  $('nav-infinite').addEventListener('click', () => { location.hash = 'infinite'; });
  $('nav-catalogue').addEventListener('click', () => { location.hash = 'catalogue'; });
  $('nav-dossier').addEventListener('click', () => {
    location.hash = 'dossier-' + (state.current || state.items[0].id);
  });
  $('nav-moodboard').addEventListener('click', () => {
    log('MODULE OFFLINE · MOODBOARD MATRIX · IN ARRIVO AL PASSO 4');
  });
}

// ---------- INIT ----------
async function init() {
  const tick = () => { $('clock').textContent = clockTime(); };
  tick();
  setInterval(tick, 1000);

  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error(res.status);
    state.items = await res.json();
  } catch (err) {
    $('view-catalogue').hidden = false;
    $('view-catalogue').innerHTML =
      '<p class="error">ERROR // impossibile caricare data.json.<br>' +
      'Se apri index.html con doppio click il browser blocca fetch(): usa un server locale ' +
      '(es. <code>python3 -m http.server</code>) oppure GitHub Pages.</p>';
    log('ERROR · data.json NON CARICATO');
    return;
  }
  $('meta-count').textContent = String(state.items.length).padStart(2, '0');
  const verified = state.items.filter((i) => i.verified).length;
  $('meta-verified').textContent = `${verified}/${state.items.length}`;

  renderRuler();
  renderCatalogue();
  initNav();
  log(`ARCHIVE LOADED · ${state.items.length} SPECIMENS · ${state.items.length * SLOTS.length} SLOTS`);
  log(`${verified}/${state.items.length} VERIFICATI · ${state.items.length - verified} IN BOZZA`);
  window.addEventListener('hashchange', route);
  route();
}

init();
