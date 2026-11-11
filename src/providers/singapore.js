// Singapura — LTA Traffic Images via data.gov.sg. Público, sem chave.
// Os URLs das imagens são temporários (assinados), por isso a fonte é "volátil":
// é redescoberta em cada sincronização.
export default {
  id: 'singapore',
  name: 'Singapore LTA Traffic Images',
  city: 'Singapura',
  country: 'SG',
  /** Zona coberta [minLat, minLon, maxLat, maxLon] — usada na pesquisa por localização. */
  bbox: [1.15, 103.6, 1.48, 104.1],
  volatile: true,
  signedUrls: true,
  async discover({ getJson }) {
    const data = await getJson('https://api.data.gov.sg/v1/transport/traffic-images');
    const cams = data?.items?.[0]?.cameras || [];
    return cams.map((c) => ({
      rawId: c.camera_id,
      name: `Câmara ${c.camera_id}`,
      city: 'Singapura',
      country: 'SG',
      lat: c.location?.latitude,
      lon: c.location?.longitude,
      imageUrl: c.image,
    }));
  },
};
