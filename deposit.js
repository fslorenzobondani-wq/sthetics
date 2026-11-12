// STHETICS // ARCHAEOLOGY — Deposito aperto: incolli un link, la pagina lo verifica e un modello nel browser propone le categorie.
// Funziona dopo app.js e ne usa le funzioni globali (state, $, esc, log, SLOTS, licenseOk, plain, itemOf, onPoolChanged).

const DEP = { cfg: null, last: null, busy: false, model: null };
const DEP_LOCAL_KEY = 'archaeology-deposits-local-v1';

function depCfg() {
  const c = window.DEPOSIT_CONFIG || {};
  return c.url && c.key ? { url: String(c.url).replace(/\/$/, ''), key: c.key } : null;
}

// ---------- ARCHIVIO DEI DEPOSITI ----------
function depToEntry(r) {
  return {
    id: r.specimen_id, slot: r.slot, src: r.src, aspect: r.aspect || 0.8, deposit: true,
    credit: { title: r.title || 'immagine depositata', author: r.author || '', license: r.license || 'licenza non verificata', url: r.page_url || r.src }
  };
}
function depLocal() {
  try { return JSON.parse(localStorage.getItem(DEP_LOCAL_KEY) || '[]'); } catch (e) { return []; }
}
async function loadDeposits() {
  DEP.cfg = depCfg();
  let rows = depLocal();
  if (DEP.cfg) {
    try {
      const res = await fetch(`${DEP.cfg.url}/rest/v1/deposits?status=eq.approved&select=*&order=created_at.desc&limit=300`,
        { headers: { apikey: DEP.cfg.key, Authorization: 'Bearer ' + DEP.cfg.key } });
      if (!res.ok) throw new Error(res.status);
      rows = rows.concat(await res.json());
    } catch (err) {
      log('DEPOSITO · DATABASE NON RAGGIUNGIBILE');
    }
  }
  state.deposits = rows.filter((r) => itemOf(r.specimen_id) && SLOTS.some((s) => s.key === r.slot) && /^https:\/\//.test(r.src || '')).map(depToEntry);
  if (state.deposits.length) log(`DEPOSITO · ${state.deposits.length} IMMAGINI`);
  onPoolChanged(true);
}

async function depSave(rec) {
  if (DEP.cfg) {
    const res = await fetch(`${DEP.cfg.url}/rest/v1/deposits`, {
      method: 'POST',
      headers: { apikey: DEP.cfg.key, Authorization: 'Bearer ' + DEP.cfg.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(Object.assign({}, rec, { status: 'pending' }))
    });
    if (!res.ok) throw new Error('database ' + res.status);
    return 'pending';
  }
  const all = depLocal();
  all.push(Object.assign({}, rec, { status: 'approved' }));
  localStorage.setItem(DEP_LOCAL_KEY, JSON.stringify(all));
  state.deposits = (state.deposits || []).concat(depToEntry(rec));
  onPoolChanged(true);
  return 'local';
}

// ---------- LETTURA DEL LINK ----------
function depParse(raw) {
  let u;
  try { u = new URL(raw.trim()); } catch (e) { return { err: 'Questo non è un indirizzo web valido.' }; }
  if (u.protocol !== 'https:') return { err: 'Servono link che iniziano con https://' };
  const host = u.hostname.replace(/^www\./, '');
  if (/(pinterest|instagram|tiktok|vinted|facebook)\./.test(host)) {
    return { err: 'Da questo sito non si possono leggere né licenza né immagine. Cerca la stessa foto su Wikimedia Commons e incolla quel link.' };
  }
  if (host === 'commons.wikimedia.org' && /\/wiki\/File:/.test(u.pathname)) {
    return { kind: 'commons', title: decodeURIComponent(u.pathname.split('/wiki/')[1]).replace(/_/g, ' ') };
  }
  if (host === 'upload.wikimedia.org') {
    const parts = u.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('thumb');
    const name = i >= 0 ? parts[parts.length - 2] : parts[parts.length - 1];
    return { kind: 'commons', title: 'File:' + decodeURIComponent(name).replace(/_/g, ' ') };
  }
  if (/\.(jpe?g|png|webp)$/i.test(u.pathname)) return { kind: 'direct', url: u.href, host };
  return { err: 'Incolla il link di una pagina File: di Wikimedia Commons oppure l\'indirizzo diretto di un\'immagine (finisce in .jpg, .png o .webp).' };
}

// ---------- VERIFICA SU COMMONS ----------
async function depCommons(title) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', titles: title,
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '640'
  });
  const res = await fetch(COMMONS + '?' + params.toString());
  if (!res.ok) throw new Error('Commons ' + res.status);
  const data = await res.json();
  const page = Object.values((data.query && data.query.pages) || {})[0];
  const ii = page && page.imageinfo && page.imageinfo[0];
  if (!ii) return { checks: [['no', 'Il file non esiste su Commons.']], ok: false };
  const meta = ii.extmetadata || {};
  const lic = meta.LicenseShortName && meta.LicenseShortName.value;
  const author = plain(meta.Artist && meta.Artist.value);
  const dateRaw = plain((meta.DateTimeOriginal && meta.DateTimeOriginal.value) || (meta.DateTime && meta.DateTime.value) || '');
  const yr = (dateRaw.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/) || [])[1];
  const tw = ii.thumbwidth || ii.width, th = ii.thumbheight || ii.height, aspect = tw / th;
  const checks = [];
  const okMime = ['image/jpeg', 'image/png'].includes(ii.mime);
  checks.push([okMime ? 'ok' : 'no', okMime ? 'Formato ' + ii.mime : 'Formato non adatto (' + ii.mime + ')']);
  const okSize = (ii.width || 0) >= 600;
  checks.push([okSize ? 'ok' : 'no', `Larghezza ${ii.width}px` + (okSize ? '' : ' · troppo piccola (minimo 600)')]);
  const okLic = licenseOk(lic);
  checks.push([okLic ? 'ok' : 'no', 'Licenza: ' + (lic || 'non indicata') + (okLic ? '' : ' · non ammessa (solo CC0, pubblico dominio, CC BY, CC BY-SA)')]);
  checks.push([author ? 'ok' : 'warn', 'Autore: ' + (author || 'non indicato')]);
  checks.push([yr ? 'ok' : 'warn', 'Anno dichiarato: ' + (yr || 'non indicato')]);
  const okAsp = aspect > 0.4 && aspect < 2.6;
  if (!okAsp) checks.push(['no', 'Proporzioni troppo estreme']);
  return {
    ok: okMime && okSize && okLic && okAsp,
    checks,
    rec: { src: ii.thumburl || ii.url, page_url: ii.descriptionurl, title: (page.title || '').replace(/^File:/, ''), author, license: lic, year: yr ? +yr : null, aspect }
  };
}

