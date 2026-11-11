// OpenStreetMap — webcams públicas mapeadas por voluntários, em qualquer país.
// Consulta a API Overpass à volta da localização (só na versão por localização).
// Muitas etiquetas apontam para uma página e não para uma imagem: essas aparecem
// como cartão com link em vez de imagem.
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const MAX_RADIUS_M = 100000; // pesquisas maiores são lentas para o Overpass
const IMAGE_RE = /\.(jpe?g|png|gif|webp)(\?|#|$)|\/(snapshot|image|webcam\.jpg|current)\b/i;
const KEYS = ['contact:webcam', 'webcam', 'url:webcam', 'image'];

export default {
  id: 'osm',
  name: 'OpenStreetMap (webcams)',
  city: '',
  country: '',
  requiresLocation: true,
  volatile: true, // depende do local escolhido
  async discover({ getJson, near }) {
    if (!near) throw new Error('precisa de localização');
    const r = Math.round(Math.min(MAX_RADIUS_M, near.radiusKm * 1000));
    const around = `(around:${r},${near.lat.toFixed(5)},${near.lon.toFixed(5)})`;
    const q = `[out:json][timeout:25];(` +
      `nwr${around}["contact:webcam"];nwr${around}["webcam"];nwr${around}["url:webcam"];` +
      `nwr${around}["surveillance"="webcam"];nwr${around}["surveillance:type"="webcam"];` +
      `);out center tags 300;`;
    let data;
    let lastErr;
    for (const base of MIRRORS) {
      try {
        data = await getJson(`${base}?data=${encodeURIComponent(q)}`);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data) throw lastErr || new Error('Overpass indisponível');
    return (data.elements || []).flatMap((el) => {
      const t = el.tags || {};
      const url = KEYS.map((k) => t[k]).find((u) => /^https?:\/\//i.test(u || ''));
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (!url || lat == null) return [];
      const isImage = IMAGE_RE.test(url);
      return [{
        rawId: `${el.type[0]}${el.id}`,
        name: t.name || t.description || t['name:pt'] || t.operator || 'Webcam',
        city: t['addr:city'] || t['is_in:city'] || '',
        country: (t['addr:country'] || '').toUpperCase(),
        lat,
        lon,
        imageUrl: isImage ? url : null,
        pageUrl: isImage ? null : url,
      }];
    });
  },
};
