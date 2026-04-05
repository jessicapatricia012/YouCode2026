import { pool } from '../db.js';
import { geocodeStreetAndCity } from './geocode.js';
import { normalizeSkillTags } from './skillTags.js';

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

/** PostgreSQL undefined_column when `events.skill_tags` was never migrated. */
function isMissingSkillTagsColumn(err) {
  return (
    err?.code === '42703' && /skill_tags/i.test(String(err.message ?? ''))
  );
}

/** PostgreSQL undefined_column when `events.admin_removed_at` was never migrated. */
function isMissingAdminRemovedColumn(err) {
  return (
    err?.code === '42703' && /admin_removed_at/i.test(String(err.message ?? ''))
  );
}

/** PostgreSQL undefined_column when `signups.user_id` was never migrated. */
function isMissingSignupsUserIdColumn(err) {
  return (
    err?.code === '42703' && /user_id/i.test(String(err.message ?? ''))
  );
}

function buildListEventsQuery(includeSkillTags, includeAdminRemovedFilter, typesFilter) {
  const skillLine = includeSkillTags ? '      e.skill_tags,\n' : '';
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
${skillLine}      o.name AS org_name,
      ST_Y(e.location::geometry) AS lat,
      ST_X(e.location::geometry) AS lng
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    WHERE e.is_active = true`;
  if (includeAdminRemovedFilter) {
    sql += `\n      AND e.admin_removed_at IS NULL`;
  }
  const params = [];
  if (typesFilter?.length) {
    const allowed = typesFilter.filter((t) => ALLOWED_TYPES.has(t));
    if (allowed.length > 0) {
      params.push(allowed);
      sql += ` AND e.type = ANY($${params.length}::event_type[])`;
    }
  }
  sql += ` ORDER BY e.starts_at ASC`;
  return [sql, params];
}

function buildGetPublicEventByIdSql(includeSkillTags, includeAdminRemovedFilter) {
  const skillLine = includeSkillTags ? '      e.skill_tags,\n' : '';
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
${skillLine}      o.name AS org_name,
      ST_Y(e.location::geometry) AS lat,
      ST_X(e.location::geometry) AS lng
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    WHERE e.id = $1 AND e.is_active = true`;
  if (includeAdminRemovedFilter) {
    sql += ` AND e.admin_removed_at IS NULL`;
  }
  return sql;
}

function mapRow(row) {
  const spotsLeft = row.spots_total - row.spots_taken;
  const out = {
    id: row.id,
    title: row.title,
    description: row.description,
    orgName: row.org_name,
    type: row.type,
    address: row.address,
    city: row.city ?? null,
    websiteUrl: row.website_url ?? null,
    skillTags: Array.isArray(row.skill_tags) ? row.skill_tags : [],
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    spotsLeft: Math.max(0, spotsLeft),
    spotsTotal: row.spots_total,
    spotsTaken: row.spots_taken,
  };
  if (row.match_count != null && Number.isFinite(Number(row.match_count))) {
    out.skillMatchCount = Number(row.match_count);
  }
  return out;
}

export async function listEventsFromDb(typesFilter) {
  const attempts = [
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ];
  let lastErr;
  for (const [skillTags, adminFilter] of attempts) {
    try {
      const [sql, params] = buildListEventsQuery(
        skillTags,
        adminFilter,
        typesFilter
      );
      const { rows } = await pool.query(sql, params);
      return rows.map(mapRow);
    } catch (err) {
      lastErr = err;
      if (isMissingSkillTagsColumn(err) && skillTags) continue;
      if (isMissingAdminRemovedColumn(err) && adminFilter) continue;
      throw err;
    }
  }
  throw lastErr;
}