// ---------- VERIFICA DI UN'IMMAGINE DIRETTA ----------
function depLoadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('immagine non leggibile'));
    img.src = url;
  });
}
async function depDirect(p) {
  const checks = [];
  try {
    const img = await depLoadImage(p.url);
    const aspect = img.naturalWidth / img.naturalHeight;
    const okSize = img.naturalWidth >= 600;
    checks.push([okSize ? 'ok' : 'no', `Larghezza ${img.naturalWidth}px` + (okSize ? '' : ' · troppo piccola (minimo 600)')]);
    checks.push(['warn', 'Licenza e autore non verificabili da un link diretto: la depositi sotto la tua responsabilità e resta in attesa di approvazione.']);
    return { ok: okSize, checks, rec: { src: p.url, page_url: p.url, title: p.host, author: '', license: 'non verificata', year: null, aspect } };
  } catch (e) {
    checks.push(['no', 'Il sito non permette di leggere l\'immagine da un\'altra pagina (o il file non esiste).']);
    return { ok: false, checks };
  }
}

// ---------- AI NEL BROWSER (CLIP, classificazione zero-shot) ----------
const SLOT_LABELS = {
  fashion: 'a photograph of a garment or clothing worn on a body',
  design: 'a photograph of an industrial design object or a piece of furniture',
  material: 'a macro close-up photograph of a material surface or texture',
  space: 'a photograph of an architectural interior or a built space'
};
async function depClassify(src, setStatus) {
  if (window.__depClassifyStub) return window.__depClassifyStub(src);
  if (!DEP.model) {
    setStatus('Scarico il modello AI (la prima volta può volerci un minuto)…');
    const mod = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    mod.env.allowLocalModels = false;
    DEP.model = await mod.pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
  }
  setStatus('L\'AI guarda l\'immagine…');
  const slotKeys = Object.keys(SLOT_LABELS);
  const slotOut = await DEP.model(src, slotKeys.map((k) => SLOT_LABELS[k]));
  const items = state.items;
  const perLabels = items.map((it) => `a photograph related to ${it.title}, ${it.period}`);
  const perOut = await DEP.model(src, perLabels);
  return {
    slot: slotOut.map((o) => ({ key: slotKeys[slotKeys.findIndex((k) => SLOT_LABELS[k] === o.label)], score: o.score })).sort((a, b) => b.score - a.score),
    period: perOut.map((o) => ({ key: items[perLabels.indexOf(o.label)].id, score: o.score })).sort((a, b) => b.score - a.score)
  };
}

// ---------- INTERFACCIA ----------
function depRender() {
  const cfg = depCfg();
  $('deposit').innerHTML = `
    <div class="dep">
      <p class="kicker">04 · Deposito aperto</p>
      <h2>Deposita un'immagine</h2>
      <p class="dep-lead">Incolla un link a un file di Wikimedia Commons (o l'indirizzo diretto di un'immagine). La pagina controlla licenza, autore e anno; poi un modello AI, che gira nel tuo browser, suggerisce a quale reperto e a quale slot appartiene.</p>
      <p class="dep-note">${cfg
        ? 'Le immagini depositate restano <strong>in attesa</strong> finché non vengono approvate.'
        : 'Il database non è ancora collegato: le immagini si salvano <strong>solo in questo browser</strong>.'}
        L'AI propone, non decide: puoi correggere la scelta prima di depositare.</p>
      <form id="dep-form" class="dep-form">
        <label for="dep-url">Link</label>
        <div class="dep-row">
          <input id="dep-url" type="url" inputmode="url" placeholder="https://commons.wikimedia.org/wiki/File:…" required autocomplete="off">
          <button type="submit" id="dep-go">Verifica</button>
        </div>
      </form>
      <div id="dep-out" class="dep-out" aria-live="polite"></div>
    </div>`;
  $('dep-form').addEventListener('submit', (e) => { e.preventDefault(); depRun($('dep-url').value); });
}

