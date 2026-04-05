import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

/** Stable JWT subject for env-configured admins (not stored in `users` / `orgs`). */
const ADMIN_JWT_SUB = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

function adminEmailsFromEnv() {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function verifyAdminPassword(plain) {
  const expected = process.env.ADMIN_PASSWORD;
  if (expected == null || expected === '' || plain == null) return false;
  try {
    const p = Buffer.from(String(plain), 'utf8');
    const e = Buffer.from(String(expected), 'utf8');
    if (p.length !== e.length) return false;
    return timingSafeEqual(p, e);
  } catch {
    return false;
  }
}
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES = '7d';

function normRole(role) {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'user' || r === 'visitor') return 'user';
  if (r === 'organizer') return 'organizer';
  return null;
}

function signAccountToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign(
    {
      sub: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    },
    secret,
    { expiresIn: JWT_EXPIRES }
  );
}

function serializeOrganizer(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: 'organizer',
    website: row.website,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

function serializeVisitor(row) {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    role: 'user',
    website: null,
    logoUrl: null,
    createdAt: row.created_at,
  };
}

async function emailExistsAnywhere(email) {
  const u = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (u.rowCount) return true;
  const o = await pool.query('SELECT 1 FROM orgs WHERE email = $1', [email]);
  return o.rowCount > 0;
}

async function bcryptMatches(row, plain) {
  const h = row?.password_hash;
  if (!h || typeof h !== 'string') return false;
  try {
    return await bcrypt.compare(plain, h);
  } catch {
    return false;
  }
}

/** Postgres / network errors where credentials cannot be checked. */
function databaseUnavailableResponse(err) {
  const code = err?.code;
  const msg = String(err?.message ?? '');
  if (code === '3D000' || /database .* does not exist/i.test(msg)) {
    return {
      status: 503,
      body: {
        error: 'database_unavailable',
        message:
          'The PostgreSQL database is missing or the connection URL is wrong. From the repo root run `docker compose up -d`, set DATABASE_URL in server/.env, then run migrations (see server/.env.example).',
      },
    };
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return {
      status: 503,
      body: {
        error: 'database_unavailable',
        message:
          'Cannot connect to PostgreSQL. Start the database (e.g. `npm run db:up` from the repo root) and check DATABASE_URL in server/.env.',
      },
    };
  }
  return null;
}

/** POST /api/auth/register */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role: roleRaw } = req.body ?? {};
    const role = normRole(roleRaw) ?? 'user';
    const n = String(name || '').trim();
    const e = String(email || '').toLowerCase().trim();
    const p = String(password || '').trim();
    if (!n || !e || !e.includes('@')) {
      return res.status(400).json({ error: 'invalid_input', message: 'Name and valid email are required.' });
    }
    if (p.length < 8) {
      return res.status(400).json({
        error: 'weak_password',
        message: 'Password must be at least 8 characters.',
      });
    }

    if (await emailExistsAnywhere(e)) {
      return res.status(409).json({
        error: 'email_taken',
        message: 'An account with this email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(p, BCRYPT_ROUNDS);

    if (role === 'user') {
      const { rows } = await pool.query(
        `INSERT INTO users (display_name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, display_name, email, created_at`,
        [n, e, passwordHash]
      );
      const row = rows[0];
      const user = serializeVisitor(row);
      const token = signAccountToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'user',
      });
      return res.status(201).json({ token, user });
    }

    const { rows } = await pool.query(
      `INSERT INTO orgs (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, website, logo_url, created_at`,
      [n, e, passwordHash]
    );
    const user = serializeOrganizer(rows[0]);
    const token = signAccountToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'organizer',
    });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'email_taken',
        message: 'An account with this email already exists.',
      });
    }
    const dbErr = databaseUnavailableResponse(err);
    if (dbErr) {
      console.error(err);
      return res.status(dbErr.status).json(dbErr.body);
    }
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/auth/login — single form.
 * Checks both `users` and `orgs` for the email. If the same email exists in both (e.g. after a merge),
 * the visitor row used to block organizer login when the password only matched the org; we now accept
 * whichever password matches. If both match, visitor wins.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const e = String(email || '').toLowerCase().trim();
    const p = String(password || '').trim();

    if (!e || !p) {
      return res.status(400).json({ error: 'invalid_input', message: 'Email and password are required.' });
    }

    const adminEmails = adminEmailsFromEnv();
    const isConfiguredAdminEmail =
      adminEmails.size > 0 && adminEmails.has(e);
    if (isConfiguredAdminEmail && verifyAdminPassword(p)) {
      const token = signAccountToken({
        id: ADMIN_JWT_SUB,
        email: e,
        name: 'Administrator',
        role: 'admin',
      });
      return res.json({
        token,
        user: {
          id: ADMIN_JWT_SUB,
          email: e,
          name: 'Administrator',
          role: 'admin',
          website: null,
          logoUrl: null,
          createdAt: null,
        },
      });
    }

    const { rows: uRows } = await pool.query(
      `SELECT id, display_name, email, password_hash, created_at FROM users WHERE email = $1`,
      [e]
    );
    const { rows: oRows } = await pool.query(
      `SELECT id, name, email, password_hash, website, logo_url, created_at FROM orgs WHERE email = $1`,
      [e]
    );
    const u = uRows[0];
    const o = oRows[0];

    const userOk = u && (await bcryptMatches(u, p));
    const orgOk = o && (await bcryptMatches(o, p));

    if (userOk) {
      const user = serializeVisitor(u);
      const token = signAccountToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'user',
      });
      return res.json({ token, user });
    }

    if (orgOk) {
      const user = serializeOrganizer(o);
      const token = signAccountToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'organizer',
      });
      return res.json({ token, user });
    }

    const hasDbAccount = !!(u || o);
    if (!hasDbAccount) {
      if (isConfiguredAdminEmail) {
        return res.status(401).json({
          error: 'wrong_password',
          message: 'Incorrect password.',
        });
      }
      return res.status(401).json({
        error: 'unknown_email',
        message: 'No account exists for this email.',
      });
    }

    return res.status(401).json({
      error: 'wrong_password',
      message: 'Incorrect password.',
    });
  } catch (err) {
    const dbErr = databaseUnavailableResponse(err);
    if (dbErr) {
      console.error(err);
      return res.status(dbErr.status).json(dbErr.body);
    }
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/** GET /api/auth/me */
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.auth.role === 'admin') {
      return res.json({
        user: {
          id: req.auth.id,
          email: req.auth.email,
          name: req.auth.name,
          role: 'admin',
          website: null,
          logoUrl: null,
          createdAt: null,
        },
      });
    }

    if (req.auth.role === 'user') {
      const { rows } = await pool.query(
        `SELECT id, display_name, email, created_at FROM users WHERE id = $1`,
        [req.auth.id]
      );
      if (!rows[0]) {
        return res.status(401).json({ error: 'unauthorized', message: 'Account not found.' });
      }
      return res.json({ user: serializeVisitor(rows[0]) });
    }

    const { rows } = await pool.query(
      `SELECT id, name, email, website, logo_url, created_at FROM orgs WHERE id = $1`,
      [req.auth.id]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: 'unauthorized', message: 'Organization not found.' });
    }
    res.json({ user: serializeOrganizer(rows[0]) });
  } catch (err) {
    const dbErr = databaseUnavailableResponse(err);
    if (dbErr) {
      console.error(err);
      return res.status(dbErr.status).json(dbErr.body);
    }
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
