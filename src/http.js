import { config } from './config.js';

async function request(url, { headers = {}, timeoutMs = config.timeoutMs } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': config.userAgent, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res;
}

export async function getJson(url, opts) {
  return (await request(url, opts)).json();
}

export async function getText(url, opts) {
  return (await request(url, opts)).text();
}

/** Descarrega uma imagem e garante que é mesmo uma imagem (não uma página de erro). */
export async function getImage(url, opts) {
  const res = await request(url, opts);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) throw new Error(`Resposta não é imagem (${type || 'sem content-type'}, ${buf.length} bytes)`);
  if (buf.length < 1500) throw new Error(`Imagem demasiado pequena (${buf.length} bytes) — provável placeholder`);
  return { buf, ext };
}

export function sniffImage(buf) {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'gif';
  return null;
}

/** Executa tarefas com concorrência limitada. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = { ok: true, value: await fn(items[idx], idx) };
      } catch (error) {
        out[idx] = { ok: false, error };
      }
    }
  });
  await Promise.all(workers);
  return out;
}