const CHECK_MARK = { ok: '✓', warn: '!', no: '✗' };
function depChecksHTML(checks) {
  return `<ul class="dep-checks">${checks.map(([k, t]) => `<li class="${k}"><b>${CHECK_MARK[k]}</b> ${esc(t)}</li>`).join('')}</ul>`;
}

async function depRun(raw) {
  if (DEP.busy) return;
  DEP.busy = true;
  const out = $('dep-out'), go = $('dep-go');
  go.disabled = true;
  const setStatus = (t) => { out.innerHTML = `<p class="dep-status">${esc(t)}</p>`; };
  try {
    setStatus('Controllo il link…');
    const p = depParse(raw);
    if (p.err) { out.innerHTML = `<p class="dep-error">${esc(p.err)}</p>`; return; }
    setStatus(p.kind === 'commons' ? 'Interrogo Wikimedia Commons…' : 'Carico l\'immagine…');
    const v = p.kind === 'commons' ? await depCommons(p.title) : await depDirect(p);
    if (!v.ok) {
      out.innerHTML = `<h3 class="protocol-title">Verifica</h3>${depChecksHTML(v.checks)}<p class="dep-error">Non posso depositarla: almeno un controllo è fallito.</p>`;
      return;
    }
    let ai = null, aiNote = '';
    try { ai = await depClassify(v.rec.src, setStatus); }
    catch (err) { aiNote = 'L\'AI non è partita (' + (err && err.message ? err.message : 'errore') + '): scegli a mano reperto e slot.'; }
    DEP.last = { rec: v.rec, ai };
    const bestPeriod = ai ? ai.period[0].key : state.items[0].id;
    const bestSlot = ai ? ai.slot[0].key : SLOTS[0].key;
    const pct = (x) => Math.round(x * 100) + '%';
    out.innerHTML = `
      <figure class="dep-fig"><img src="${esc(v.rec.src)}" alt="Anteprima dell'immagine da depositare" referrerpolicy="no-referrer"></figure>
      <h3 class="protocol-title">Verifica</h3>${depChecksHTML(v.checks)}
      <h3 class="protocol-title">Suggerimento dell'AI</h3>
      ${ai ? `<p class="dep-ai">Slot: ${ai.slot.slice(0, 2).map((s) => `${esc(slotOf(s.key).label)} ${pct(s.score)}`).join(' · ')}<br>
        Reperto: ${ai.period.slice(0, 3).map((s) => `#${esc(s.key)} ${pct(s.score)}`).join(' · ')}<br>
        <small>Il riconoscimento di slot è abbastanza affidabile; quello del periodo molto meno. Controlla.</small></p>` : `<p class="dep-note">${esc(aiNote)}</p>`}
      <form id="dep-save" class="dep-save">
        <label>Reperto
          <select id="dep-item">${state.items.map((it) => `<option value="${esc(it.id)}" ${it.id === bestPeriod ? 'selected' : ''}>#${esc(it.id)} · ${esc(it.title)} (${esc(it.period)})</option>`).join('')}</select></label>
        <label>Slot
          <select id="dep-slot">${SLOTS.map((s) => `<option value="${s.key}" ${s.key === bestSlot ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        <button type="submit" id="dep-submit">Deposita</button>
      </form>`;
    $('dep-save').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('dep-submit'); btn.disabled = true;
      const rec = Object.assign({}, DEP.last.rec, {
        specimen_id: $('dep-item').value, slot: $('dep-slot').value,
        ai: DEP.last.ai ? { slot: DEP.last.ai.slot.slice(0, 2), period: DEP.last.ai.period.slice(0, 3) } : null
      });
      try {
        const mode = await depSave(rec);
        out.innerHTML = `<p class="dep-ok">${mode === 'pending'
          ? 'Depositata. Resta in attesa di approvazione prima di comparire nel muro.'
          : 'Depositata. Compare nel muro in questo browser.'}</p>`;
        log(`DEPOSITO · #${rec.specimen_id} · ${rec.slot.toUpperCase()} · ${mode === 'pending' ? 'IN ATTESA' : 'LOCALE'}`);
        $('dep-url').value = '';
      } catch (err) {
        btn.disabled = false;
        out.insertAdjacentHTML('beforeend', `<p class="dep-error">Non sono riuscito a salvare: ${esc(err.message)}</p>`);
      }
    });
  } catch (err) {
    out.innerHTML = `<p class="dep-error">Qualcosa è andato storto: ${esc(err.message)}</p>`;
  } finally {
    DEP.busy = false;
    go.disabled = false;
  }
}

function depInit_unused() {
  depRender();
  loadDeposits();
}

depRender();
