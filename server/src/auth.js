import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-only-change-in-production';
const COOKIE_NAME = 'auth_token';
const MIN_PASSWORD_LEN = 8;

let idCounter = 0;

function normEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function normRole(role) {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'user' || r === 'visitor') return 'user';
  if (r === 'organizer') return 'organizer';
  return null;
}

const visitorEmail = normEmail(
  process.env.VISITOR_EMAIL || process.env.DEMO_EMAIL || 'visitor@bc.org'
);
const organizerEmail = normEmail(
  process.env.ORGANIZER_EMAIL || 'organizer@bc.org'
);

const visitorPassword =
  process.env.VISITOR_PASSWORD || process.env.DEMO_PASSWORD || 'demo123';
const organizerPassword =
  process.env.ORGANIZER_PASSWORD || process.env.DEMO_PASSWORD || 'demo123';

/** @type {Array<{ id: string; email: string; passwordHash: string; role: string }>} */
const users = [
  {
    id: 'usr_visitor',
    email: visitorEmail,
    passwordHash: bcrypt.hashSync(visitorPassword, 10),
    role: 'user',
  },
  {
    id: 'usr_organizer',
    email: organizerEmail,
    passwordHash: bcrypt.hashSync(organizerPassword, 10),
    role: 'organizer',
  },
];

export function getCookieName() {
  return COOKIE_NAME;
}

export function getJwtSecret() {
  return JWT_SECRET;
}

function findUserByEmail(email) {
  return users.find((u) => u.email === email) ?? null;
}

/**
 * @returns {{ user: { id: string; email: string; role: string } } | { error: string }}
 */
export function registerUser(email, password, role) {
  const r = normRole(role);
  if (!r) return { error: 'invalid_role' };

  const e = normEmail(email);
  if (!e || !e.includes('@')) return { error: 'invalid_email' };

  const pwd = String(password || '');
  if (pwd.length < MIN_PASSWORD_LEN) {
    return { error: 'weak_password' };
  }

  if (findUserByEmail(e)) {
    return { error: 'email_taken' };
  }

  idCounter += 1;
  const id = `usr_reg_${Date.now()}_${idCounter}`;
  const passwordHash = bcrypt.hashSync(pwd, 10);
  users.push({ id, email: e, passwordHash, role: r });

  return { user: { id, email: e, role: r } };
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} role - 'user' | 'organizer' (client may send 'visitor' for user)
 * @returns {{ user: { id: string; email: string; role: string } } | { error: string; actualRole?: string }}
 */
export function authenticate(email, password, role) {
  const expectedRole = normRole(role);
  if (!expectedRole) {
    return { error: 'invalid_role' };
  }

  const e = normEmail(email);
  const account = findUserByEmail(e);
  if (!account || !password || !bcrypt.compareSync(password, account.passwordHash)) {
    return { error: 'invalid_credentials' };
  }

  if (account.role !== expectedRole) {
    return { error: 'wrong_role', actualRole: account.role };
  }

  return {
    user: { id: account.id, email: account.email, role: account.role },
  };
}

export function signAuthToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAuthToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.role) return null;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
