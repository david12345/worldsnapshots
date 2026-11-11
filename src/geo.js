// Geometria simples (módulo puro: também embutido na versão sem servidor).
const R_EARTH_KM = 6371.0088;
const rad = (d) => (d * Math.PI) / 180;

/** Distância em km entre dois pontos (fórmula de haversine). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rumo inicial em graus (0 = norte, 90 = este). */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function compass(deg) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(deg / 45) % 8];
}

/** Distância (km) de um ponto ao retângulo [minLat, minLon, maxLat, maxLon]; 0 se estiver dentro. */
export function distanceToBboxKm(lat, lon, bbox) {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  const cLat = Math.min(Math.max(lat, minLat), maxLat);
  const cLon = Math.min(Math.max(lon, minLon), maxLon);
  return distanceKm(lat, lon, cLat, cLon);
}

/** Uma fonte cobre a zona se não tiver bbox (global) ou se o círculo tocar na bbox. */
export function providerCovers(provider, lat, lon, radiusKm) {
  return !provider.bbox || distanceToBboxKm(lat, lon, provider.bbox) <= radiusKm;
}

/** Câmaras dentro do raio, ordenadas pela distância (acrescenta distanceKm e bearing). */
export function camerasNear(cameras, lat, lon, radiusKm) {
  const out = [];
  for (const c of cameras) {
    if (c.lat == null || c.lon == null) continue;
    const d = distanceKm(lat, lon, c.lat, c.lon);
    if (d <= radiusKm) out.push({ ...c, distanceKm: d, bearing: bearingDeg(lat, lon, c.lat, c.lon) });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}

/** A câmara mais próxima (fora do raio), para sugerir até onde aumentar. */
export function nearestCamera(cameras, lat, lon) {
  let best = null;
  for (const c of cameras) {
    if (c.lat == null || c.lon == null) continue;
    const d = distanceKm(lat, lon, c.lat, c.lon);
    if (!best || d < best.distanceKm) best = { ...c, distanceKm: d };
  }
  return best;
}
