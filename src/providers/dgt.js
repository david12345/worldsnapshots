// Espanha — DGT (Dirección General de Tráfico), ~2000 câmaras de estrada.
// Ponto de Acesso Nacional, DATEX II v3.7. Público, sem chave.
// Nota: o servidor não envia cabeçalhos CORS; no browser usa-se o catálogo embutido.
const LIST = 'https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml';

const field = (xml, name) => {
  const m = xml.match(new RegExp(`<[\\w]+:${name}>([^<]*)</[\\w]+:${name}>`));
  return m ? m[1].trim() : undefined;
};
const title = (s) => (s || '').toLowerCase().replace(/(^|[\s(/-])\S/g, (c) => c.toUpperCase());

export default {
  id: 'dgt',
  name: 'DGT Espanha',
  city: 'Espanha',
  country: 'ES',
  bbox: [27.6, -18.2, 43.8, 4.4],
  /** O servidor não permite leitura direta pelo browser (sem CORS). */
  cors: false,
  async discover({ getText }) {
    const xml = await getText(LIST);
    const blocks = xml.match(/<[\w]+:device\b[\s\S]*?<\/[\w]+:device>/g) || [];
    return blocks.flatMap((b) => {
      const url = field(b, 'deviceUrl');
      const id = b.match(/\bid="([^"]+)"/)?.[1];
      if (!url || !id || (field(b, 'typeOfDevice') && field(b, 'typeOfDevice') !== 'camera')) return [];
      const road = field(b, 'roadName');
      const km = field(b, 'kilometerPoint');
      const dest = field(b, 'roadDestination');
      return [{
        rawId: id,
        name: [road, km && `km ${km}`, dest && `→ ${title(dest)}`].filter(Boolean).join(' ') || `Câmara ${id}`,
        city: title(field(b, 'province')) || 'Espanha',
        country: 'ES',
        lat: Number(field(b, 'latitude')),
        lon: Number(field(b, 'longitude')),
        imageUrl: url,
      }];
    });
  },
};
