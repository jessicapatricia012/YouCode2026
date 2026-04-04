/** Great-circle distance in kilometres (WGS84 sphere approximation). */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * GeoJSON Polygon approximating a geodesic circle (km) around [lat, lng].
 * Ring is closed; positions are [lng, lat] per GeoJSON.
 */
export function geodesicCircleFeature(lat, lng, radiusKm, steps = 96) {
  const R = 6371;
  const angular = radiusKm / R;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const ring = [];
  for (let i = 0; i <= steps; i += 1) {
    const θ = (i / steps) * 2 * Math.PI;
    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(angular) +
        Math.cos(φ1) * Math.sin(angular) * Math.cos(θ)
    );
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(θ) * Math.sin(angular) * Math.cos(φ1),
        Math.cos(angular) - Math.sin(φ1) * Math.sin(φ2)
      );
    ring.push([(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
}
