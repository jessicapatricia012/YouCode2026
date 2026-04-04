import jwt from 'jsonwebtoken';

/**
 * Reads Authorization: Bearer <token>, verifies JWT with JWT_SECRET,
 * attaches req.org = { id, email, name } from payload.
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
    if (!id) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid token payload.',
      });
    }
    req.org = {
      id,
      email: decoded.email,
      name: decoded.name,
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
