// Transport for London — JamCams (Londres, Reino Unido). Público, sem chave.
// https://api.tfl.gov.uk/Place/Type/JamCam
export default {
  id: 'tfl',
  name: 'Transport for London JamCams',
  city: 'Londres',
  country: 'GB',
  async discover({ getJson }) {
    const data = await getJson('https://api.tfl.gov.uk/Place/Type/JamCam');
    return data.flatMap((p) => {
      const props = Object.fromEntries((p.additionalProperties || []).map((a) => [a.key, a.value]));
      if (!props.imageUrl || props.available === 'false') return [];
      return [{
        rawId: p.id,
        name: p.commonName,
        city: 'Londres',
        country: 'GB',
        lat: p.lat,
        lon: p.lon,
        imageUrl: props.imageUrl,
      }];
    });
  },
};
