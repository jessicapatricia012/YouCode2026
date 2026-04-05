-- Link signups to volunteer user accounts (for organizer dashboard profile view)

ALTER TABLE signups
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_signups_user_id ON signups (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_event_user_unique
  ON signups (event_id, user_id)
  WHERE user_id IS NOT NULL;
