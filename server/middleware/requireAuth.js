import jwt from 'jsonwebtoken';

const VALID_ROLES = new Set(['user', 'organizer']);

/**
 * Reads Authorization: Bearer <token>, verifies JWT with JWT_SECRET,
 * attaches req.auth = { id, email, name, role }.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Missing Authorization header. Use: Authorization: Bearer <token>',
    });
  }

  const parts = header.split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid Authorization format. Expected: Bearer <token>',
    });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not set');
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    const id = decoded.sub;
    const role = decoded.role;
    if (!id || !VALID_ROLES.has(role)) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid token payload. Please sign in again.',
      });
    }
    req.auth = {
      id,
      email: decoded.email,
      name: decoded.name,
      role,
    };
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Token expired. Please sign in again.'
        : 'Invalid or expired token.';
    return res.status(401).json({ error: 'unauthorized', message });
  }
}
