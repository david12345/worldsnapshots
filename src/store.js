import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export const paths = {
  catalog: () => path.join(config.dataDir, 'catalog.json'),
  selection: () => path.join(config.dataDir, 'selection.json'),
  runsDir: () => path.join(config.dataDir, 'runs'),
  run: (id) => path.join(config.dataDir, 'runs', id),
};

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

export async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

export const RUN_ID_RE = /^\d{8}T\d{6}Z$/;

export function makeRunId(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

/** IDs das execuções guardadas, da mais antiga para a mais recente. */
export async function listRunIds() {
  try {
    const names = await fs.readdir(paths.runsDir());
    return names.filter((n) => RUN_ID_RE.test(n)).sort();
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

export const readManifest = (id) => readJson(path.join(paths.run(id), 'manifest.json'));

export async function pruneRuns(keep) {
  const ids = await listRunIds();
  const old = ids.slice(0, Math.max(0, ids.length - keep));
  await Promise.all(old.map((id) => fs.rm(paths.run(id), { recursive: true, force: true })));
  return old;
}
