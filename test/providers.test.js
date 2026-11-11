import test from 'node:test';
import assert from 'node:assert/strict';
import tfl from '../src/providers/tfl.js';
import singapore from '../src/providers/singapore.js';
import nyc from '../src/providers/nyc.js';
import digitraffic from '../src/providers/digitraffic.js';
import caltrans from '../src/providers/caltrans.js';
import hongkong from '../src/providers/hongkong.js';
import ontario from '../src/providers/ontario.js';
import windy from '../src/providers/windy.js';
import { makeCustomProvider } from '../src/providers/custom.js';
import { normalize } from '../src/discovery.js';

const ctx = (byUrl) => ({
  config: { windyApiKey: 'k' },
  getJson: async (url) => {
    const key = Object.keys(byUrl).find((k) => url.includes(k));
    if (!key) throw new Error(`sem fixture para ${url}`);
    return byUrl[key];
  },
  getText: async (url) => ctx(byUrl).getJson(url),
});

test('tfl', async () => {
  const cams = await tfl.discover(ctx({ JamCam: [
    { id: 'JamCams_1', commonName: 'A40', lat: 51.5, lon: -0.1, additionalProperties: [{ key: 'available', value: 'true' }, { key: 'imageUrl', value: 'https://s3/1.jpg' }] },
    { id: 'JamCams_2', commonName: 'off', lat: 51, lon: 0, additionalProperties: [{ key: 'available', value: 'false' }, { key: 'imageUrl', value: 'https://s3/2.jpg' }] },
  ] }));
  assert.equal(cams.length, 1);
  assert.equal(cams[0].imageUrl, 'https://s3/1.jpg');
});

test('singapore', async () => {
  const cams = await singapore.discover(ctx({ 'traffic-images': { items: [{ cameras: [
    { camera_id: '1001', image: 'https://images.data.gov.sg/1001.jpg', location: { latitude: 1.29, longitude: 103.87 } },
  ] }] } }));
  assert.deepEqual([cams[0].rawId, cams[0].lat], ['1001', 1.29]);
});

test('nyc', async () => {
  const cams = await nyc.discover(ctx({ nyctmc: [
    { id: 'abc', name: 'Broadway', latitude: 40.7, longitude: -73.9, isOnline: 'true' },
    { id: 'off', name: 'x', latitude: 40.7, longitude: -73.9, isOnline: 'false' },
  ] }));
  assert.equal(cams.length, 1);
  assert.match(cams[0].imageUrl, /cameras\/abc\/image$/);
});

test('digitraffic', async () => {
  const cams = await digitraffic.discover(ctx({ weathercam: { features: [
    { geometry: { coordinates: [24.9, 60.2, 0] }, properties: { name: 'Helsinki_Kehä', collectionStatus: 'GATHERING', presets: [{ id: 'C0150200', inCollection: true }] } },
    { geometry: { coordinates: [25, 61, 0] }, properties: { name: 'Off', collectionStatus: 'REMOVED_TEMPORARILY', presets: [{ id: 'C1' }] } },
  ] } }));
  assert.equal(cams.length, 1);
  assert.equal(cams[0].imageUrl, 'https://weathercam.digitraffic.fi/C0150200.jpg');
  assert.equal(cams[0].lat, 60.2);
});

test('caltrans tolera distritos que falham', async () => {
  const cams = await caltrans.discover(ctx({ cctvStatusD07: { data: [
    { cctv: { index: '5', inService: 'true', location: { locationName: 'I-405', nearbyPlace: 'Santa Monica', latitude: '34.0', longitude: '-118.4' }, imageData: { static: { currentImageURL: 'https://cwwp2.dot.ca.gov/x.jpg' } } } },
  ] } }));
  assert.equal(cams.length, 1);
  assert.equal(cams[0].city, 'Santa Monica, CA');
});

test('hongkong (XML)', async () => {
  const xml = `<image-list><image><key>H429F</key><region>HK</region><district>Central</district><description>Queensway</description><latitude>22.27</latitude><longitude>114.16</longitude><url>https://tdcctv.data.one.gov.hk/H429F.JPG</url></image></image-list>`;
  const cams = await hongkong.discover({ getText: async () => xml });
  assert.equal(cams[0].rawId, 'H429F');
  assert.equal(cams[0].city, 'Central, Hong Kong');
});

test('ontario (formato com Views)', async () => {
  const cams = await ontario.discover(ctx({ '511on': [
    { Id: 1, Roadway: 'QEW', Location: 'Hwy 10', Latitude: 43.5, Longitude: -79.6, Views: [{ Id: 9, Url: 'https://511on.ca/map/Cctv/9', Status: 'Enabled' }, { Id: 10, Url: 'https://x', Status: 'Disabled' }] },
    { Id: 2, Name: 'Old', Latitude: 45, Longitude: -75, Url: 'https://511on.ca/old.jpg' },
  ] }));
  assert.deepEqual(cams.map((c) => c.rawId), ['1-9', '2-0']);
});

test('windy só ativo com chave; agrupa por país', async () => {
  assert.equal(windy.enabled({ windyApiKey: '' }), false);
  const cams = await windy.discover(ctx({ 'api.windy.com': { webcams: [
    { webcamId: 1, title: 'Lisboa', status: 'active', location: { city: 'Lisboa', country_code: 'PT', latitude: 38.7, longitude: -9.1 }, images: { current: { preview: 'https://imgproxy.windy.com/1.jpg' } } },
  ] } }));
  assert.equal(cams[0].group, 'windy:PT');
});

test('fonte personalizada (sources.json)', async () => {
  const p = makeCustomProvider({ id: 'x', url: 'https://e/api', itemsPath: 'data.list', fields: { id: 'id', name: 'n', lat: 'pos.lat', lon: 'pos.lon' }, imageTemplate: 'https://e/img/{id}.jpg' });
  const cams = await p.discover({ getJson: async () => ({ data: { list: [{ id: 'a b', n: 'Praça', pos: { lat: 1, lon: 2 } }] } }) });
  assert.equal(cams[0].imageUrl, 'https://e/img/a%20b.jpg');
});

test('normalize descarta entradas inválidas', () => {
  const out = normalize({ id: 'p', name: 'P', city: 'C', country: 'XX' }, [
    { rawId: 1, imageUrl: 'https://a/1.jpg', lat: NaN },
    { rawId: 2, imageUrl: 'javascript:alert(1)' },
    { imageUrl: 'https://a/3.jpg' },
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].id, out[0].lat, out[0].city], ['p:1', null, 'C']);
});