/** Events that overlap the volunteer's profile skills, best matches first. */
export async function listRecommendedEventsForVolunteer(userId, typesFilter) {
  const { rows: profRows } = await pool.query(
    'SELECT skills FROM volunteer_profiles WHERE user_id = $1',
    [userId]
  );
  const profileSkills = normalizeSkillTags(profRows[0]?.skills ?? []);
  if (profileSkills.length === 0) {
    return { events: [], needsSkills: true, profileSkills: [] };
  }

  function recommendedSql(includeAdminRemoved) {
    const adminLine = includeAdminRemoved
      ? '\n      AND e.admin_removed_at IS NULL'
      : '';
    let s = `
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
      e.skill_tags,
      o.name AS org_name,
      ST_Y(e.location::geometry) AS lat,
      ST_X(e.location::geometry) AS lng,
      (
        SELECT COUNT(*)::int
        FROM (SELECT unnest(e.skill_tags) AS tag) AS st
        WHERE st.tag = ANY($1::text[])
      ) AS match_count
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    WHERE e.is_active = true${adminLine}
      AND e.skill_tags && $1::text[]
  `;
    const params = [profileSkills];
    if (typesFilter?.length) {
      const allowed = typesFilter.filter((t) => ALLOWED_TYPES.has(t));
      if (allowed.length > 0) {
        params.push(allowed);
        s += ` AND e.type = ANY($${params.length}::event_type[])`;
      }
    }
    s += ` ORDER BY match_count DESC, e.starts_at ASC LIMIT 40`;
    return [s, params];
  }

  try {
    const [sql, params] = recommendedSql(true);
    const { rows } = await pool.query(sql, params);
    return {
      events: rows.map(mapRow),
      needsSkills: false,
      profileSkills,
    };
  } catch (err) {
    if (isMissingSkillTagsColumn(err)) {
      const events = await listEventsFromDb(typesFilter);
      return { events, needsSkills: false, profileSkills };
    }
    if (isMissingAdminRemovedColumn(err)) {
      const [sql2, params2] = recommendedSql(false);
      const { rows } = await pool.query(sql2, params2);
      return {
        events: rows.map(mapRow),
        needsSkills: false,
        profileSkills,
      };
    }
    throw err;
  }
}

export async function getEventByIdFromDb(id) {
  const attempts = [
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ];
  let lastErr;
  for (const [skillTags, adminFilter] of attempts) {
    try {
      const sql = buildGetPublicEventByIdSql(skillTags, adminFilter);
      const { rows } = await pool.query(sql, [id]);
      return rows[0] ? mapRow(rows[0]) : null;
    } catch (err) {
      lastErr = err;
      if (isMissingSkillTagsColumn(err) && skillTags) continue;
      if (isMissingAdminRemovedColumn(err) && adminFilter) continue;
      throw err;
    }
  }
  throw lastErr;
}

/** Organizer's event by id (includes inactive). */
export async function getOrgEventByIdFromDb(eventId, orgId) {
  const attempts = [
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ];
  let lastErr;
  for (const [skillTags, adminCol] of attempts) {
    try {
      const skillLine = skillTags ? '      e.skill_tags,\n' : '';
      const adminLine = adminCol ? '      e.admin_removed_at,\n' : '';
      const sql = `
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
${adminLine}${skillLine}      o.name AS org_name,
      ST_Y(e.location::geometry) AS lat,
      ST_X(e.location::geometry) AS lng
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    WHERE e.id = $1 AND e.org_id = $2
  `;
      const { rows } = await pool.query(sql, [eventId, orgId]);
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        ...mapRow(r),
        isActive: r.is_active,
        removedByAdminAt: adminCol ? (r.admin_removed_at ?? null) : null,
      };
    } catch (err) {
      lastErr = err;
      if (isMissingSkillTagsColumn(err) && skillTags) continue;
      if (isMissingAdminRemovedColumn(err) && adminCol) continue;
      throw err;
    }
  }
  throw lastErr;
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
    skillTags: Array.isArray(row.skill_tags) ? row.skill_tags : [],
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    spotsLeft: Math.max(0, spotsLeft),
    spotsTotal: row.spots_total,
    spotsTaken: row.spots_taken,
    isActive: row.is_active,
    removedByAdminAt: row.admin_removed_at ?? null,
    signupCount: Number(row.signup_count ?? 0),
  };
}

