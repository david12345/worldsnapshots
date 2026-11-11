#!/usr/bin/env node
import { config } from './config.js';
import { discover } from './discovery.js';
import { startServer } from './server.js';
import { runSync } from './sync.js';

const [cmd = 'serve', ...args] = process.argv.slice(2);

const usage = `Uso: worldsnapshots <comando>

  serve              Servidor web + sincronização automática (por omissão)
  discover           Pesquisa todas as fontes e atualiza o catálogo de câmaras
  sync [--reshuffle] Tira ${config.count} snapshots agora (--reshuffle escolhe novas câmaras)

Variáveis: PORT, SNAPSHOT_COUNT, SYNC_INTERVAL_MINUTES, MAX_RUNS, MAX_PER_PROVIDER,
           PROVIDERS (ex.: tfl,nyc), WINDY_API_KEY, DATA_DIR`;

try {
  if (cmd === 'discover') {
    console.log('A pesquisar fontes públicas de câmaras…');
    const cat = await discover();
    console.log(`Catálogo: ${cat.cameras.length} câmaras.`);
  } else if (cmd === 'sync') {
    await runSync({ reshuffle: args.includes('--reshuffle') });
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
