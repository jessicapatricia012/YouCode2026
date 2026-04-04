import { pool } from '../db.js';

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
