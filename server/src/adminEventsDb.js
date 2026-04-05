import { pool } from '../db.js';

/** Events created within this window get `isNewForReview` for the admin UI. */
const NEW_REVIEW_MAX_AGE_MS = 72 * 60 * 60 * 1000;

function isMissingAdminRemovedColumn(err) {
  return (
    err?.code === '42703' && /admin_removed_at/i.test(String(err.message ?? ''))
  );
}

export async function listAllEventsForAdmin() {
  const sqlWithAdmin = `
    SELECT
      e.id,
      e.title,
      e.description,
      e.type,
      e.address,
      e.city,
      e.starts_at,
      e.ends_at,
      e.created_at,
      e.is_active,
      e.admin_removed_at,
      o.id AS org_id,
      o.name AS org_name,
      o.email AS org_email
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    ORDER BY e.created_at DESC NULLS LAST, e.starts_at DESC
  `;
  const sqlNoAdmin = `
    SELECT
      e.id,
      e.title,
      e.description,
      e.type,
      e.address,
      e.city,
      e.starts_at,
      e.ends_at,
      e.created_at,
      e.is_active,
      o.id AS org_id,
      o.name AS org_name,
      o.email AS org_email
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    ORDER BY e.created_at DESC NULLS LAST, e.starts_at DESC
  `;

  let rows;
  try {
    ({ rows } = await pool.query(sqlWithAdmin));
  } catch (err) {
    if (!isMissingAdminRemovedColumn(err)) throw err;
    ({ rows } = await pool.query(sqlNoAdmin));
  }

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    address: r.address,
    city: r.city,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    createdAt: r.created_at,
    isActive: r.is_active,
    removedByAdminAt: r.admin_removed_at ?? null,
    orgId: r.org_id,
    orgName: r.org_name,
    orgEmail: r.org_email,
    isNewForReview:
      (r.admin_removed_at == null || r.admin_removed_at === undefined) &&
      r.created_at != null &&
      now - new Date(r.created_at).getTime() < NEW_REVIEW_MAX_AGE_MS,
  }));
}

/**
 * Marks event as removed by moderators (hidden from public map). Idempotent: returns null if already removed or missing.
 * @returns {{ eventTitle: string, orgEmail: string, orgName: string } | null}
 */
export async function adminRemoveEventById(eventId) {
  const sqlWithAdmin = `
    UPDATE events e
    SET
      admin_removed_at = now(),
      is_active = false
    FROM orgs o
    WHERE e.id = $1::uuid
      AND e.org_id = o.id
      AND e.admin_removed_at IS NULL
    RETURNING e.title AS title, o.email AS org_email, o.name AS org_name
  `;
  const sqlDeactivateOnly = `
    UPDATE events e
    SET is_active = false
    FROM orgs o
    WHERE e.id = $1::uuid
      AND e.org_id = o.id
      AND e.is_active = true
    RETURNING e.title AS title, o.email AS org_email, o.name AS org_name
  `;

  let rows;
  try {
    ({ rows } = await pool.query(sqlWithAdmin, [eventId]));
  } catch (err) {
    if (!isMissingAdminRemovedColumn(err)) throw err;
    ({ rows } = await pool.query(sqlDeactivateOnly, [eventId]));
  }

  if (!rows[0]) return null;
  return {
    eventTitle: rows[0].title,
    orgEmail: rows[0].org_email,
    orgName: rows[0].org_name,
  };
}