/** All events for an org (including inactive), with signup counts */
export async function listOrgEventsFromDb(orgId) {
  const attempts = [
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ];
  let lastErr;
  for (const [skillTags, adminCol] of attempts) {
    try {
      const skillLine = skillTags ? '      e.skill_tags,\n' : '';
      const adminLine = adminCol ? '      e.admin_removed_at,\n' : '';
      const sql = `
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
${adminLine}${skillLine}      o.name AS org_name,
      ST_Y(e.location::geometry) AS lat,
      ST_X(e.location::geometry) AS lng,
      (SELECT COUNT(*)::int FROM signups s WHERE s.event_id = e.id) AS signup_count
    FROM events e
    INNER JOIN orgs o ON o.id = e.org_id
    WHERE e.org_id = $1
    ORDER BY e.starts_at DESC
  `;
      const { rows } = await pool.query(sql, [orgId]);
      return rows.map(mapOrgEventRow);
    } catch (err) {
      lastErr = err;
      if (isMissingSkillTagsColumn(err) && skillTags) continue;
      if (isMissingAdminRemovedColumn(err) && adminCol) continue;
      throw err;
    }
  }
  throw lastErr;
}

function buildUpdateEventExistingSelect(includeSkillTags, includeAdminCol) {
  const st = includeSkillTags ? ', skill_tags' : '';
  const ad = includeAdminCol ? ', admin_removed_at' : '';
  return `
    SELECT address, city, spots_taken, spots_total, website_url${st}${ad},
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng
    FROM events
    WHERE id = $1 AND org_id = $2
  `;
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
  const skillTags = normalizeSkillTags(body?.skillTags ?? body?.skill_tags);

  const paramsWithTags = [
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
    skillTags,
  ];
  const paramsNoTags = paramsWithTags.slice(0, -1);

  let rows;
  try {
    ({ rows } = await pool.query(
      `
    INSERT INTO events (
      org_id, title, description, type, address, city, location,
      starts_at, ends_at, spots_total, spots_taken, is_active, website_url, skill_tags
    ) VALUES (
      $1, $2, $3, $4::event_type, $5, $6,
      ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
      $9, $10, $11, 0, true, $12, $13
    )
    RETURNING id
    `,
      paramsWithTags
    ));
  } catch (err) {
    if (!isMissingSkillTagsColumn(err)) throw err;
    ({ rows } = await pool.query(
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
      paramsNoTags
    ));
  }
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
  let existingRows;
  const selAttempts = [
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ];
  let lastSelErr;
  for (const [skillTags, adminCol] of selAttempts) {
    try {
      ({ rows: existingRows } = await pool.query(
        buildUpdateEventExistingSelect(skillTags, adminCol),
        [eventId, orgId]
      ));
      lastSelErr = null;
      break;
    } catch (err) {
      lastSelErr = err;
      if (isMissingSkillTagsColumn(err) && skillTags) continue;
      if (isMissingAdminRemovedColumn(err) && adminCol) continue;
      throw err;
    }
  }
  if (lastSelErr) throw lastSelErr;

  if (!existingRows[0]) {
    const e = new Error('Not found');
    e.code = 'not_found';
    throw e;
  }
  const ex = existingRows[0];

  if (ex.admin_removed_at) {
    const mod = new Error(
      'This listing was removed by site administrators and cannot be edited.'
    );
    mod.code = 'moderated';
    throw mod;
  }

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

  const skillTags =
    'skillTags' in bodyObj || 'skill_tags' in bodyObj
      ? normalizeSkillTags(bodyObj.skillTags ?? bodyObj.skill_tags)
      : Array.isArray(ex.skill_tags)
        ? ex.skill_tags
        : [];

  const updateParamsWithTags = [
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
    skillTags,
    eventId,
    orgId,
  ];
  const updateParamsNoTags = updateParamsWithTags.filter(
    (_, i) => i !== updateParamsWithTags.length - 3
  );
  try {
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
      website_url = $11,
      skill_tags = $12
    WHERE id = $13 AND org_id = $14
    `,
      updateParamsWithTags
    );
  } catch (err) {
    if (!isMissingSkillTagsColumn(err)) throw err;
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
      updateParamsNoTags
    );
  }

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

  let rows;
  try {
    ({ rows } = await pool.query(
      `
      SELECT id, name, email, signed_up_at, user_id
      FROM signups
      WHERE event_id = $1
      ORDER BY signed_up_at ASC
      `,
      [eventId]
    ));
  } catch (err) {
    if (!isMissingSignupsUserIdColumn(err)) throw err;
    ({ rows } = await pool.query(
      `
      SELECT id, name, email, signed_up_at
      FROM signups
      WHERE event_id = $1
      ORDER BY signed_up_at ASC
      `,
      [eventId]
    ));
  }

  const emailsNeedingLookup = [
    ...new Set(
      rows
        .filter((r) => !(r.user_id ?? null) && r.email)
        .map((r) => String(r.email).trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  const emailToUserId = new Map();
  if (emailsNeedingLookup.length > 0) {
    const { rows: uidRows } = await pool.query(
      `SELECT id, lower(trim(email)) AS em FROM users WHERE lower(trim(email)) = ANY($1::text[])`,
      [emailsNeedingLookup]
    );
    for (const ur of uidRows) {
      emailToUserId.set(ur.em, ur.id);
    }
  }

  const signups = rows.map((row) => {
    const em = String(row.email || '').trim().toLowerCase();
    const userId = row.user_id ?? null;
    const profileUserId = userId || emailToUserId.get(em) || null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      signedUpAt: row.signed_up_at,
      userId,
      profileUserId,
    };
  });

  return { signups, total: signups.length };
}

function mapVolunteerSignupRow(row) {
  const total = Number(row.spots_total);
  const taken = Number(row.spots_taken);
  return {
    signupId: row.signup_id,
    signedUpAt: row.signed_up_at,
    eventId: row.id,
    title: row.title,
    type: row.type,
    address: row.address,
    city: row.city ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    spotsTotal: total,
    spotsTaken: taken,
    spotsLeft: Math.max(0, total - taken),
    isActive: row.is_active,
    removedByAdminAt: row.admin_removed_at ?? null,
    orgName: row.org_name,
  };
}

/**
 * All events the volunteer has signed up for (linked user_id and/or matching signup email).
 */
export async function listSignupsForVolunteer(userId, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  async function run(includeUserIdFilter, includeAdminRemovedCol) {
    const adminSel = includeAdminRemovedCol
      ? 'e.admin_removed_at'
      : 'NULL::timestamptz AS admin_removed_at';
    const where = includeUserIdFilter
      ? '(s.user_id = $1::uuid OR (s.user_id IS NULL AND lower(trim(s.email)) = $2))'
      : 'lower(trim(s.email)) = $1';
    const params = includeUserIdFilter ? [userId, normalizedEmail] : [normalizedEmail];

    const sql = `
      SELECT DISTINCT ON (s.event_id)
        s.id AS signup_id,
        s.signed_up_at,
        e.id,
        e.title,
        e.type,
        e.address,
        e.city,
        e.starts_at,
        e.ends_at,
        e.spots_total,
        e.spots_taken,
        e.is_active,
        ${adminSel},
        o.name AS org_name
      FROM signups s
      INNER JOIN events e ON e.id = s.event_id
      INNER JOIN orgs o ON o.id = e.org_id
      WHERE ${where}
      ORDER BY s.event_id, s.signed_up_at DESC`;

    const { rows } = await pool.query(sql, params);
    return rows.map(mapVolunteerSignupRow);
  }

  try {
    const signups = await run(true, true);
    return { signups };
  } catch (e) {
    if (isMissingSignupsUserIdColumn(e)) {
      try {
        const signups = await run(false, true);
        return { signups };
      } catch (e2) {
        if (isMissingAdminRemovedColumn(e2)) {
          const signups = await run(false, false);
          return { signups };
        }
        throw e2;
      }
    }
    if (isMissingAdminRemovedColumn(e)) {
      try {
        const signups = await run(true, false);
        return { signups };
      } catch (e2) {
        if (isMissingSignupsUserIdColumn(e2)) {
          try {
            const signups = await run(false, false);
            return { signups };
          } catch (e3) {
            throw e3;
          }
        }
        throw e2;
      }
    }
    throw e;
  }
}

/**
 * Volunteer profile + account fields for an organizer who owns the event,
 * only if a signup exists for this event linked by user_id or by matching signup email.
 */
export async function getVolunteerProfileForOrgEvent(eventId, orgId, volunteerUserId) {
  const { rows: evRows } = await pool.query(
    'SELECT 1 FROM events WHERE id = $1 AND org_id = $2',
    [eventId, orgId]
  );
  if (evRows.length === 0) return null;

  const { rows: userRows } = await pool.query(
    'SELECT display_name, email FROM users WHERE id = $1',
    [volunteerUserId]
  );
  const u = userRows[0];
  if (!u) return null;

  const userEmailNorm = String(u.email || '').trim().toLowerCase();
  let linked = false;
  try {
    const { rows: suRows } = await pool.query(
      `SELECT 1 FROM signups
       WHERE event_id = $1
         AND (
           user_id = $2::uuid
           OR (user_id IS NULL AND lower(trim(email)) = $3)
         )`,
      [eventId, volunteerUserId, userEmailNorm]
    );
    linked = suRows.length > 0;
  } catch (err) {
    if (!isMissingSignupsUserIdColumn(err)) throw err;
    const { rows: suRows } = await pool.query(
      `SELECT 1 FROM signups
       WHERE event_id = $1 AND lower(trim(email)) = $2`,
      [eventId, userEmailNorm]
    );
    linked = suRows.length > 0;
  }
  if (!linked) return null;

  const { rows: profRows } = await pool.query(
    `SELECT skills, availability, interests, experience, contact_preferences,
            emergency_contact_name, emergency_contact_phone, updated_at
     FROM volunteer_profiles WHERE user_id = $1`,
    [volunteerUserId]
  );
  const p = profRows[0];

  return {
    displayName: u.display_name || '',
    email: u.email || '',
    skills: p?.skills || [],
    availability: p?.availability || '',
    interests: p?.interests || [],
    experience: p?.experience || '',
    contactPreferences: p?.contact_preferences || '',
    emergencyContactName: p?.emergency_contact_name || '',
    emergencyContactPhone: p?.emergency_contact_phone || '',
    updatedAt: p?.updated_at ?? null,
  };
}

async function signupIncrementSpots(client, eventId, useAdminRemovedFilter) {
  const adminClause = useAdminRemovedFilter
    ? '\n         AND admin_removed_at IS NULL'
    : '';
  return client.query(
    `UPDATE events
       SET spots_taken = spots_taken + 1
       WHERE id = $1
         AND is_active = true${adminClause}
         AND spots_taken < spots_total
       RETURNING spots_total, spots_taken`,
    [eventId]
  );
}

async function signupCheckActiveEvent(client, eventId, useAdminRemovedFilter) {
  const adminClause = useAdminRemovedFilter ? ' AND admin_removed_at IS NULL' : '';
  return client.query(
    `SELECT 1 FROM events WHERE id = $1 AND is_active = true${adminClause}`,
    [eventId]
  );
}

export async function createSignupForEvent(eventId, { name, email, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) {
      try {
        const dup = await client.query(
          'SELECT 1 FROM signups WHERE event_id = $1 AND user_id = $2',
          [eventId, userId]
        );
        if (dup.rowCount > 0) {
          await client.query('ROLLBACK');
          return { ok: false, error: 'already_signed_up' };
        }
      } catch (err) {
        if (!isMissingSignupsUserIdColumn(err)) throw err;
        await client.query('ROLLBACK');
        await client.query('BEGIN');
      }
    }
    let upd;
    try {
      upd = await signupIncrementSpots(client, eventId, true);
    } catch (err) {
      if (!isMissingAdminRemovedColumn(err)) throw err;
      upd = await signupIncrementSpots(client, eventId, false);
    }
    if (upd.rowCount === 0) {
      await client.query('ROLLBACK');
      let ex;
      try {
        ex = await signupCheckActiveEvent(client, eventId, true);
      } catch (err) {
        if (!isMissingAdminRemovedColumn(err)) throw err;
        ex = await signupCheckActiveEvent(client, eventId, false);
      }
      if (ex.rowCount === 0) return { ok: false, error: 'not_found' };
      return { ok: false, error: 'full' };
    }
    try {
      await client.query(
        `INSERT INTO signups (event_id, name, email, user_id) VALUES ($1, $2, $3, $4)`,
        [eventId, name, email, userId ?? null]
      );
    } catch (err) {
      if (!isMissingSignupsUserIdColumn(err)) throw err;
      /* First INSERT failed → txn aborted. Roll back the spot increment and retry without user_id. */
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      let updRetry;
      try {
        updRetry = await signupIncrementSpots(client, eventId, true);
      } catch (e2) {
        if (!isMissingAdminRemovedColumn(e2)) throw e2;
        updRetry = await signupIncrementSpots(client, eventId, false);
      }
      if (updRetry.rowCount === 0) {
        await client.query('ROLLBACK');
        let ex;
        try {
          ex = await signupCheckActiveEvent(client, eventId, true);
        } catch (e3) {
          if (!isMissingAdminRemovedColumn(e3)) throw e3;
          ex = await signupCheckActiveEvent(client, eventId, false);
        }
        if (ex.rowCount === 0) return { ok: false, error: 'not_found' };
        return { ok: false, error: 'full' };
      }
      await client.query(
        `INSERT INTO signups (event_id, name, email) VALUES ($1, $2, $3)`,
        [eventId, name, email]
      );
      await client.query('COMMIT');
      const row = updRetry.rows[0];
      return {
        ok: true,
        spotsLeft: row.spots_total - row.spots_taken,
      };
    }
    await client.query('COMMIT');
    const r = upd.rows[0];
    return {
      ok: true,
      spotsLeft: r.spots_total - r.spots_taken,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return { ok: false, error: 'already_signed_up' };
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove the volunteer's signup(s) for an event and decrease spots_taken accordingly.
 */
export async function cancelVolunteerSignupForEvent(eventId, userId, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let del;
    try {
      del = await client.query(
        `DELETE FROM signups
         WHERE event_id = $1
           AND (user_id = $2::uuid OR (user_id IS NULL AND lower(trim(email)) = $3))
         RETURNING id`,
        [eventId, userId, normalizedEmail]
      );
    } catch (err) {
      if (!isMissingSignupsUserIdColumn(err)) throw err;
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      del = await client.query(
        `DELETE FROM signups
         WHERE event_id = $1 AND lower(trim(email)) = $2
         RETURNING id`,
        [eventId, normalizedEmail]
      );
    }
    if (del.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'not_found' };
    }
    const removed = del.rowCount;
    await client.query(
      `UPDATE events SET spots_taken = GREATEST(0, spots_taken - $2) WHERE id = $1`,
      [eventId, removed]
    );
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
