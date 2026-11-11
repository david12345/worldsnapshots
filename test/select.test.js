import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, rankCandidates } from '../src/select.js';

const cams = [];
for (const g of ['a', 'b', 'c']) for (let i = 0; i < 20; i++) cams.push({ id: `${g}:${i}`, group: g });
cams.push({ id: 'd:0', group: 'd' });

test('distribui por grupos respeitando o limite', () => {
  const r = rankCandidates(cams, { maxPerGroup: 5, rng: mulberry32(1) });
  assert.equal(r.length, cams.length);
  assert.equal(new Set(r.map((c) => c.id)).size, cams.length);
  const first16 = r.slice(0, 16);
  const per = Object.groupBy(first16, (c) => c.group);
  assert.deepEqual(Object.keys(per).sort(), ['a', 'b', 'c', 'd']);
  for (const g of ['a', 'b', 'c']) assert.equal(per[g].length, 5);
});

test('mantém a seleção anterior em primeiro lugar', () => {
  const r = rankCandidates(cams, { previousIds: ['c:7', 'gone', 'a:3'], maxPerGroup: 5, rng: mulberry32(2) });
  assert.deepEqual(r.slice(0, 2).map((c) => c.id), ['c:7', 'a:3']);
});
