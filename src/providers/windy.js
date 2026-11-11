// Windy Webcams API v3 — dezenas de milhares de webcams em todo o mundo.
// Requer chave gratuita: https://api.windy.com/keys  →  WINDY_API_KEY=...
// Os URLs de imagem expiram, por isso a fonte é "volátil".
export default {
  id: 'windy',
  name: 'Windy Webcams (mundo)',
  city: 'Mundo',
  country: '—',
  volatile: true,
  signedUrls: true,
  enabled: (config) => Boolean(config.windyApiKey),
  async discover({ getJson, config, near }) {
    const headers = { 'x-windy-api-key': config.windyApiKey };
    // Com localização (versão sem servidor): webcams num raio (a API aceita até 250 km).
    // Sem localização (servidor): as mais populares do mundo.
    const base = 'https://api.windy.com/webcams/api/v3/webcams?limit=50&include=images,location';
    const query = near
      ? `&nearby=${near.lat.toFixed(4)},${near.lon.toFixed(4)},${Math.min(250, Math.max(1, Math.round(near.radiusKm)))}`
      : '&sortKey=popularity&sortDirection=desc';
    const offsets = near ? [0, 50] : [0, 50, 100, 150];
    const pages = offsets.map(async (offset) => {
      const data = await getJson(`${base}${query}&offset=${offset}`, { headers });
      return data.webcams || [];
    });
    const all = (await Promise.all(pages)).flat();
    return all
      .filter((w) => w.status === undefined || w.status === 'active')
      .flatMap((w) => {
        const img = w.images?.current?.preview || w.images?.current?.thumbnail;
        if (!img) return [];
        return [{
          rawId: w.webcamId,
          name: w.title,
          city: w.location?.city || w.location?.region || 'Desconhecido',
          country: w.location?.country_code || w.location?.country || '—',
          lat: w.location?.latitude,
          lon: w.location?.longitude,
          imageUrl: img,
          // Fonte independente por país para efeitos de diversidade na seleção.
          group: `windy:${w.location?.country_code || w.location?.country || '?'}`,
        }];
      });
  },
};
