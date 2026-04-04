import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES = '7d';

function signOrgToken(org) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign(
    {
      sub: org.id,
      email: org.email,
      name: org.name,
    },
    secret,
    { expiresIn: JWT_EXPIRES }
  );
}

function serializeOrg(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    website: row.website,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

/** POST /api/auth/register */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};
    const n = String(name || '').trim();
    const e = String(email || '').toLowerCase().trim();
    const p = String(password || '');

    if (!n || !e || !e.includes('@')) {
      return res.status(400).json({ error: 'invalid_input', message: 'Name and valid email are required.' });
    }
    if (p.length < 8) {
      return res.status(400).json({
        error: 'weak_password',
        message: 'Password must be at least 8 characters.',
      });
    }

    const passwordHash = await bcrypt.hash(p, BCRYPT_ROUNDS);

    const { rows } = await pool.query(
      `INSERT INTO orgs (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, website, logo_url, created_at`,
      [n, e, passwordHash]
    );

    const org = rows[0];
    const token = signOrgToken(org);
    res.status(201).json({ token, org: serializeOrg(org) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'email_taken',
        message: 'An account with this email already exists.',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const e = String(email || '').toLowerCase().trim();
    const p = String(password || '');

    if (!e || !p) {
      return res.status(400).json({ error: 'invalid_input', message: 'Email and password are required.' });
    }

    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, website, logo_url, created_at
       FROM orgs WHERE email = $1`,
      [e]
    );
    const org = rows[0];
    if (!org || !(await bcrypt.compare(p, org.password_hash))) {
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    const token = signOrgToken(org);
    res.json({ token, org: serializeOrg(org) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/** GET /api/auth/me */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, website, logo_url, created_at
       FROM orgs WHERE id = $1`,
      [req.org.id]
    );
    if (!rows[0]) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Organization not found.',
      });
    }
    res.json({ org: serializeOrg(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
