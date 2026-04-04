import { pool } from '../db.js';
import { geocodeStreetAndCity } from './geocode.js';

const ALLOWED_TYPES = new Set([
  'volunteer',
  'community',
  'donation_drive',
  'job',
  'fundraiser',
]);

export function parseTypesQuery(raw) {
  if (raw == null || raw === '') return null;
  const parts = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

function mapRow(row) {
  const spotsLeft = row.spots_total - row.spots_taken;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    orgName: row.org_name,
    type: row.type,
    address: row.address,
    city: row.city ?? null,
    websiteUrl: row.website_url ?? null,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    spotsLeft: Math.max(0, spotsLeft),
    spotsTotal: row.spots_total,
    spotsTaken: row.spots_taken,
  };
}

export async function listEventsFromDb(typesFilter) {
  let sql = `
    SELECT
      e.id,
      e.title,
      e.description,
      e.type,
      e.address,
      e.city,
      e.website_url,
      e.starts_at,
      e.ends_at,
      e.spots_total,
      e.spots_taken,
      o.name AS org_name,
      ST_Y(e.location::geometry) AS lat,
      ST_X(e.location::geometry) AS lng
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    WHERE e.is_active = true
  `;
  const params = [];
  if (typesFilter?.length) {
    const allowed = typesFilter.filter((t) => ALLOWED_TYPES.has(t));
    if (allowed.length > 0) {
      params.push(allowed);
      sql += ` AND e.type = ANY($1::event_type[])`;
    }
  }
  sql += ` ORDER BY e.starts_at ASC`;
  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function getEventByIdFromDb(id) {
  const { rows } = await pool.query(
    `
    SELECT
      e.id,
      e.title,
      e.description,
      e.type,
      e.address,
      e.city,
      e.website_url,
      e.starts_at,
      e.ends_at,
      e.spots_total,
      e.spots_taken,
      o.name AS org_name,
      ST_Y(e.location::geometry) AS lat,
      ST_X(e.location::geometry) AS lng
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    WHERE e.id = $1 AND e.is_active = true
    `,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Organizer's event by id (includes inactive). */
export async function getOrgEventByIdFromDb(eventId, orgId) {
  const { rows } = await pool.query(
    `
    SELECT
      e.id,
      e.title,
      e.description,
      e.type,
      e.address,
      e.city,
      e.website_url,
      e.starts_at,
      e.ends_at,
      e.spots_total,
      e.spots_taken,
      e.is_active,
      o.name AS org_name,
      ST_Y(e.location::geometry) AS lat,
      ST_X(e.location::geometry) AS lng
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    WHERE e.id = $1 AND e.org_id = $2
    `,
    [eventId, orgId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return { ...mapRow(r), isActive: r.is_active };
}

function mapOrgEventRow(row) {
  const spotsLeft = row.spots_total - row.spots_taken;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    orgName: row.org_name,
    type: row.type,
    address: row.address,
    city: row.city ?? null,
    websiteUrl: row.website_url ?? null,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    spotsLeft: Math.max(0, spotsLeft),
    spotsTotal: row.spots_total,
    spotsTaken: row.spots_taken,
    isActive: row.is_active,
    signupCount: Number(row.signup_count ?? 0),
  };
}

/** All events for an org (including inactive), with signup counts */
export async function listOrgEventsFromDb(orgId) {
  const { rows } = await pool.query(
    `
    SELECT
      e.id,
      e.title,
      e.description,
      e.type,
      e.address,
      e.city,
      e.website_url,
      e.starts_at,
      e.ends_at,
      e.spots_total,
      e.spots_taken,
      e.is_active,
      o.name AS org_name,
      ST_Y(e.location::geometry) AS lat,
      ST_X(e.location::geometry) AS lng,
      (SELECT COUNT(*)::int FROM signups s WHERE s.event_id = e.id) AS signup_count
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    WHERE e.org_id = $1
    ORDER BY e.starts_at DESC
    `,
    [orgId]
  );
  return rows.map(mapOrgEventRow);
}

function validationError(message) {
  const e = new Error(message);
  e.code = 'validation';
  return e;
}

/** Empty → null; otherwise normalized http(s) URL string. */
function parseOptionalEventWebsiteUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let href = s;
  if (!/^https?:\/\//i.test(href)) {
    href = `https://${href}`;
  }
  let u;
  try {
    u = new URL(href);
  } catch {
    throw validationError('Enter a valid event website URL, or leave it blank.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw validationError('Only http and https links are allowed.');
  }
  if (u.href.length > 2048) {
    throw validationError('URL is too long.');
  }
  return u.href;
}

export async function createEventForOrg(orgId, body) {
  const title = String(body?.title ?? '').trim();
  const type = String(body?.type ?? '').trim();
  const description = String(body?.description ?? '').trim() || null;
  const address = String(body?.address ?? '').trim();
  const city = String(body?.city ?? '').trim();
  const startsRaw = body?.startsAt ?? body?.starts_at;
  const endsRaw = body?.endsAt ?? body?.ends_at;

  if (!title) throw validationError('Title is required.');
  if (!ALLOWED_TYPES.has(type)) throw validationError('Invalid event type.');
  if (!address) throw validationError('Street address is required.');
  if (!city) throw validationError('City is required.');

  const start = new Date(startsRaw);
  if (!startsRaw || Number.isNaN(start.getTime())) {
    throw validationError('Start date and time are required.');
  }

  let endsAtSql = null;
  if (endsRaw != null && String(endsRaw).trim() !== '') {
    const end = new Date(endsRaw);
    if (Number.isNaN(end.getTime())) {
      throw validationError('End date and time are invalid.');
    }
    if (end < start) {
      throw validationError('End must be on or after the start time.');
    }
    endsAtSql = end.toISOString();
  }

  let spotsTotal = 50;
  const spotsRaw = body?.spotsTotal ?? body?.spots_total;
  if (spotsRaw != null && spotsRaw !== '') {
    const n = Number(spotsRaw);
    if (!Number.isInteger(n) || n < 0) {
      throw validationError('Spots must be a whole number zero or greater.');
    }
    spotsTotal = n;
  }

  const geo = await geocodeStreetAndCity(address, city);
  if (!geo) {
    const e = new Error(
      'Could not place that location on the map. Check the street and city, or try a nearby larger town. If it keeps failing, verify network access or set MAPBOX_TOKEN for Mapbox geocoding.'
    );
    e.code = 'geocode_failed';
    throw e;
  }

  const websiteUrl = parseOptionalEventWebsiteUrl(
    body?.websiteUrl ?? body?.website_url
  );

  const { rows } = await pool.query(
    `
    INSERT INTO events (
      org_id, title, description, type, address, city, location,
      starts_at, ends_at, spots_total, spots_taken, is_active, website_url
    ) VALUES (
      $1, $2, $3, $4::event_type, $5, $6,
      ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
      $9, $10, $11, 0, true, $12
    )
    RETURNING id
    `,
    [
      orgId,
      title,
      description,
      type,
      address,
      city,
      geo.lng,
      geo.lat,
      start.toISOString(),
      endsAtSql,
      spotsTotal,
      websiteUrl,
    ]
  );
  const id = rows[0].id;
  return getEventByIdFromDb(id);
}

export async function deleteEventByOrg(eventId, orgId) {
  const { rowCount } = await pool.query(
    'DELETE FROM events WHERE id = $1 AND org_id = $2',
    [eventId, orgId]
  );
  return { deleted: rowCount > 0 };
}

export async function updateEventByOrg(eventId, orgId, body) {
  const { rows: existingRows } = await pool.query(
    `
    SELECT address, city, spots_taken, spots_total, website_url,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng
    FROM events
    WHERE id = $1 AND org_id = $2
    `,
    [eventId, orgId]
  );
  if (!existingRows[0]) {
    const e = new Error('Not found');
    e.code = 'not_found';
    throw e;
  }
  const ex = existingRows[0];

  const title = String(body?.title ?? '').trim();
  const type = String(body?.type ?? '').trim();
  const description = String(body?.description ?? '').trim() || null;
  const address = String(body?.address ?? '').trim();
  const city = String(body?.city ?? '').trim();
  const startsRaw = body?.startsAt ?? body?.starts_at;
  const endsRaw = body?.endsAt ?? body?.ends_at;

  if (!title) throw validationError('Title is required.');
  if (!ALLOWED_TYPES.has(type)) throw validationError('Invalid event type.');
  if (!address) throw validationError('Street address is required.');
  if (!city) throw validationError('City is required.');

  const start = new Date(startsRaw);
  if (!startsRaw || Number.isNaN(start.getTime())) {
    throw validationError('Start date and time are required.');
  }

  let endsAtSql = null;
  if (endsRaw != null && String(endsRaw).trim() !== '') {
    const end = new Date(endsRaw);
    if (Number.isNaN(end.getTime())) {
      throw validationError('End date and time are invalid.');
    }
    if (end < start) {
      throw validationError('End must be on or after the start time.');
    }
    endsAtSql = end.toISOString();
  }

  let spotsTotal = Number(ex.spots_total);
  const spotsRaw = body?.spotsTotal ?? body?.spots_total;
  if (spotsRaw != null && spotsRaw !== '') {
    const n = Number(spotsRaw);
    if (!Number.isInteger(n) || n < 0) {
      throw validationError('Spots must be a whole number zero or greater.');
    }
    spotsTotal = n;
  }

  const taken = Number(ex.spots_taken);
  if (spotsTotal < taken) {
    throw validationError(
      `Total spots must be at least ${taken} (that many people have already signed up).`
    );
  }

  let lng = Number(ex.lng);
  let lat = Number(ex.lat);
  const prevAddr = String(ex.address ?? '').trim();
  const prevCity = String(ex.city ?? '').trim();
  if (address !== prevAddr || city !== prevCity) {
    const geo = await geocodeStreetAndCity(address, city);
    if (!geo) {
      const err = new Error(
        'Could not place that location on the map. Check the street and city, or try a nearby larger town. If it keeps failing, verify network access or set MAPBOX_TOKEN for Mapbox geocoding.'
      );
      err.code = 'geocode_failed';
      throw err;
    }
    lng = geo.lng;
    lat = geo.lat;
  }

  const bodyObj = body ?? {};
  const websiteUrl =
    'websiteUrl' in bodyObj || 'website_url' in bodyObj
      ? parseOptionalEventWebsiteUrl(bodyObj.websiteUrl ?? bodyObj.website_url)
      : ex.website_url;

  await pool.query(
    `
    UPDATE events SET
      title = $1,
      description = $2,
      type = $3::event_type,
      address = $4,
      city = $5,
      location = ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
      starts_at = $8,
      ends_at = $9,
      spots_total = $10,
      website_url = $11
    WHERE id = $12 AND org_id = $13
    `,
    [
      title,
      description,
      type,
      address,
      city,
      lng,
      lat,
      start.toISOString(),
      endsAtSql,
      spotsTotal,
      websiteUrl,
      eventId,
      orgId,
    ]
  );

  return getOrgEventByIdFromDb(eventId, orgId);
}

/**
 * Signups for an event. Returns null if the org does not own the event.
 */
export async function listSignupsForOrgEvent(eventId, orgId) {
  const own = await pool.query(
    'SELECT 1 FROM events WHERE id = $1 AND org_id = $2',
    [eventId, orgId]
  );
  if (!own.rowCount) return null;

  const { rows } = await pool.query(
    `
    SELECT id, name, email, signed_up_at
    FROM signups
    WHERE event_id = $1
    ORDER BY signed_up_at ASC
    `,
    [eventId]
  );

  const signups = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    signedUpAt: row.signed_up_at,
  }));

  return { signups, total: signups.length };
}

export async function createSignupForEvent(eventId, { name, email }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE events
       SET spots_taken = spots_taken + 1
       WHERE id = $1
         AND is_active = true
         AND spots_taken < spots_total
       RETURNING spots_total, spots_taken`,
      [eventId]
    );
    if (upd.rowCount === 0) {
      await client.query('ROLLBACK');
      const ex = await client.query(
        'SELECT 1 FROM events WHERE id = $1 AND is_active = true',
        [eventId]
      );
      if (ex.rowCount === 0) return { ok: false, error: 'not_found' };
      return { ok: false, error: 'full' };
    }
    await client.query(
      `INSERT INTO signups (event_id, name, email) VALUES ($1, $2, $3)`,
      [eventId, name, email]
    );
    await client.query('COMMIT');
    const r = upd.rows[0];
    return {
      ok: true,
      spotsLeft: r.spots_total - r.spots_taken,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
