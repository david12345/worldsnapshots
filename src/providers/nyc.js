// Nova Iorque — NYC DOT Traffic Management Center. Público, sem chave.
// https://webcams.nyctmc.org/api/cameras
export default {
  id: 'nyc',
  name: 'NYC DOT Traffic Cameras',
  city: 'Nova Iorque',
  country: 'US',
  /** O servidor não permite leitura direta pelo browser (sem CORS). */
  cors: false,
  /** Zona coberta [minLat, minLon, maxLat, maxLon] — usada na pesquisa por localização. */
  bbox: [40.48, -74.27, 40.93, -73.68],
  async discover({ getJson }) {
    const data = await getJson('https://webcams.nyctmc.org/api/cameras');
    return data
      .filter((c) => String(c.isOnline) !== 'false')
      .map((c) => ({
        rawId: c.id,
        name: c.name,
        city: 'Nova Iorque',
        country: 'US',
        lat: Number(c.latitude),
        lon: Number(c.longitude),
        imageUrl: c.imageUrl || `https://webcams.nyctmc.org/api/cameras/${c.id}/image`,
      }));
  },
};
