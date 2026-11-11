// Hong Kong — Transport Department traffic snapshots. Público, sem chave.
// Lista de localizações em XML; imagens em https://tdcctv.data.one.gov.hk/<key>.JPG
const LIST = 'https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml';

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : undefined;
};

export default {
  id: 'hongkong',
  name: 'Hong Kong Transport Department',
  city: 'Hong Kong',
  country: 'HK',
  async discover({ getText }) {
    const xml = await getText(LIST);
    const blocks = xml.match(/<image>[\s\S]*?<\/image>/g) || [];
    return blocks.flatMap((b) => {
      const key = tag(b, 'key');
      if (!key) return [];
      return [{
        rawId: key,
        name: tag(b, 'description') || key,
        city: tag(b, 'district') ? `${tag(b, 'district')}, Hong Kong` : 'Hong Kong',
        country: 'HK',
        lat: Number(tag(b, 'latitude')),
        lon: Number(tag(b, 'longitude')),
        imageUrl: tag(b, 'url') || `https://tdcctv.data.one.gov.hk/${key}.JPG`,
      }];
    });
  },
};
