/**
 * Geocoding: Mapbox when MAPBOX_TOKEN is set, else OpenStreetMap Nominatim (free),
 * then optional BC city centroid for known municipalities.
 */

const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ||
  'ConnectBC/1.0 (nonprofit events map; contact via site operator)';

/** Approximate downtown / civic coordinates for BC places (fallback only). */
const BC_CITY_CENTROIDS = new Map(
  Object.entries({
    vancouver: { lat: 49.2827, lng: -123.1207 },
    burnaby: { lat: 49.2488, lng: -122.9805 },
    victoria: { lat: 48.4284, lng: -123.3656 },
    kelowna: { lat: 49.888, lng: -119.496 },
    surrey: { lat: 49.1913, lng: -122.849 },
    richmond: { lat: 49.1666, lng: -123.1336 },
    abbotsford: { lat: 49.0504, lng: -122.3045 },
    coquitlam: { lat: 49.2838, lng: -122.7932 },
    saanich: { lat: 48.5965, lng: -123.4006 },
    kamloops: { lat: 50.6745, lng: -120.3273 },
    nanaimo: { lat: 49.1659, lng: -123.9401 },
    'prince george': { lat: 53.9171, lng: -122.7497 },
    terrace: { lat: 54.5153, lng: -128.6034 },
    'fort st. john': { lat: 56.2524, lng: -120.8473 },
    'fort st john': { lat: 56.2524, lng: -120.8473 },
    cranbrook: { lat: 49.5129, lng: -115.7694 },
    nelson: { lat: 49.4928, lng: -117.2942 },
    penticton: { lat: 49.4991, lng: -119.5937 },
    whistler: { lat: 50.1163, lng: -122.9574 },
    squamish: { lat: 49.7016, lng: -123.1558 },
    duncan: { lat: 48.7787, lng: -123.7079 },
    chilliwack: { lat: 49.1579, lng: -121.9506 },
    'maple ridge': { lat: 49.2194, lng: -122.6015 },
    langley: { lat: 49.1044, lng: -122.6606 },
    mission: { lat: 49.1328, lng: -122.302 },
    'campbell river': { lat: 50.0126, lng: -125.2445 },
    'powell river': { lat: 49.8352, lng: -124.5247 },
    'prince rupert': { lat: 54.3156, lng: -130.3209 },
    'williams lake': { lat: 52.1293, lng: -122.1384 },
    quesnel: { lat: 52.9784, lng: -122.4928 },
    revelstoke: { lat: 50.9981, lng: -118.1957 },
    'new westminster': { lat: 49.2057, lng: -122.911 },
    'west vancouver': { lat: 49.3288, lng: -123.1417 },
    'north vancouver': { lat: 49.3202, lng: -123.0724 },
    delta: { lat: 49.0846, lng: -123.0587 },
    'white rock': { lat: 49.0253, lng: -122.8029 },
    'port moody': { lat: 49.283, lng: -122.867 },
    vernon: { lat: 50.267, lng: -119.272 },
    courtenay: { lat: 49.6878, lng: -124.9946 },
    parksville: { lat: 49.3195, lng: -124.3158 },
    'port alberni': { lat: 49.2339, lng: -124.805 },
    kitimat: { lat: 54.0527, lng: -128.6534 },
  })
);

function normalizeCityKey(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '');
}

export function cityCentroidBc(cityName) {
  const k = normalizeCityKey(cityName);
  if (!k) return null;
  if (BC_CITY_CENTROIDS.has(k)) return BC_CITY_CENTROIDS.get(k);
  const noCity = k.replace(/\s+city$/, '').trim();
  if (noCity !== k && BC_CITY_CENTROIDS.has(noCity)) return BC_CITY_CENTROIDS.get(noCity);
  return null;
}

export function buildGeocodeQuery(street, city) {
  const s = String(street || '').trim();
  const c = String(city || '').trim();
  if (!s) return '';
  if (c) return `${s}, ${c}, BC, Canada`;
  return `${s}, BC, Canada`;
}

async function geocodeMapbox(query) {
  const token = process.env.MAPBOX_TOKEN?.trim();
  if (!token || token === 'your_token_here') return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature?.center) return null;
    const [lng, lat] = feature.center;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Nominatim (OSM). Be polite: one request per user action; custom User-Agent required.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
async function nominatimSearch(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?' +
      new URLSearchParams({
        q,
        format: 'json',
        limit: '1',
        countrycodes: 'ca',
        addressdetails: '1',
      });
    const res = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_UA },
    });
    if (!res.ok) return null;
    const arr = await res.json();
    const row = arr?.[0];
    if (!row?.lat || !row?.lon) return null;
    const lat = parseFloat(row.lat);
    const lng = parseFloat(row.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng, address: row.address, raw: row };
  } catch {
    return null;
  }
}

function cityFromNominatimAddress(addr) {
  if (!addr || typeof addr !== 'object') return null;
  const name =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.hamlet ||
    addr.suburb ||
    addr.county;
  return name ? String(name).trim() : null;
}

/**
 * Forward geocode a query string: Mapbox first, then Nominatim.
 */
export async function geocodeAddress(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const m = await geocodeMapbox(q);
  if (m) return m;
  const n = await nominatimSearch(q);
  return n ? { lat: n.lat, lng: n.lng } : null;
}

/**
 * Street + BC city: full query, then city-only query, then known city centroid.
 */
export async function geocodeStreetAndCity(street, city) {
  const q = buildGeocodeQuery(street, city);
  if (!q) return null;

  const m = await geocodeMapbox(q);
  if (m) return m;

  let n = await nominatimSearch(q);
  if (n) return { lat: n.lat, lng: n.lng };

  const c = String(city || '').trim();
  if (c) {
    n = await nominatimSearch(`${c}, BC, Canada`);
    if (n) return { lat: n.lat, lng: n.lng };

    const centroid = cityCentroidBc(c);
    if (centroid) return { ...centroid };
  }

  return null;
}

export function cityFromMapboxFeature(feature) {
  const ctx = feature?.context;
  if (!Array.isArray(ctx)) return null;
  const locality = ctx.find((x) => x.id?.startsWith('locality.'));
  const place = ctx.find((x) => x.id?.startsWith('place.'));
  const district = ctx.find((x) => x.id?.startsWith('district.'));
  const name = (locality || place || district)?.text;
  return name ? String(name).trim() : null;
}

/**
 * Suggest city from a street line: Mapbox if configured, else Nominatim.
 */
export async function suggestCityForStreetLine(line) {
  const raw = String(line || '').trim();
  if (raw.length < 3) return null;

  const token = process.env.MAPBOX_TOKEN?.trim();
  if (token && token !== 'your_token_here') {
    const q = buildGeocodeQuery(raw, '');
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=1&access_token=${token}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const feature = data.features?.[0];
        const city = feature ? cityFromMapboxFeature(feature) : null;
        if (city) return city;
      }
    } catch {
      /* fall through */
    }
  }

  const q = buildGeocodeQuery(raw, '');
  const n = await nominatimSearch(q);
  const fromAddr = cityFromNominatimAddress(n?.address);
  if (fromAddr) return fromAddr;

  return null;
}
