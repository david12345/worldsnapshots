// Ontário — 511ON (Toronto, Ottawa, …). Desde 2026 exige chave gratuita de programador:
// https://511on.ca/developers  →  ONTARIO_511_KEY=...
export default {
  id: 'ontario',
  name: 'Ontario 511 Cameras',
  city: 'Ontário',
  country: 'CA',
  enabled: (config) => Boolean(config.ontario511Key),
  /** Zona coberta [minLat, minLon, maxLat, maxLon] — usada na pesquisa por localização. */
  bbox: [41.6, -95.2, 56.9, -74.3],
  async discover({ getJson, config }) {
    const data = await getJson(`https://511on.ca/api/v2/get/cameras?format=json&key=${encodeURIComponent(config.ontario511Key)}`);
    return data.flatMap((c) => {
      // A API já teve dois formatos: campo Url direto, ou lista Views[].
      const views = c.Views?.length ? c.Views : [{ Id: 0, Url: c.Url, Status: c.Status }];
      return views
        .filter((v) => v.Url && !/disabled/i.test(v.Status || ''))
        .map((v) => ({
          rawId: `${c.Id}-${v.Id ?? 0}`,
          name: [c.Roadway, c.Location || c.Name].filter(Boolean).join(' — ') || `Câmara ${c.Id}`,
          city: c.Organization || c.Source || 'Ontário',
          country: 'CA',
          lat: Number(c.Latitude),
          lon: Number(c.Longitude),
          imageUrl: v.Url,
        }));
    });
  },
};
