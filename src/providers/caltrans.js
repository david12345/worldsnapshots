// Califórnia — Caltrans CCTV (um ficheiro JSON por distrito). Público, sem chave.
// https://cwwp2.dot.ca.gov/data/d7/cctv/cctvStatusD07.json
const DISTRICTS = [
  { d: 1, city: 'Eureka' }, { d: 2, city: 'Redding' }, { d: 3, city: 'Sacramento' },
  { d: 4, city: 'São Francisco (Bay Area)' }, { d: 5, city: 'San Luis Obispo' }, { d: 6, city: 'Fresno' },
  { d: 7, city: 'Los Angeles' }, { d: 8, city: 'San Bernardino' }, { d: 9, city: 'Bishop' },
  { d: 10, city: 'Stockton' }, { d: 11, city: 'San Diego' }, { d: 12, city: 'Orange County' },
];

export default {
  id: 'caltrans',
  name: 'Caltrans CCTV',
  city: 'Califórnia',
  country: 'US',
  /** Zona coberta [minLat, minLon, maxLat, maxLon] — usada na pesquisa por localização. */
  bbox: [32.5, -124.5, 42.1, -114.1],
  async discover({ getJson }) {
    const results = await Promise.allSettled(DISTRICTS.map(async ({ d, city }) => {
      const dd = String(d).padStart(2, '0');
      const data = await getJson(`https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${dd}.json`);
      return (data.data || []).flatMap(({ cctv }) => {
        const url = cctv?.imageData?.static?.currentImageURL;
        if (!url || cctv.inService === 'false') return [];
        const loc = cctv.location || {};
        return [{
          rawId: `d${d}-${cctv.index}`,
          name: loc.locationName || `CCTV ${cctv.index}`,
          city: loc.nearbyPlace ? `${loc.nearbyPlace}, CA` : city,
          country: 'US',
          lat: Number(loc.latitude),
          lon: Number(loc.longitude),
          imageUrl: url,
        }];
      });
    }));
    const ok = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
    if (!ok.length && results.length) throw results.find((r) => r.status === 'rejected').reason;
    return ok;
  },
};
