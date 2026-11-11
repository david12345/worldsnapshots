import test from 'node:test';
import assert from 'node:assert/strict';
import { bearingDeg, camerasNear, compass, distanceKm, distanceToBboxKm, providerCovers } from '../src/geo.js';
import { builtinProviders } from '../src/providers/index.js';
import windy from '../src/providers/windy.js';

const LISBOA = [38.7223, -9.1393];
const PORTO = [41.1579, -8.6291];

test('distância Lisboa–Porto ≈ 274 km', () => {
  assert.ok(Math.abs(distanceKm(...LISBOA, ...PORTO) - 274) < 3);
  assert.equal(distanceKm(...LISBOA, ...LISBOA), 0);
});

test('rumo e bússola', () => {
  assert.equal(compass(bearingDeg(...LISBOA, ...PORTO)), 'N');
  assert.equal(compass(bearingDeg(0, 0, 0, 1)), 'E');
  assert.equal(compass(bearingDeg(0, 0, -1, -1)), 'SO');
});

test('câmaras dentro do raio, ordenadas pela distância', () => {
  const cams = [
    { id: 'longe', lat: 38.9, lon: -9.1 },
    { id: 'perto', lat: 38.723, lon: -9.14 },
    { id: 'sem-coord', lat: null, lon: null },
    { id: 'medio', lat: 38.75, lon: -9.14 },
  ];
  const r = camerasNear(cams, ...LISBOA, 10);
  assert.deepEqual(r.map((c) => c.id), ['perto', 'medio']);
  assert.ok(r[0].distanceKm < r[1].distanceKm);
});

test('cobertura das fontes por bbox', () => {
  const tfl = builtinProviders.find((p) => p.id === 'tfl');
  assert.equal(distanceToBboxKm(51.5, -0.12, tfl.bbox), 0);
  assert.equal(providerCovers(tfl, ...LISBOA, 250), false);
  assert.equal(providerCovers(tfl, 51.0, -0.12, 50), true); // ~28 km a sul da bbox
  assert.equal(providerCovers(windy, ...LISBOA, 1), true);   // sem bbox = global
  assert.ok(builtinProviders.filter((p) => p.id !== 'windy').every((p) => p.bbox?.length === 4));
});

test('windy usa nearby quando há localização', async () => {
  const urls = [];
  await windy.discover({ config: { windyApiKey: 'k' }, near: { lat: 38.72231, lon: -9.13932, radiusKm: 400 }, getJson: async (u) => { urls.push(u); return { webcams: [] }; } });
  assert.equal(urls.length, 2);
  assert.match(urls[0], /nearby=38\.7223,-9\.1393,250/); // limitado a 250 km
});
