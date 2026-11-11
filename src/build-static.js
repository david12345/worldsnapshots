// Gera um ficheiro HTML único, sem servidor, a partir de static/template.html.
// Embute o código das fontes e da seleção (partilhado com a versão Node),
// os estilos e, opcionalmente, um catálogo de câmaras pré-descoberto.
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { builtinProviders } from './providers/index.js';
import { paths, readJson } from './store.js';

const src = (...p) => fs.readFile(path.join(config.root, ...p), 'utf8');
const PER_GROUP_LIMIT = 150;

/** Converte um módulo ESM simples (sem imports usados) em código de script clássico. */
function stripModule(code) {
  return code
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l) && !/^\s*export\s*\{/.test(l))
    .join('\n')
    .replace(/^export (function|const|async function)/gm, '$1');
}

/** Cada fonte fica isolada numa IIFE para as constantes internas não colidirem. */
function wrapProvider(id, code) {
  const body = stripModule(code).replace(/^export default \{/m, 'return {');
  if (!body.includes('return {')) throw new Error(`Fonte ${id}: não encontrei "export default {"`);
  return `const __P_${id} = (() => {\n${body}\n})();`;
}

export async function buildSharedCode() {
  const parts = [stripModule(await src('src/normalize.js')), stripModule(await src('src/select.js'))];
  for (const p of builtinProviders) parts.push(wrapProvider(p.id, await src('src/providers', `${p.id}.js`)));
  parts.push(`const PROVIDERS = [${builtinProviders.map((p) => `__P_${p.id}`).join(', ')}];`);
  return parts.join('\n\n');
}

/** Catálogo reduzido: só fontes com URLs estáveis, no máximo PER_GROUP_LIMIT por grupo. */
export function trimCatalog(catalog) {
  const volatile = new Set(builtinProviders.filter((p) => p.volatile).map((p) => p.id));
  const perGroup = new Map();
  const cameras = [];
  for (const c of catalog?.cameras || []) {
    if (volatile.has(c.provider)) continue;
    const n = perGroup.get(c.group) || 0;
    if (n >= PER_GROUP_LIMIT) continue;
    perGroup.set(c.group, n + 1);
    const { headers, ...rest } = c;
    cameras.push(rest);
  }
  return cameras.length ? { builtAt: catalog.updatedAt || new Date().toISOString(), cameras } : null;
}

export async function buildStatic({ withCatalog = true, discoverFirst = false, out, log = console.log } = {}) {
  let catalog = null;
  if (withCatalog) {
    catalog = await readJson(paths.catalog());
    if (!catalog || discoverFirst) {
      const { discover } = await import('./discovery.js');
      log('A pesquisar fontes para embutir o catálogo…');
      catalog = await discover({ log });
    }
  }
  const embedded = withCatalog ? trimCatalog(catalog) : null;
  const shared = await buildSharedCode();
  if (/<\/script/i.test(shared)) throw new Error('O código partilhado contém "</script" — não pode ser embutido.');

  // JSON seguro dentro de <script>: escapa "<" para nunca fechar a tag.
  const catalogJson = JSON.stringify(embedded).replace(/</g, '\\u003c');
  const style = await src('public/style.css');
  const finalHtml = (await src('static/template.html'))
    .replace('/*__STYLE__*/', () => style)
    .replace('/*__SHARED__*/', () => shared)
    .replace('/*__CATALOG__*/', () => catalogJson);

  const file = out || path.join(config.root, 'dist', 'worldsnapshots.html');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, finalHtml);
  log(`✓ ${path.relative(process.cwd(), file)} (${(finalHtml.length / 1024).toFixed(0)} KB, ` +
    `${embedded ? `${embedded.cameras.length} câmaras embutidas` : 'sem catálogo embutido — só fontes com CORS'})`);
  return file;
}
