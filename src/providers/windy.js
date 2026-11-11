// Windy Webcams API v3 — dezenas de milhares de webcams em todo o mundo.
// Requer chave gratuita: https://api.windy.com/keys  →  WINDY_API_KEY=...
// Os URLs de imagem expiram, por isso a fonte é "volátil".
export default {
  id: 'windy',
  name: 'Windy Webcams (mundo)',
  city: 'Mundo',
  country: '—',
  volatile: true,
  enabled: (config) => Boolean(config.windyApiKey),
  async discover({ getJson, config }) {
    const headers = { 'x-windy-api-key': config.windyApiKey };
    const pages = [0, 50, 100, 150].map(async (offset) => {
      const url = `https://api.windy.com/webcams/api/v3/webcams?limit=50&offset=${offset}` +
        '&sortKey=popularity&sortDirection=desc&include=images,location';
      const data = await getJson(url, { headers });
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
