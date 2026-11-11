import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { config } from './config.js';
import { listRunIds, paths, readJson, readManifest, RUN_ID_RE } from './store.js';
import { isSyncing, runSync } from './sync.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

const state = { nextSyncAt: null, lastError: null, timer: null };

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function serveFile(res, file, cache = 'no-cache') {
  try {
    const st = await fs.stat(file);
    if (!st.isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache });
    createReadStream(file).pipe(res);
  } catch {
    send(res, 404, { error: 'não encontrado' });
  }
}

// Cache de manifests (são imutáveis depois de escritos).
const manifestCache = new Map();
async function manifest(id) {
  if (!manifestCache.has(id)) {
    const m = await readManifest(id);
    if (!m) return null;
    manifestCache.set(id, m);
  }
  return manifestCache.get(id);
}

async function status() {
  const ids = await listRunIds();
  const catalog = await readJson(paths.catalog());
  const last = ids.length ? await manifest(ids.at(-1)) : null;
  return {
    syncing: isSyncing(),
    intervalMinutes: config.syncIntervalMin,
    nextSyncAt: state.nextSyncAt,
    lastError: state.lastError,
    runs: ids.length,
    lastRun: last && { id: last.id, finishedAt: last.finishedAt, count: last.count, requested: last.requested },
    catalog: catalog && {
      updatedAt: catalog.updatedAt,
      total: catalog.cameras.length,
      providers: catalog.providers,
    },
  };
}

function triggerSync(opts) {
  const p = runSync(opts);
  p.then(() => { state.lastError = null; })
    .catch((e) => { state.lastError = { at: new Date().toISOString(), message: e.message }; console.error('Sync falhou:', e.message); });
  return p;
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && p === '/api/status') return send(res, 200, await status());

  if (req.method === 'GET' && p === '/api/runs') {
    const ids = await listRunIds();
    const list = await Promise.all(ids.map(async (id) => {
      const m = await manifest(id);
      return m && { id, startedAt: m.startedAt, finishedAt: m.finishedAt, count: m.count };
    }));
    return send(res, 200, list.filter(Boolean));
  }

  let m = p.match(/^\/api\/runs\/([^/]+)$/);
  if (req.method === 'GET' && m) {
    const ids = await listRunIds();
    const id = m[1] === 'latest' ? ids.at(-1) : m[1];
    if (!id || !RUN_ID_RE.test(id)) return send(res, 404, { error: 'sem snapshots ainda' });
    const man = await manifest(id);
    return man ? send(res, 200, man) : send(res, 404, { error: 'execução não encontrada' });
  }

  m = p.match(/^\/api\/cameras\/(.+)\/history$/);
  if (req.method === 'GET' && m) {
    const camId = m[1];
    const ids = await listRunIds();
    const history = [];
    for (const id of ids) {
      const it = (await manifest(id))?.items.find((i) => i.id === camId);
      if (it) history.push({ runId: id, file: it.file, fetchedAt: it.fetchedAt });
    }
    return send(res, 200, history);
  }

  if (req.method === 'POST' && p === '/api/sync') {
    const already = isSyncing();
    triggerSync({ reshuffle: url.searchParams.get('reshuffle') === '1' });
    return send(res, 202, { started: !already, syncing: true });
  }

  m = p.match(/^\/snapshots\/([^/]+)\/([^/]+)$/);
  if (req.method === 'GET' && m) {
    if (!RUN_ID_RE.test(m[1]) || !/^[\w-]+\.(jpg|png|webp|gif)$/.test(m[2])) return send(res, 400, { error: 'caminho inválido' });
    return serveFile(res, path.join(paths.run(m[1]), m[2]), 'public, max-age=31536000, immutable');
  }

  if (req.method === 'GET') {
    const rel = p === '/' ? 'index.html' : p.slice(1);
    const file = path.resolve(config.publicDir, rel);
    if (!file.startsWith(config.publicDir + path.sep)) return send(res, 400, { error: 'caminho inválido' });
    return serveFile(res, file);
  }
  send(res, 405, { error: 'método não suportado' });
}

/** Agenda a próxima sincronização, alinhada ao intervalo a partir da última execução. */
async function scheduleNext() {
  clearTimeout(state.timer);
  if (config.syncIntervalMin <= 0) { state.nextSyncAt = null; return; }
  const ids = await listRunIds();
  const last = ids.length ? await manifest(ids.at(-1)) : null;
  const intervalMs = config.syncIntervalMin * 60_000;
  const due = last ? Date.parse(last.startedAt) + intervalMs : Date.now();
  const delay = Math.max(0, due - Date.now());
  state.nextSyncAt = new Date(Date.now() + delay).toISOString();
  state.timer = setTimeout(async () => {
    try { await triggerSync(); } catch { /* já registado */ }
    // Em caso de falha, volta a tentar dentro de um intervalo (não em ciclo apertado).
    if (state.lastError) {
      state.nextSyncAt = new Date(Date.now() + intervalMs).toISOString();
      state.timer = setTimeout(scheduleNext, intervalMs);
    } else {
      scheduleNext();
    }
  }, delay);
}

export async function startServer() {
  const server = http.createServer((req, res) => {
    route(req, res).catch((e) => { console.error(e); if (!res.headersSent) send(res, 500, { error: e.message }); });
  });
  await new Promise((r) => server.listen(config.port, r));
  console.log(`WorldSnapshots em http://localhost:${config.port}`);
  console.log(config.syncIntervalMin > 0
    ? `Sincronização automática a cada ${config.syncIntervalMin} min (SYNC_INTERVAL_MINUTES)`
    : 'Sincronização automática desligada (SYNC_INTERVAL_MINUTES=0)');
  await scheduleNext();
  return server;
}
