// Normaliza as câmaras de uma fonte para o formato do catálogo.
// Módulo puro (sem Node): também é embutido na versão HTML sem servidor.
const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

export function normalize(provider, raw) {
  return raw
    .filter((c) => c && c.rawId != null && isHttp(c.imageUrl))
    .map((c) => ({
      id: `${provider.id}:${c.rawId}`,
      provider: provider.id,
      providerName: provider.name,
      group: c.group || provider.id,
      name: String(c.name ?? c.rawId).trim(),
      city: c.city || provider.city || '',
      country: c.country || provider.country || '',
      lat: Number.isFinite(c.lat) ? c.lat : null,
      lon: Number.isFinite(c.lon) ? c.lon : null,
      imageUrl: c.imageUrl,
      ...(c.headers ? { headers: c.headers } : {}),
    }));
}
