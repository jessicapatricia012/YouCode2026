-- Moderation: hide events from the public map; organizers still see them on the dashboard.
ALTER TABLE events ADD COLUMN IF NOT EXISTS admin_removed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_admin_removed_at ON events (admin_removed_at)
  WHERE admin_removed_at IS NOT NULL;
