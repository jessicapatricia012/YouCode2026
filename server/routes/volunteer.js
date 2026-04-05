import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listRecommendedEventsForVolunteer,
  listSignupsForVolunteer,
  parseTypesQuery,
} from '../src/eventsDb.js';
import { normalizeSkillTags } from '../src/skillTags.js';

const router = Router();

/** GET /api/volunteer/signups — events this volunteer has signed up for. */
router.get('/signups', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'user') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only visitors can list their signups.',
      });
    }
    const result = await listSignupsForVolunteer(req.auth.id, req.auth.email);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/** GET /api/volunteer/recommendations — events matching profile skills (visitors only). */
router.get('/recommendations', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'user') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only visitors receive skill-based recommendations.',
      });
    }
    const types = parseTypesQuery(req.query.types);
    const result = await listRecommendedEventsForVolunteer(req.auth.id, types);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/** GET /api/volunteer/profile - Get current user's volunteer profile */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'user') {
      return res.status(403).json({ error: 'forbidden', message: 'Only visitors can access volunteer profiles.' });
    }

    const { rows } = await pool.query(
      `SELECT skills, availability, interests, experience, contact_preferences,
              emergency_contact_name, emergency_contact_phone, updated_at
       FROM volunteer_profiles WHERE user_id = $1`,
      [req.auth.id]
    );

    if (rows.length === 0) {
      return res.json({
        skills: [],
        availability: '',
        interests: [],
        experience: '',
        contactPreferences: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        updatedAt: null,
      });
    }

    const row = rows[0];
    res.json({
      skills: row.skills || [],
      availability: row.availability || '',
      interests: row.interests || [],
      experience: row.experience || '',
      contactPreferences: row.contact_preferences || '',
      emergencyContactName: row.emergency_contact_name || '',
      emergencyContactPhone: row.emergency_contact_phone || '',
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/** PUT /api/volunteer/profile - Update current user's volunteer profile */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    if (req.auth.role !== 'user') {
      return res.status(403).json({ error: 'forbidden', message: 'Only visitors can update volunteer profiles.' });
    }

    const {
      skills,
      availability,
      interests,
      experience,
      contactPreferences,
      emergencyContactName,
      emergencyContactPhone,
    } = req.body;

    const skillsArr = normalizeSkillTags(skills);
    const interestsArr = Array.isArray(interests)
      ? interests.filter((i) => typeof i === 'string' && i.trim())
      : [];

    await pool.query(
      `INSERT INTO volunteer_profiles (
         user_id, skills, availability, interests, experience,
         contact_preferences, emergency_contact_name, emergency_contact_phone, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (user_id) DO UPDATE SET
         skills = EXCLUDED.skills,
         availability = EXCLUDED.availability,
         interests = EXCLUDED.interests,
         experience = EXCLUDED.experience,
         contact_preferences = EXCLUDED.contact_preferences,
         emergency_contact_name = EXCLUDED.emergency_contact_name,
         emergency_contact_phone = EXCLUDED.emergency_contact_phone,
         updated_at = now()`,
      [
        req.auth.id,
        skillsArr,
        availability || '',
        interestsArr,
        experience || '',
        contactPreferences || '',
        emergencyContactName || '',
        emergencyContactPhone || '',
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;