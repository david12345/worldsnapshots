// Finlândia — Digitraffic weather cameras (Fintraffic). Público, sem chave.
// https://tie.digitraffic.fi/api/weathercam/v1/stations
const HEADERS = { 'Digitraffic-User': 'worldsnapshots' };

export default {
  id: 'digitraffic',
  name: 'Digitraffic Weather Cameras',
  city: 'Finlândia',
  country: 'FI',
  /** Zona coberta [minLat, minLon, maxLat, maxLon] — usada na pesquisa por localização. */
  bbox: [59.6, 19.4, 70.1, 31.6],
  async discover({ getJson }) {
    const data = await getJson('https://tie.digitraffic.fi/api/weathercam/v1/stations', { headers: HEADERS });
    return (data.features || []).flatMap((f) => {
      const p = f.properties || {};
      if (p.collectionStatus && p.collectionStatus !== 'GATHERING') return [];
      const preset = (p.presets || []).find((x) => x.inCollection !== false);
      if (!preset) return [];
      const [lon, lat] = f.geometry?.coordinates || [];
      return [{
        rawId: preset.id,
        name: p.name,
        city: p.name?.split('_')[0] || 'Finlândia',
        country: 'FI',
        lat,
        lon,
        imageUrl: `https://weathercam.digitraffic.fi/${preset.id}.jpg`,
        headers: HEADERS,
      }];
    });
  },
};
