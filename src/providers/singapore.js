// Singapura — LTA Traffic Images via data.gov.sg. Público, sem chave.
// Os URLs das imagens são temporários (assinados), por isso a fonte é "volátil":
// é redescoberta em cada sincronização.
export default {
  id: 'singapore',
  name: 'Singapore LTA Traffic Images',
  city: 'Singapura',
  country: 'SG',
  volatile: true,
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
