// Fontes adicionais definidas em sources.json (sem escrever código).
// Qualquer API JSON pública que devolva uma lista de câmaras pode ser ligada
// indicando onde está a lista (itemsPath) e como mapear os campos.
import fs from 'node:fs/promises';
import path from 'node:path';

export const getPath = (obj, p) =>
  !p ? obj : String(p).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const fill = (tpl, item) => tpl.replace(/\{([^}]+)\}/g, (_, k) => encodeURIComponent(getPath(item, k) ?? ''));

export function makeCustomProvider(def) {
  const f = def.fields || {};
  return {
    id: def.id,
    name: def.name || def.id,
    city: def.city || '',
    country: def.country || '',
    volatile: Boolean(def.volatile),
    async discover({ getJson }) {
      const data = await getJson(def.url, { headers: def.headers || {} });
      const items = getPath(data, def.itemsPath) || [];
      if (!Array.isArray(items)) throw new Error(`itemsPath "${def.itemsPath}" não aponta para uma lista`);
      return items.flatMap((it) => {
        const imageUrl = def.imageTemplate ? fill(def.imageTemplate, it) : getPath(it, f.imageUrl);
        const rawId = getPath(it, f.id);
        if (!imageUrl || rawId == null) return [];
        return [{
          rawId,
          name: getPath(it, f.name) ?? String(rawId),
          city: getPath(it, f.city) ?? def.city ?? '',
          country: getPath(it, f.country) ?? def.country ?? '',
          lat: Number(getPath(it, f.lat)),
          lon: Number(getPath(it, f.lon)),
          imageUrl,
          headers: def.imageHeaders,
        }];
      });
    },
  };
}

export async function loadCustomProviders(config) {
  const file = path.join(config.root, 'sources.json');
  let defs;
  try {
    defs = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    console.warn(`[sources.json] ignorado: ${e.message}`);
    return [];
  }
  return (Array.isArray(defs) ? defs : []).filter((d) => d.id && d.url && d.enabled !== false).map(makeCustomProvider);
}
