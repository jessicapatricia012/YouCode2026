import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import {
  listEvents,
  signupForEvent,
  parseTypesQuery,
  getEventById,
} from './eventsStore.js';
import {
  authenticate,
  registerUser,
  signAuthToken,
  verifyAuthToken,
  getCookieName,
} from './auth.js';
import { requireAuth } from './authMiddleware.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === 'production',
};

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, message: 'pong' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.[getCookieName()];
  const user = verifyAuthToken(token);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, role } = req.body ?? {};
  const result = registerUser(email, password, role);
  if (result.error === 'invalid_role') {
    return res.status(400).json({ error: 'invalid_role' });
  }
  if (result.error === 'invalid_email') {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (result.error === 'weak_password') {
    return res.status(400).json({ error: 'weak_password' });
  }
  if (result.error === 'email_taken') {
    return res.status(409).json({ error: 'email_taken' });
  }
  const token = signAuthToken(result.user);
  res.cookie(getCookieName(), token, cookieOptions);
  res.status(201).json({ user: result.user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body ?? {};
  const result = authenticate(email, password, role);
  if (result.error === 'invalid_role') {
    return res.status(400).json({ error: 'invalid_role' });
  }
  if (result.error === 'wrong_role') {
    return res.status(401).json({
      error: 'wrong_role',
      actualRole: result.actualRole,
    });
  }
  if (result.error === 'invalid_credentials') {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = signAuthToken(result.user);
  res.cookie(getCookieName(), token, cookieOptions);
  res.json({ user: result.user });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(getCookieName(), { path: '/' });
  res.json({ ok: true });
});

app.get('/api/events', requireAuth, (req, res) => {
  const types = parseTypesQuery(req.query.types);
  res.json({ events: listEvents(types) });
});

app.post('/api/events/:id/signups', requireAuth, (req, res) => {
  const { id } = req.params;
  const result = signupForEvent(id);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 409;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.get('/api/events/:id', requireAuth, (req, res) => {
  const ev = getEventById(req.params.id);
  if (!ev) return res.status(404).json({ error: 'not_found' });
  res.json(ev);
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
