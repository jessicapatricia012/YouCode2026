import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  listEvents,
  signupForEvent,
  parseTypesQuery,
  getEventById,
} from './eventsStore.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, message: 'pong' });
});

app.get('/api/events', (req, res) => {
  const types = parseTypesQuery(req.query.types);
  res.json({ events: listEvents(types) });
});

app.post('/api/events/:id/signups', (req, res) => {
  const { id } = req.params;
  const result = signupForEvent(id);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 409;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.get('/api/events/:id', (req, res) => {
  const ev = getEventById(req.params.id);
  if (!ev) return res.status(404).json({ error: 'not_found' });
  res.json(ev);
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
