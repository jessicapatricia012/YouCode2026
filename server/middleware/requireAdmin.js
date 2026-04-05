/**
 * After requireAuth: only JWT role `admin` may proceed.
 */
export function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}
