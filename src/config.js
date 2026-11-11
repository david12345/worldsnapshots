import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  root,
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  publicDir: path.join(root, 'public'),
  port: num(process.env.PORT, 3000),
  /** Quantas câmaras mostrar por snapshot. */
  count: num(process.env.SNAPSHOT_COUNT, 50),
  /** Intervalo de sincronização automática em minutos (0 = desligado). */
  syncIntervalMin: num(process.env.SYNC_INTERVAL_MINUTES, 15),
  /** Quantas sincronizações guardar no histórico. */
  maxRuns: num(process.env.MAX_RUNS, 96),
  /** Idade máxima do catálogo de câmaras antes de nova descoberta (horas). */
  catalogMaxAgeHours: num(process.env.CATALOG_MAX_AGE_HOURS, 24),
  /** Máximo de câmaras por fonte na seleção (diversidade geográfica). */
  maxPerProvider: num(process.env.MAX_PER_PROVIDER, 8),
  concurrency: num(process.env.CONCURRENCY, 8),
  timeoutMs: num(process.env.HTTP_TIMEOUT_MS, 20000),
  windyApiKey: process.env.WINDY_API_KEY || '',
  ontario511Key: process.env.ONTARIO_511_KEY || '',
  /** Lista separada por vírgulas de fontes a usar (vazio = todas). */
  providers: (process.env.PROVIDERS || '').split(',').map((s) => s.trim()).filter(Boolean),
  userAgent: process.env.USER_AGENT || 'worldsnapshots/0.1 (+https://github.com/)',
};
