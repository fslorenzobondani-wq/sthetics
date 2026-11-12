// STHETICS // ARCHAEOLOGY — passo 3: muro infinito casuale, ricerca live su Wikimedia Commons, catalogo, dossier.

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

const state = { items: [], view: null, current: null, live: {} };
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
const itemOf = (id) => state.items.find((i) => i.id === id);

// Generatore pseudo-casuale con seme: il muro è casuale ma identico a ogni apertura.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- LOG ----------
const logLines = [];
function log(msg) {
  logLines.unshift({ t: clockTime(), msg });
  logLines.length = Math.min(logLines.length, 6);
  $('log').innerHTML = logLines
    .map((l) => `<li><time>[${esc(l.t)}]</time>${esc(l.msg)}</li>`)
    .join('');
}

// ---------- RICERCA LIVE SU WIKIMEDIA COMMONS ----------
// Nessun server e nessuna chiave: l'API di Commons accetta richieste dal browser (origin=*).
// Si tengono solo file con licenza CC0, pubblico dominio, CC BY, CC BY-SA. Autore e licenza finiscono nei crediti.
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const LIVE_KEY = 'archaeology-live-v2';
const LIVE_TTL = 24 * 3600 * 1000;
const PER_QUERY = 6;

function licenseOk(name) {
  const tokens = String(name || '').toLowerCase().split(/[\s\-_/]+/);
  if (tokens.includes('nc') || tokens.includes('nd')) return false;
  if (tokens.includes('cc0') || tokens.includes('pd') || (tokens.includes('public') && tokens.includes('domain'))) return true;
  return tokens.includes('cc') && tokens.includes('by');
}
const plain = (html) =>
  new DOMParser().parseFromString(String(html || ''), 'text/html').documentElement.textContent.trim();

async function commonsSearch(job) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '640'
  });
  if (job.file) {
    params.set('titles', job.file);
  } else {
    params.set('generator', 'search');
    params.set('gsrnamespace', '6');
    params.set('gsrlimit', '20');
    params.set('gsrsearch', job.q + ' filetype:bitmap');
  }
  const res = await fetch(COMMONS + '?' + params.toString());
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  const pages = Object.values((data.query && data.query.pages) || {})
    .sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii || !['image/jpeg', 'image/png'].includes(ii.mime)) continue;
    if ((ii.width || 0) < 600) continue;
    const meta = ii.extmetadata || {};
    const lic = meta.LicenseShortName && meta.LicenseShortName.value;
    if (!licenseOk(lic)) continue;
    const tw = ii.thumbwidth || ii.width, th = ii.thumbheight || ii.height;
    const aspect = tw / th;
    if (!(aspect > 0.4 && aspect < 2.6)) continue;
    out.push({
      id: job.id, slot: job.slot, src: ii.thumburl || ii.url, aspect,
      credit: {
        title: (p.title || '').replace(/^File:/, ''),
        author: plain(meta.Artist && meta.Artist.value),
        license: lic, url: ii.descriptionurl
      }
    });
    if (out.length >= PER_QUERY) break;
  }
  return out;
}

async function loadLive() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(LIVE_KEY) || 'null'); } catch (e) { /* storage non disponibile */ }
  if (cached && cached.v === 1 && cached.d && Date.now() - cached.t < LIVE_TTL) {
    state.live = cached.d;
    log(`LIVE SEARCH · DA CACHE · ${liveCount()} IMMAGINI`);
    onPoolChanged(true);
    return;
  }
  const jobs = [];
  state.items.forEach((it) => (it.images || []).forEach((im) => {
    if (im.local) return;
    if (im.commons_file) jobs.push({ id: it.id, slot: im.slot, file: im.commons_file });
    [im.query].concat(im.more || []).filter(Boolean).forEach((q) => jobs.push({ id: it.id, slot: im.slot, q }));
  }));
  if (!jobs.length) return;
  log(`LIVE SEARCH · WIKIMEDIA COMMONS · ${jobs.length} QUERY`);

  const live = {};
  let next = 0, fail = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        const found = await commonsSearch(job);
        const key = job.id + '|' + job.slot;
        const list = live[key] || (live[key] = []);
        found.forEach((f) => { if (!list.some((x) => x.credit.title === f.credit.title)) list.push(f); });
        state.live = Object.assign({}, live);
        schedulePool();
      } catch (err) {
        fail++;
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  state.live = live;
  const n = liveCount();
  log(fail ? `LIVE SEARCH · ${n} IMMAGINI · ${fail} QUERY FALLITE` : `LIVE SEARCH · ${n} IMMAGINI TROVATE`);
  onPoolChanged(true);
  if (!fail && n) {
    try { localStorage.setItem(LIVE_KEY, JSON.stringify({ v: 1, t: Date.now(), d: live })); } catch (e) { /* ok */ }
  }
}
const liveCount = () => Object.values(state.live).reduce((s, a) => s + a.length, 0);

