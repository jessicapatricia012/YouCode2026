import { getCookieName, verifyAuthToken } from './auth.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[getCookieName()];
  const user = verifyAuthToken(token);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.user = user;
  next();
}
