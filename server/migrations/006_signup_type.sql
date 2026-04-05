-- Add signup_type column to signups table
ALTER TABLE signups ADD COLUMN signup_type TEXT NOT NULL DEFAULT 'attending' CHECK (signup_type IN ('attending', 'volunteering'));
