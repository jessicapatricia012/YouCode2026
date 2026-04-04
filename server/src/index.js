import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from '../routes/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listEventsFromDb,
  getEventByIdFromDb,
  createSignupForEvent,
  parseTypesQuery,
} from './eventsDb.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, message: 'pong' });
});

app.use('/api/auth', authRouter);

app.get('/api/events', requireAuth, async (req, res) => {
  try {
    const types = parseTypesQuery(req.query.types);
    const events = await listEventsFromDb(types);
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/events/:id', requireAuth, async (req, res) => {
  try {
    const ev = await getEventByIdFromDb(req.params.id);
    if (!ev) return res.status(404).json({ error: 'not_found' });
    res.json(ev);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/events/:id/signups', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};
    const name = String(body.name || req.auth.name || 'Volunteer').trim();
    const email = String(body.email || req.auth.email || '').trim();
    if (!email) {
      return res.status(400).json({ error: 'invalid_input', message: 'Email is required for signup.' });
    }
    const result = await createSignupForEvent(id, { name, email });
    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : 409;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
