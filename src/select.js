// Seleção de câmaras: mantém as mesmas câmaras entre sincronizações (para se
// poder comparar ao longo do tempo) e distribui-as por várias fontes/cidades.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Devolve TODAS as câmaras do catálogo ordenadas por prioridade:
 *  1. as da seleção anterior (ainda existentes), pela mesma ordem;
 *  2. as restantes em round-robin entre grupos, respeitando maxPerGroup;
 *  3. o resto (para substituir câmaras que falhem).
 * Quem chama usa as primeiras N que funcionarem.
 */
export function rankCandidates(cameras, { previousIds = [], maxPerGroup = 8, rng = Math.random } = {}) {
  const byId = new Map(cameras.map((c) => [c.id, c]));
  const used = new Set();
  const counts = new Map();
  const out = [];
  const take = (c) => {
    used.add(c.id);
    counts.set(c.group, (counts.get(c.group) || 0) + 1);
    out.push(c);
  };

  for (const id of previousIds) {
    const c = byId.get(id);
    if (c && !used.has(id)) take(c);
  }

  const groups = new Map();
  for (const c of shuffle(cameras, rng)) {
    if (used.has(c.id)) continue;
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  const queues = shuffle([...groups.values()], rng);

  const overflow = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const q of queues) {
      const c = q.shift();
      if (!c) continue;
      progressed = true;
      if ((counts.get(c.group) || 0) < maxPerGroup) take(c);
      else overflow.push(c);
    }
  }
  for (const c of overflow) take(c);
  return out;
}
