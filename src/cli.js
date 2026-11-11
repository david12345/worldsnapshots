#!/usr/bin/env node
import { config } from './config.js';
import { discover } from './discovery.js';
import { buildStatic } from './build-static.js';
import { startServer } from './server.js';
import { runSync } from './sync.js';

const [cmd = 'serve', ...args] = process.argv.slice(2);

const usage = `Uso: worldsnapshots <comando>

  serve              Servidor web + sincronização automática (por omissão)
  discover           Pesquisa todas as fontes e atualiza o catálogo de câmaras
  sync [--reshuffle] Tira ${config.count} snapshots agora (--reshuffle escolhe novas câmaras)
  build-static       Gera dist/worldsnapshots.html — versão num só ficheiro, sem servidor
                     [--no-catalog] [--discover] [--out ficheiro.html]

Variáveis: PORT, SNAPSHOT_COUNT, SYNC_INTERVAL_MINUTES, MAX_RUNS, MAX_PER_PROVIDER,
           PROVIDERS (ex.: tfl,nyc), WINDY_API_KEY, DATA_DIR`;

try {
  if (cmd === 'discover') {
    console.log('A pesquisar fontes públicas de câmaras…');
    const cat = await discover();
    console.log(`Catálogo: ${cat.cameras.length} câmaras.`);
  } else if (cmd === 'sync') {
    await runSync({ reshuffle: args.includes('--reshuffle') });
  } else if (cmd === 'build-static') {
    const outIdx = args.indexOf('--out');
    await buildStatic({
      withCatalog: !args.includes('--no-catalog'),
      discoverFirst: args.includes('--discover'),
      out: outIdx >= 0 ? args[outIdx + 1] : undefined,
    });
  } else if (cmd === 'serve') {
    await startServer();
  } else {
    console.log(usage);
    process.exitCode = cmd === 'help' || cmd === '--help' ? 0 : 1;
  }
} catch (e) {
  console.error(`Erro: ${e.message}`);
  process.exitCode = 1;
}
