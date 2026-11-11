import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSharedCode, trimCatalog } from '../src/build-static.js';

test('código partilhado é script clássico válido e expõe as fontes', async () => {
  const code = await buildSharedCode();
  assert.doesNotMatch(code, /^\s*(import|export)\s/m);
  const api = new Function(`${code}; return { PROVIDERS, rankCandidates, normalize };`)();
  assert.ok(api.PROVIDERS.length >= 8);
  assert.ok(api.PROVIDERS.every((p) => p.id && typeof p.discover === 'function'));
  assert.equal(typeof api.rankCandidates, 'function');
});

test('catálogo embutido exclui fontes voláteis e cabeçalhos', () => {
  const out = trimCatalog({ updatedAt: '2026-01-01T00:00:00Z', cameras: [
    { id: 'tfl:1', provider: 'tfl', group: 'tfl', imageUrl: 'https://a' },
    { id: 'singapore:1', provider: 'singapore', group: 'singapore', imageUrl: 'https://b' },
    { id: 'digitraffic:1', provider: 'digitraffic', group: 'digitraffic', imageUrl: 'https://c', headers: { x: 1 } },
  ] });
  assert.deepEqual(out.cameras.map((c) => c.id), ['tfl:1', 'digitraffic:1']);
  assert.equal(out.cameras[1].headers, undefined);
  assert.equal(trimCatalog({ cameras: [] }), null);
});
