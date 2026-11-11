import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-'));
process.env.DATA_DIR = dir;
process.env.PROVIDERS = 'tfl,singapore';
process.env.MAX_PER_PROVIDER = '3';
process.env.MAX_RUNS = '2';
const { runSync } = await import('../src/sync.js');
const { listRunIds, readJson, paths } = await import('../src/store.js');

let sgCalls = 0;
const ctx = {
  config: {},
  getJson: async (url) => {
    if (url.includes('JamCam')) {
      return Array.from({ length: 10 }, (_, i) => ({ id: `L${i}`, commonName: `L${i}`, lat: 51, lon: 0, additionalProperties: [{ key: 'imageUrl', value: `https://img/L${i}.jpg` }] }));
    }
    sgCalls++;
    return { items: [{ cameras: Array.from({ length: 10 }, (_, i) => ({ camera_id: `S${i}`, image: `https://img/S${i}.jpg?sig=${sgCalls}`, location: { latitude: 1, longitude: 103 } })) }] };
  },
};
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(3000)]);
// L0, L1 e S0 estão sempre em baixo.
const fetchImage = async (url) => {
  if (/\/(L0|L1|S0)\.jpg/.test(url)) throw new Error('HTTP 503');
  return { buf: jpeg, ext: 'jpg' };
};
const quiet = () => {};

test('sync captura N imagens, substitui falhas e guarda seleção estável', async () => {
  const m1 = await runSync({ count: 6, ctx, fetchImage, log: quiet });
  assert.equal(m1.count, 6);
  assert.ok(m1.items.every((i) => !/^(tfl:L0|tfl:L1|singapore:S0)$/.test(i.id)));
  const files = await fs.readdir(paths.run(m1.id));
  assert.equal(files.filter((f) => f.endsWith('.jpg')).length, 6);
  assert.equal(m1.items[0].imageUrl, undefined, 'manifest não expõe URLs de origem');

  await new Promise((r) => setTimeout(r, 1100)); // IDs de execução têm resolução ao segundo
  const m2 = await runSync({ count: 6, ctx, fetchImage, log: quiet });
  assert.deepEqual(m2.items.map((i) => i.id), m1.items.map((i) => i.id), 'mesmas câmaras entre sincronizações');
  assert.equal(sgCalls, 2, 'fonte volátil redescoberta a cada sync');

  await new Promise((r) => setTimeout(r, 1100));
  await runSync({ count: 6, ctx, fetchImage, log: quiet });
  assert.equal((await listRunIds()).length, 2, 'histórico limitado a MAX_RUNS');
  assert.equal((await readJson(paths.selection())).ids.length, 6);
});

test.after(() => fs.rm(dir, { recursive: true, force: true }));
