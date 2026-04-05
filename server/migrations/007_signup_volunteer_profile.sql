-- Add volunteer profile fields to signups table for volunteering signups
ALTER TABLE signups ADD COLUMN volunteer_profile JSONB;