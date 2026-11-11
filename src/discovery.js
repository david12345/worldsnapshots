// Descoberta: percorre as fontes públicas conhecidas e constrói um catálogo
// unificado de câmaras (data/catalog.json).
import { config } from './config.js';
import { getJson, getText } from './http.js';
import { getProviders } from './providers/index.js';
import { paths, readJson, writeJson } from './store.js';
import { normalize } from './normalize.js';

export { normalize };

/**
 * @param {object} opts
 * @param {(p:any)=>boolean} [opts.filter] limitar a algumas fontes (ex.: só as voláteis)
 * @param {boolean} [opts.full] true = descoberta completa (renova a idade do catálogo)
 * @param {object} [opts.ctx] injeção de dependências HTTP (testes)
 */
export async function discover({ filter = () => true, full = true, ctx, log = console.log } = {}) {
  const providers = (await getProviders(config)).filter(filter);
  const prev = (await readJson(paths.catalog())) || { providers: {}, cameras: [] };
  const http = ctx || { getJson, getText, config };

  const results = await Promise.all(providers.map(async (p) => {
    const t0 = Date.now();
    try {
      const cams = normalize(p, await p.discover(http));
      log(`  ✓ ${p.id.padEnd(12)} ${String(cams.length).padStart(5)} câmaras (${Date.now() - t0} ms)`);
      return { p, cams };
    } catch (error) {
      log(`  ✗ ${p.id.padEnd(12)} falhou: ${error.message}`);
      return { p, error };
    }
  }));

  const now = new Date().toISOString();
  const touched = new Set(results.filter((r) => !r.error).map((r) => r.p.id));
  // Mantém as câmaras de fontes não atualizadas (ou que falharam) do catálogo anterior.
  const cameras = prev.cameras.filter((c) => !touched.has(c.provider));
  const providerInfo = { ...prev.providers };
  for (const r of results) {
    if (r.error) {
      providerInfo[r.p.id] = { ...providerInfo[r.p.id], name: r.p.name, ok: false, error: r.error.message, checkedAt: now };
    } else {
      cameras.push(...r.cams);
      providerInfo[r.p.id] = { name: r.p.name, ok: true, count: r.cams.length, volatile: Boolean(r.p.volatile), updatedAt: now, checkedAt: now };
    }
  }
  // updatedAt marca a última descoberta completa (controla a idade do catálogo).
  const catalog = { updatedAt: full ? now : prev.updatedAt || now, providers: providerInfo, cameras };
  await writeJson(paths.catalog(), catalog);
  return catalog;
}

/** Garante um catálogo atual: descoberta completa se for velho; senão só as fontes voláteis ou com erro. */
export async function ensureCatalog({ ctx, log = console.log } = {}) {
  const catalog = await readJson(paths.catalog());
  const ageH = catalog ? (Date.now() - Date.parse(catalog.updatedAt)) / 36e5 : Infinity;
  if (!catalog || !catalog.cameras.length || ageH > config.catalogMaxAgeHours) {
    log('A descobrir câmaras em todas as fontes…');
    return discover({ ctx, log });
  }
  log('A atualizar fontes voláteis e as que falharam…');
  return discover({ ctx, log, full: false, filter: (p) => p.volatile || !catalog.providers[p.id]?.ok });
}
