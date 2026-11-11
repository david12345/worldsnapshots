const $ = (s) => document.querySelector(s);
const api = (p, opts) => fetch(p, opts).then((r) => (r.ok ? r.json() : Promise.reject(r)));

const state = { runs: [], index: -1, live: true, lastRunId: null, playing: null, status: null };

const flag = (cc) => (/^[A-Z]{2}$/i.test(cc || '')
  ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
  : '🌐');
const fmtTime = (iso) => new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'medium' });
const ago = (iso) => {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  return `há ${Math.round(s / 3600)} h`;
};
const until = (iso) => {
  const s = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function loadRuns() {
  state.runs = await api('/api/runs');
  const slider = $('#slider');
  slider.max = Math.max(0, state.runs.length - 1);
  if (state.live || state.index < 0) state.index = state.runs.length - 1;
  slider.value = state.index;
  $('#empty').hidden = state.runs.length > 0;
  if (state.runs.length) await showRun(state.index);
}

async function showRun(i) {
  const run = state.runs[i];
  if (!run) return;
  state.index = i;
  $('#run-label').textContent = `${fmtTime(run.startedAt)} · ${i + 1}/${state.runs.length}`;
  const m = await api(`/api/runs/${run.id}`);
  renderGrid(m);
}

function renderGrid(m) {
  const grid = $('#grid');
  const existing = new Map([...grid.children].map((el) => [el.dataset.id, el]));
  const frag = document.createDocumentFragment();
  for (const it of m.items) {
    let el = existing.get(it.id);
    const src = `/snapshots/${m.id}/${it.file}`;
    if (!el) {
      el = document.createElement('article');
      el.className = 'card';
      el.dataset.id = it.id;
      el.innerHTML = `<div class="img"><img loading="lazy" alt=""><span class="badge"></span></div>
        <div class="meta"><div class="city"></div><div class="name"></div><div class="time"></div></div>`;
      el.addEventListener('click', () => openCamera(el._item));
    }
    el._item = it;
    const img = el.querySelector('img');
    if (img.getAttribute('src') !== src) img.src = src;
    img.alt = `${it.name} — ${it.city}`;
    el.querySelector('.badge').textContent = it.providerName || it.provider;
    el.querySelector('.city').textContent = `${flag(it.country)} ${it.city}`;
    el.querySelector('.name').textContent = it.name;
    el.querySelector('.time').textContent = `capturado ${fmtTime(it.fetchedAt)}`;
    frag.appendChild(el);
  }
  grid.replaceChildren(frag);
}

async function refreshStatus() {
  try {
    const s = await api('/api/status');
    state.status = s;
    renderStatus();
    $('#btn-sync').disabled = $('#btn-reshuffle').disabled = s.syncing;
    const lastId = s.lastRun?.id || null;
    if (lastId !== state.lastRunId) {
      state.lastRunId = lastId;
      await loadRuns();
    }
  } catch {
    $('#status').innerHTML = '<span class="err">Servidor indisponível</span>';
  }
}

function renderStatus() {
  const s = state.status;
  if (!s) return;
  const parts = [];
  if (s.syncing) parts.push('<b>A sincronizar…</b>');
  if (s.lastRun) parts.push(`Último: ${s.lastRun.count}/${s.lastRun.requested} câmaras ${ago(s.lastRun.finishedAt)}`);
  if (s.nextSyncAt && !s.syncing) parts.push(`próximo em ${until(s.nextSyncAt)} (cada ${s.intervalMinutes} min)`);
  if (s.catalog) {
    const prov = Object.values(s.catalog.providers);
    parts.push(`${s.catalog.total.toLocaleString('pt-PT')} câmaras em ${prov.filter((p) => p.ok).length}/${prov.length} fontes`);
  }
  if (s.lastError) parts.push(`<span class="err">Erro: ${esc(s.lastError.message)}</span>`);
  $('#status').innerHTML = parts.join(' · ');
  if (s.catalog) {
    $('#status').title = Object.entries(s.catalog.providers)
      .map(([id, p]) => `${p.ok ? '✓' : '✗'} ${p.name || id}: ${p.ok ? `${p.count} câmaras` : p.error}`).join('\n');
  }
}

async function sync(reshuffle) {
  $('#btn-sync').disabled = $('#btn-reshuffle').disabled = true;
  await api(`/api/sync${reshuffle ? '?reshuffle=1' : ''}`, { method: 'POST' }).catch(() => {});
  setLive(true);
  refreshStatus();
}

function setLive(on) {
  state.live = on;
  $('#chk-live').checked = on;
  if (on && state.runs.length) {
    $('#slider').value = state.runs.length - 1;
    showRun(state.runs.length - 1);
  }
}

function togglePlay(btn, slider, onStep) {
  if (btn._timer) {
    clearInterval(btn._timer);
    btn._timer = null;
    btn.textContent = '▶';
    return;
  }
  btn.textContent = '❚❚';
  if (Number(slider.value) >= Number(slider.max)) slider.value = 0;
  onStep(Number(slider.value));
  btn._timer = setInterval(() => {
    const v = Number(slider.value) + 1;
    if (v > Number(slider.max)) return togglePlay(btn, slider, onStep);
    slider.value = v;
    onStep(v);
  }, 700);
}

// ---- Modal: histórico de uma câmara ----
let history = [];
async function openCamera(it) {
  $('#m-title').textContent = `${flag(it.country)} ${it.city} — ${it.name}`;
  $('#m-sub').textContent = `${it.providerName || it.provider}${it.lat != null ? ` · ${it.lat.toFixed(4)}, ${it.lon.toFixed(4)}` : ''}`;
  history = await api(`/api/cameras/${encodeURIComponent(it.id)}/history`);
  const s = $('#m-slider');
  s.max = Math.max(0, history.length - 1);
  const cur = history.findIndex((h) => h.runId === state.runs[state.index]?.id);
  s.value = cur >= 0 ? cur : history.length - 1;
  showHistory(Number(s.value));
  $('#modal').showModal();
}
function showHistory(i) {
  const h = history[i];
  if (!h) return;
  $('#m-img').src = `/snapshots/${h.runId}/${h.file}`;
  $('#m-label').textContent = `${fmtTime(h.fetchedAt)} · ${i + 1}/${history.length}`;
}

$('#btn-sync').onclick = () => sync(false);
$('#btn-reshuffle').onclick = () => {
  if (confirm('Escolher um novo conjunto de câmaras? (o histórico anterior mantém-se)')) sync(true);
};
$('#slider').oninput = (e) => { setLive(false); showRun(Number(e.target.value)); };
$('#chk-live').onchange = (e) => setLive(e.target.checked);
$('#btn-play').onclick = (e) => { setLive(false); togglePlay(e.currentTarget, $('#slider'), showRun); };
$('#m-slider').oninput = (e) => showHistory(Number(e.target.value));
$('#m-play').onclick = (e) => togglePlay(e.currentTarget, $('#m-slider'), showHistory);
$('#modal').addEventListener('close', () => { const b = $('#m-play'); if (b._timer) togglePlay(b, $('#m-slider'), showHistory); });

refreshStatus();
setInterval(refreshStatus, 5000);
setInterval(renderStatus, 1000);
