// Sincronização: tira um snapshot de N câmaras e guarda-o em data/runs/<id>/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { ensureCatalog } from './discovery.js';
import { getImage, mapLimit } from './http.js';
import { rankCandidates } from './select.js';
import { makeRunId, paths, pruneRuns, readJson, writeJson } from './store.js';

let running = null;
export const isSyncing = () => Boolean(running);

/** Evita sincronizações simultâneas: se já houver uma a correr, devolve essa. */
export function runSync(opts = {}) {
  if (!running) running = doSync(opts).finally(() => { running = null; });
  return running;
}

const safeName = (id) => id.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120);

async function doSync({ reshuffle = false, count = config.count, ctx, fetchImage = getImage, log = console.log } = {}) {
  const startedAt = new Date();
  const runId = makeRunId(startedAt);
  const dir = paths.run(runId);

  const catalog = await ensureCatalog({ ctx, log });
  if (!catalog.cameras.length) throw new Error('Catálogo vazio — nenhuma fonte respondeu.');

  const prevSel = reshuffle ? null : await readJson(paths.selection());
  const candidates = rankCandidates(catalog.cameras.filter((c) => c.imageUrl), {
    previousIds: prevSel?.ids || [],
    maxPerGroup: config.maxPerProvider,
  });

  log(`A capturar ${count} snapshots (${candidates.length} câmaras disponíveis)…`);
  await fs.mkdir(dir, { recursive: true });

  const items = [];
  const failures = [];
  const maxAttempts = count * 4;
  let next = 0;
  while (items.length < count && next < candidates.length && next < maxAttempts) {
    const batch = candidates.slice(next, next + (count - items.length));
    next += batch.length;
    const results = await mapLimit(batch, config.concurrency, async (cam) => {
      const { buf, ext } = await fetchImage(cam.imageUrl, { headers: cam.headers });
      const file = `${safeName(cam.id)}.${ext}`;
      await fs.writeFile(path.join(dir, file), buf);
      return { file, bytes: buf.length, fetchedAt: new Date().toISOString() };
    });
    results.forEach((r, i) => {
      const cam = batch[i];
      if (r.ok) {
        const { headers, imageUrl, group, ...meta } = cam;
        items.push({ ...meta, ...r.value });
      } else {
        failures.push({ id: cam.id, error: r.error.message });
      }
    });
  }

  const manifest = {
    id: runId,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    requested: count,
    count: items.length,
    items,
    failures,
  };
  if (!items.length) {
    await fs.rm(dir, { recursive: true, force: true });
    throw new Error(`Nenhuma imagem capturada (${failures.length} falhas).`);
  }
  await writeJson(path.join(dir, 'manifest.json'), manifest);
  await writeJson(paths.selection(), { updatedAt: manifest.finishedAt, ids: items.map((i) => i.id) });
  const pruned = await pruneRuns(config.maxRuns);
  log(`✓ ${items.length}/${count} snapshots em ${runId} (${failures.length} falhas, ${pruned.length} execuções antigas removidas)`);
  return manifest;
}
