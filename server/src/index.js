import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from '../routes/auth.js';
import volunteerRouter from '../routes/volunteer.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  listEventsFromDb,
  listOrgEventsFromDb,
  getEventByIdFromDb,
  getOrgEventByIdFromDb,
  createEventForOrg,
  createSignupForEvent,
  deleteEventByOrg,
  updateEventByOrg,
  listSignupsForOrgEvent,
  getVolunteerProfileForOrgEvent,
  parseTypesQuery,
} from './eventsDb.js';
import {
  adminRemoveEventById,
  listAllEventsForAdmin,
} from './adminEventsDb.js';
// import { notifyOrganizerEventRemoved } from './notifyEmail.js';
import { suggestCityForStreetLine } from './geocode.js';

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

app.get('/api/admin/events', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const events = await listAllEventsForAdmin();
    res.set('Cache-Control', 'no-store');
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.delete('/api/admin/events/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await adminRemoveEventById(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'not_found' });
    }
    // try {
    //   await notifyOrganizerEventRemoved({
    //     to: result.orgEmail,
    //     orgName: result.orgName,
    //     eventTitle: result.eventTitle,
    //   });
    // } catch (notifyErr) {
    //   console.error('Organizer removal email failed:', notifyErr);
    // }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/** Suggest BC city from a street line (Mapbox). Requires MAPBOX_TOKEN. */
app.get('/api/geocode/suggest', requireAuth, async (req, res) => {
  try {
    const line = String(req.query.line ?? '').trim();
    if (!line) return res.json({ city: null });
    const city = await suggestCityForStreetLine(line);
    res.json({ city });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/orgs/:orgId/events', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'organizer' || req.auth.id !== req.params.orgId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only your organization can list these events.',
      });
    }
    const events = await listOrgEventsFromDb(req.params.orgId);
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/events', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'organizer') {
      return res.status(403).json({ error: 'forbidden', message: 'Organizers only.' });
    }
    const event = await createEventForOrg(req.auth.id, req.body ?? {});
    res.status(201).json({ event });
  } catch (err) {
    if (err.code === 'validation') {
      return res.status(400).json({ error: 'invalid_input', message: err.message });
    }
    if (err.code === 'geocode_failed') {
      return res.status(422).json({ error: 'geocode_failed', message: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.delete('/api/events/:id', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'organizer') {
      return res.status(403).json({ error: 'forbidden', message: 'Organizers only.' });
    }
    const result = await deleteEventByOrg(req.params.id, req.auth.id);
    if (!result.deleted) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/events/:id/signups', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'organizer') {
      return res.status(403).json({ error: 'forbidden', message: 'Organizers only.' });
    }
    const result = await listSignupsForOrgEvent(req.params.id, req.auth.id);
    if (!result) {
      return res.status(404).json({ error: 'not_found', message: 'Event not found.' });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/** Organizer-only: volunteer profile when they signed up for this org's event (linked account). */
app.get('/api/events/:eventId/volunteers/:userId/profile', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'organizer') {
      return res.status(403).json({ error: 'forbidden', message: 'Organizers only.' });
    }
    const { eventId, userId } = req.params;
    const profile = await getVolunteerProfileForOrgEvent(eventId, req.auth.id, userId);
    if (!profile) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Event or linked volunteer signup not found.',
      });
    }
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/api/events/:id', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'organizer') {
      return res.status(403).json({ error: 'forbidden', message: 'Organizers only.' });
    }
    const event = await updateEventByOrg(req.params.id, req.auth.id, req.body ?? {});
    res.json({ event });
  } catch (err) {
    if (err.code === 'not_found') {
      return res.status(404).json({ error: 'not_found', message: 'Event not found.' });
    }
    if (err.code === 'moderated') {
      return res.status(403).json({ error: 'moderated', message: err.message });
    }
    if (err.code === 'validation') {
      return res.status(400).json({ error: 'invalid_input', message: err.message });
    }
    if (err.code === 'geocode_failed') {
      return res.status(422).json({ error: 'geocode_failed', message: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.use('/api/volunteer', volunteerRouter);

// Public read: map must show the same pins for every account (no per-role filtering).
// Signup and organizer writes stay protected.
app.get('/api/events', async (req, res) => {
  try {
    const types = parseTypesQuery(req.query.types);
    const events = await listEventsFromDb(types);
    res.set('Cache-Control', 'no-store');
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/events/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.auth.role === 'organizer') {
      const own = await getOrgEventByIdFromDb(id, req.auth.id);
      if (own) return res.json(own);
    }
    const ev = await getEventByIdFromDb(id);
    if (!ev) return res.status(404).json({ error: 'not_found' });
    res.json(ev);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/events/:id/signups', requireAuth, async (req, res) => {
  try {
    if (req.auth.role === 'organizer') {
      return res.status(403).json({ error: 'organizers_cannot_signup' });
    }
    const { id } = req.params;
    const body = req.body ?? {};
    const name = String(body.name || req.auth.name || 'Volunteer').trim();
    const email = String(body.email || req.auth.email || '').trim();
    const signupType = String(body.signupType || 'attending').trim();
    if (!email) {
      return res.status(400).json({ error: 'invalid_input', message: 'Email is required for signup.' });
    }

    // If signing up to volunteer, fetch their volunteer profile
    let volunteerProfile = null;
    if (signupType === 'volunteering') {
      try {
        const profileResult = await pool.query(
          `SELECT skills, availability, interests, experience, contact_preferences,
                  emergency_contact_name, emergency_contact_phone
           FROM volunteer_profiles WHERE user_id = $1`,
          [req.auth.id]
        );
        if (profileResult.rows.length > 0) {
          const profile = profileResult.rows[0];
          volunteerProfile = {
            skills: profile.skills || [],
            availability: profile.availability || '',
            interests: profile.interests || [],
            experience: profile.experience || '',
            contactPreferences: profile.contact_preferences || '',
            emergencyContactName: profile.emergency_contact_name || '',
            emergencyContactPhone: profile.emergency_contact_phone || '',
          };
        }
      } catch (err) {
        console.error('Error fetching volunteer profile:', err);
        // Continue without profile data if there's an error
      }
    }

    const userId = req.auth.role === 'user' ? req.auth.id : null;
    const result = await createSignupForEvent(id, { name, email, userId });
    
    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : 409;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'server_error',
      message: 'Signup could not be completed. Try again in a moment.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