let poolTimer = 0;
function schedulePool() {
  clearTimeout(poolTimer);
  poolTimer = setTimeout(() => onPoolChanged(false), 300);
}
// full = true: aggiorna anche il dossier aperto (si fa solo a ricerca conclusa, per non far saltare la pagina)
function onPoolChanged(full) {
  renderCatalogue();
  if (full && state.view === 'dossier' && state.current) renderDossier(state.current);
  if (INF.ready) { buildWall(); infUpdate(); }
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

// Tutte le immagini disponibili per uno slot: il file locale (se c'è) oppure i risultati della ricerca live.
function entriesFor(item, slotKey) {
  const im = imageOf(item, slotKey);
  if (im && im.local && im.file) {
    return [{ id: item.id, slot: slotKey, src: im.file, aspect: im.w && im.h ? im.w / im.h : 0.8, credit: im.credit || null, own: !im.credit }];
  }
  return state.live[item.id + '|' + slotKey] || [];
}
const bestEntry = (item, slotKey) => entriesFor(item, slotKey)[0] || null;
const srcOf = (item, slotKey) => { const e = bestEntry(item, slotKey); return e ? e.src : placeholder(item, slotKey); };

function figHTML(item, slotKey, lazy = true) {
  const s = slotOf(slotKey);
  return `<span class="fig">
      <img src="${esc(srcOf(item, slotKey))}" alt="Specimen ${esc(item.id)} · ${esc(s.label)}: ${esc(item.title)}"
        ${lazy ? 'loading="lazy"' : ''} decoding="async" draggable="false" data-id="${esc(item.id)}" data-slot="${esc(slotKey)}">
      <span class="crop" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    </span>`;
}
// Se un file non si carica, ripiega sul placeholder
function bindImgFallback(root) {
  root.querySelectorAll('img[data-id]').forEach((img) => {
    img.addEventListener('error', () => {
      const item = itemOf(img.dataset.id);
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
  const laneEnd = [];
  state.items.forEach((it) => {
    const [a, b] = it.years;
    let lane = laneEnd.findIndex((end) => a > end);
    if (lane < 0) lane = laneEnd.length;
    laneEnd[lane] = b;
    html += `<a class="seg" href="#dossier-${esc(it.id)}" style="left:${pct(a)}%;width:${Math.max(pct(b) - pct(a), 2.2)}%;top:${4 + lane * 26}px"
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
    const e = bestEntry(it, s.key);
    const fig = `FIG. ${esc(it.id)}-${s.code}`;
    if (!e) return `<li>${fig} · ${esc(s.label)} · fonte da assegnare</li>`;
    const c = e.credit;
    if (!c) return `<li>${fig} · ${esc(s.label)} · file locale</li>`;
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
        ${(it.sources || []).length ? `<h3 class="protocol-title">Fonti dei dati</h3>
        <ol class="prov">${it.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a></li>`).join('')}</ol>` : ''}
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

// ---------- MURO INFINITO ----------
// Asse verticale = tempo: in alto 1960, in basso 2005. Ogni immagine sta all'altezza del periodo del suo reperto
// (con un po' di casualità dentro il periodo). Le colonne sono sfalsate, con proporzioni naturali.
// In orizzontale è infinito: le R ricette di colonna si ripetono. In verticale è finito (la cronologia ha un inizio e una fine).
const COL_W = 250, GAP = 28, R = 9;
const PXY = 150, TOP_PAD = 140;                       // pixel per anno e margine sopra 1960
const WORLD_H = TOP_PAD * 2 + (YEAR_MAX - YEAR_MIN) * PXY;
const yearY = (yr) => TOP_PAD + (yr - YEAR_MIN) * PXY;
const Z_MIN = 0.4, Z_MAX = 2;
const INF = { x: 0, y: 0, z: 1, z0: 1, tiles: new Map(), pool: [], cols: [], ready: false, drag: null, raf: 0, cap: '' };

// Tutte le immagini del muro. Gli slot senza immagini diventano una tavola segnaposto con proporzioni variabili.
const FALLBACK_ASPECTS = [0.72, 0.8, 1, 1.28, 0.66, 1.5, 0.9, 1.15];
function buildPool() {
  const pool = [];
  state.items.forEach((it, ii) => SLOTS.forEach((s, si) => {
    const list = entriesFor(it, s.key);
    if (list.length) list.forEach((e) => pool.push(e));
    else pool.push({ id: it.id, slot: s.key, src: null, aspect: FALLBACK_ASPECTS[(ii * 4 + si) % FALLBACK_ASPECTS.length], credit: null });
  }));
  return pool;
}

function buildWall() {
  INF.pool = buildPool();
  INF.cols = [];
  for (let r = 0; r < R; r++) {
    const rand = rng(1000 + r * 7919);
    const picks = [];
    let cursor = TOP_PAD * 0.4 + rand() * 260, last = -1;
    while (cursor < WORLD_H - TOP_PAD * 0.4) {
      // l'immagine deve appartenere a un reperto il cui periodo contiene l'anno di questa posizione
      const yr = YEAR_MIN + (cursor - TOP_PAD) / PXY;
      let cand = [];
      INF.pool.forEach((e, i) => {
        const it = itemOf(e.id);
        if (yr >= it.years[0] - 0.5 && yr <= it.years[1] + 1.5 && i !== last) cand.push(i);
      });
      if (!cand.length) {
        let best = 1e9;
        INF.pool.forEach((e, i) => {
          const it = itemOf(e.id), d = Math.min(Math.abs(yr - it.years[0]), Math.abs(yr - it.years[1]));
          if (d < best) { best = d; cand = [i]; } else if (d === best) cand.push(i);
        });
      }
      const idx = cand[Math.floor(rand() * cand.length)];
      last = idx;
      const e = INF.pool[idx];
      const h = Math.round(COL_W / Math.min(2.2, Math.max(0.45, e.aspect)));
      const yTop = Math.max(0, Math.min(cursor, WORLD_H - h));
      picks.push({ idx, yr: YEAR_MIN + (yTop + h / 2 - TOP_PAD) / PXY, h, y: yTop });
      cursor += h + GAP + Math.floor(rand() * 90);
    }
    INF.cols.push(picks);
  }
  INF.tiles.forEach((el) => el.remove());
  INF.tiles.clear();
}

function makeTile(c, k) {
  const p = INF.cols[mod(c, R)][k];
  const e = INF.pool[p.idx];
  const item = itemOf(e.id);
  const s = slotOf(e.slot);
  const el = document.createElement('a');
  el.className = 'tile';
  el.href = '#dossier-' + e.id;
  el.tabIndex = -1;
  el.draggable = false;
  el.style.cssText = `left:${c * (COL_W + GAP)}px;top:${Math.round(p.y)}px;width:${COL_W}px;height:${p.h}px`;
  const c2 = e.credit;
  el.dataset.cap = `${Math.round(p.yr)} · #${e.id} · ${s.label}` + (c2 ? ` · ${c2.author || c2.title || ''} · ${c2.license || ''}` : '');
  const asPlaceholder = () => {
    el.classList.add('ph');
    el.innerHTML = `<span>#${esc(e.id)} · ${esc(s.label)}</span>`;
  };
  if (e.src) {
    const img = document.createElement('img');
    img.src = e.src;
    img.alt = `Specimen ${e.id} · ${s.label}: ${item ? item.title : ''}`;
    img.decoding = 'async';
    img.draggable = false;
    img.addEventListener('error', asPlaceholder, { once: true });
    el.appendChild(img);
  } else {
    asPlaceholder();
  }
  return el;
}

function infBuildYears() {
  let html = '';
  for (let yr = YEAR_MIN; yr <= YEAR_MAX; yr += 5) {
    html += `<span class="yr ${yr % 10 === 0 ? 'dec' : ''}" data-yr="${yr}"></span>`;
  }
  $('inf-years').innerHTML = html;
}

function infClamp() {
  const H = $('inf-vp').clientHeight;
  INF.y = Math.min(Math.max(0, WORLD_H - H / INF.z), Math.max(0, INF.y));
}

function infUpdate() {
  if (!INF.ready || !INF.cols.length) return;
  const vp = $('inf-vp'), world = $('inf-world');
  const W = vp.clientWidth, H = vp.clientHeight, z = INF.z;
  infClamp();
  const px = COL_W + GAP;
  const c0 = Math.floor(INF.x / px) - 1, c1 = Math.ceil((INF.x + W / z) / px) + 1;
  const ya = INF.y - 240, yb = INF.y + H / z + 240;

  const need = new Set();
  for (let c = c0; c <= c1; c++) {
    INF.cols[mod(c, R)].forEach((p, k) => {
      if (p.y + p.h >= ya && p.y <= yb) need.add(c + ',' + k);
    });
  }
  for (const [key, el] of INF.tiles) {
    if (!need.has(key)) { el.remove(); INF.tiles.delete(key); }
  }
  for (const key of need) {
    if (!INF.tiles.has(key)) {
      const [c, k] = key.split(',').map(Number);
      const el = makeTile(c, k);
      world.appendChild(el);
      INF.tiles.set(key, el);
    }
  }
  world.style.transform = `translate(${-INF.x * z}px, ${-INF.y * z}px) scale(${z})`;
  document.querySelectorAll('#inf-years .yr').forEach((t) => {
    t.style.top = `${(yearY(+t.dataset.yr) - INF.y) * z}px`;
  });
  const yrNow = Math.min(YEAR_MAX, Math.max(YEAR_MIN, YEAR_MIN + (INF.y + H / (2 * z) - TOP_PAD) / PXY));
  $('hud-coord').textContent = INF.cap ||
    `ANNO ${Math.round(yrNow)} · X ${Math.round(INF.x + W / (2 * z))} · ZOOM ${z.toFixed(2)} · ${INF.pool.length} IMG`;
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
function infReset() {
  INF.z = INF.z0;
  INF.x = 0;
  INF.y = 0;
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
  INF.z0 = INF.z = window.innerWidth < 640 ? 0.7 : 1;
  infBuildYears();
  buildWall();

  vp.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.hud')) return;
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

  // Didascalia dell'immagine sotto il cursore (al posto delle coordinate)
  vp.addEventListener('mouseover', (e) => {
    const t = e.target.closest('.tile');
    const cap = t ? t.dataset.cap : '';
    if (cap !== INF.cap) { INF.cap = cap; infUpdate(); }
  });
  vp.addEventListener('mouseleave', () => { if (INF.cap) { INF.cap = ''; infUpdate(); } });

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
    else if (k === '0') { infReset(); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    infUpdate();
  });

  $('inf-zoom-in').addEventListener('click', () => infZoomCenter(1.25));
  $('inf-zoom-out').addEventListener('click', () => infZoomCenter(1 / 1.25));
  $('inf-reset').addEventListener('click', infReset);
  window.addEventListener('resize', () => { if (state.view === 'infinite') infUpdate(); });
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
  if (m && itemOf(m[1])) showView('dossier', m[1]);
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
  loadLive(); // riempie muro, catalogo e dossier appena arrivano i risultati
}

init();
